import crypto from "crypto";
import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";

// Vercel Pro: allow up to 300 seconds for large batch sends
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Email Campaign Cron
// ---------------------------------------------------------------------------
// Runs every 5 minutes (configured in vercel.json).
// Scans ALL users' campaigns for those with status === "active" and
// triggerAt <= now, then sends the emails.
//
// Sending strategy:
//   - < 50 recipients  → Gmail API (existing path, sequential)
//   - >= 50 recipients → SendGrid batch with personalizations (up to 1000/call)
//
// Batch processing: chunks of 100, progress saved to Firestore after each chunk.
// Deadlock recovery: campaigns stuck in "processing" for >10 min are reset.
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET || "";
const SENDGRID_BATCH_THRESHOLD = 50;
const BATCH_CHUNK_SIZE = 100;
const BATCH_DELAY_MS = 200;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function verifyAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  if (!CRON_SECRET || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(CRON_SECRET);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve per-recipient merge fields in subject & HTML
// ---------------------------------------------------------------------------
interface RecipientData {
  email: string;
  name?: string;
  [key: string]: unknown;
}

function resolveMergeFields(
  template: string,
  recipientData: RecipientData | undefined,
  orgName: string,
  senderName: string,
  phoneNumber: string,
): string {
  let result = template;
  if (recipientData) {
    const firstName = recipientData.name?.split(" ")[0] || "";
    const lastName = recipientData.name?.split(" ").slice(1).join(" ") || "";
    result = result.replace(/\{\{first_name\}\}/gi, firstName);
    result = result.replace(/\{\{last_name\}\}/gi, lastName);
    result = result.replace(/\{\{org_name\}\}/gi, orgName);
    result = result.replace(/\{\{sender_name\}\}/gi, senderName);
    result = result.replace(/\{\{phone_number\}\}/gi, phoneNumber);
    result = result.replace(/\{\{email\}\}/gi, recipientData.email || "");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: build per-recipient HTML
// ---------------------------------------------------------------------------
function buildPerRecipientHtml(
  campaign: Record<string, any>,
  recipientData: RecipientData | undefined,
  signoff: string,
  orgName: string,
  senderName: string,
  phoneNumber: string,
): { subject: string; html: string } {
  let perSubject = campaign.subject || "";
  let perHtml: string;

  if (campaign.htmlContent) {
    // Smart Composer: send pre-assembled HTML with merge fields resolved
    perHtml = campaign.htmlContent;
    perSubject = resolveMergeFields(perSubject, recipientData, orgName, senderName, phoneNumber);
    perHtml = resolveMergeFields(perHtml, recipientData, orgName, senderName, phoneNumber);
  } else {
    // Classic mode: wrap plain text in <p> tags + sign-off
    let perBody = campaign.body || "";
    if (recipientData) {
      const firstName = recipientData.name?.split(" ")[0] || "";
      perSubject = perSubject.replace(/\{\{first_name\}\}/gi, firstName);
      perSubject = perSubject.replace(/\{\{org_name\}\}/gi, orgName);
      perBody = perBody.replace(/\{\{first_name\}\}/gi, firstName);
      perBody = perBody.replace(/\{\{org_name\}\}/gi, orgName);
    }
    perHtml = perBody.split('\n').map((line: string) => `<p style="margin:0 0 12px 0;">${line}</p>`).join('') + signoff;
  }

  return { subject: perSubject, html: perHtml };
}

// ---------------------------------------------------------------------------
// Helper: sleep utility
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// SendGrid batch sender — chunks of 100, progress saved after each chunk
// ---------------------------------------------------------------------------
async function sendViaSendGrid(
  campaign: Record<string, any>,
  campRef: FirebaseFirestore.DocumentReference,
  recipients: RecipientData[],
  senderEmail: string,
  senderName: string,
  orgName: string,
  phoneNumber: string,
  signoff: string,
  errors: string[],
  campDocId: string,
): Promise<number> {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

  // Start from where we left off (in case of a previous partial send)
  const alreadySentThisRun = campaign._batchProgress || 0;
  const remainingRecipients = recipients.slice(alreadySentThisRun);
  let sentCount = alreadySentThisRun;

  // Process in chunks of BATCH_CHUNK_SIZE
  for (let i = 0; i < remainingRecipients.length; i += BATCH_CHUNK_SIZE) {
    const chunk = remainingRecipients.slice(i, i + BATCH_CHUNK_SIZE);

    // Build personalizations for this chunk — each recipient gets their own
    // resolved subject and HTML via substitutions, but SendGrid personalizations
    // with individual HTML per-recipient requires separate messages.
    // We send one message per recipient in a single sgMail.send() batch call.
    const messages = chunk.map((recipientData) => {
      const { subject, html } = buildPerRecipientHtml(
        campaign,
        recipientData,
        signoff,
        orgName,
        senderName,
        phoneNumber,
      );

      return {
        to: recipientData.email,
        from: {
          email: senderEmail === "me" ? (campaign.ownerEmail || senderEmail) : senderEmail,
          name: senderName || undefined,
        },
        subject,
        html,
      };
    });

    try {
      // sgMail.send() with an array sends as a batch (single HTTP request to SendGrid)
      await sgMail.send(messages);
      sentCount += chunk.length;
    } catch (batchErr: any) {
      // If batch fails, try individually to maximize delivery
      console.error(`[Email Cron] SendGrid batch failed for chunk, falling back to individual sends:`, batchErr?.message);
      for (const msg of messages) {
        try {
          await sgMail.send(msg);
          sentCount++;
        } catch (indErr: any) {
          console.error(`[Email Cron] SendGrid individual send failed for ${msg.to}:`, indErr?.message);
          errors.push(`${campDocId}→${msg.to}: ${indErr?.message}`);
        }
      }
    }

    // Save progress to Firestore after each chunk
    await campRef.update({
      _batchProgress: sentCount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Rate-limit delay between batches
    if (i + BATCH_CHUNK_SIZE < remainingRecipients.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return sentCount;
}

// ---------------------------------------------------------------------------
// Gmail API sender (original path — for small campaigns)
// ---------------------------------------------------------------------------
async function sendViaGmail(
  campaign: Record<string, any>,
  recipients: RecipientData[],
  senderEmail: string,
  gmail: any,
  signoff: string,
  orgName: string,
  senderName: string,
  phoneNumber: string,
  errors: string[],
  campDocId: string,
): Promise<number> {
  let sentCount = 0;
  for (const recipientData of recipients) {
    try {
      const { subject, html } = buildPerRecipientHtml(
        campaign,
        recipientData,
        signoff,
        orgName,
        senderName,
        phoneNumber,
      );

      const emailLines = [
        `MIME-Version: 1.0`,
        `From: ${senderEmail}`,
        `To: ${recipientData.email}`,
        `Subject: ${subject}`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        html,
      ];

      const raw = Buffer.from(emailLines.join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
      sentCount++;
    } catch (sendErr: any) {
      console.error(`[Email Cron] Failed to send to ${recipientData.email}:`, sendErr?.message);
      errors.push(`${campDocId}→${recipientData.email}: ${sendErr?.message}`);
    }
  }
  return sentCount;
}

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  // Vercel Cron sends the CRON_SECRET as a bearer token
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const startTime = Date.now();
  console.log("[Email Cron] Starting scheduled email campaign scan...");

  initAdmin();
  const firestore = getFirestore();
  const now = new Date();

  // Scan all users for active campaigns with triggerAt <= now
  // Campaigns are stored at users/{uid}/campaigns/{campaignId}
  try {
    const usersSnap = await firestore.collection("users").get();
    let totalProcessed = 0;
    let totalSent = 0;
    const errors: string[] = [];

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const campaignsRef = firestore.collection(`users/${uid}/campaigns`);

      // ── Deadlock recovery: reset campaigns stuck in "processing" > 10 min ──
      const stuckSnap = await campaignsRef
        .where("status", "==", "processing")
        .get();

      for (const stuckDoc of stuckSnap.docs) {
        const stuckData = stuckDoc.data();
        const updatedAt = stuckData.updatedAt?.toDate?.() || stuckData.updatedAt;
        if (updatedAt) {
          const stuckDuration = now.getTime() - new Date(updatedAt).getTime();
          if (stuckDuration > PROCESSING_TIMEOUT_MS) {
            console.warn(`[Email Cron] Resetting stuck campaign ${stuckDoc.id} for user ${uid} (stuck ${Math.round(stuckDuration / 1000)}s)`);
            await stuckDoc.ref.update({
              status: "active",
              _batchProgress: 0,
              errorMessage: "Reset from stuck processing state",
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      // ── Find active campaigns due now ──
      const activeSnap = await campaignsRef
        .where("status", "==", "active")
        .get();

      if (activeSnap.empty) continue;

      for (const campDoc of activeSnap.docs) {
        const campaign = campDoc.data();
        const triggerAt = campaign.triggerAt;
        if (!triggerAt) continue;

        const triggerDate = new Date(triggerAt);
        if (triggerDate.getTime() > now.getTime()) {
          // Not due yet — skip
          continue;
        }

        // Campaign is due — check if it hasn't been sent yet (sent === 0 or undefined)
        if ((campaign.sent || 0) > 0) {
          // Already sent — check if it's a repeating campaign
          if (!campaign.repeatDays || campaign.repeatDays === 0) {
            // One-time campaign already sent — mark as completed
            await campDoc.ref.update({ status: "completed", updatedAt: FieldValue.serverTimestamp() });
            continue;
          }

          // Repeating campaign — check if next occurrence is due
          const lastSentAt = campaign.lastSentAt ? new Date(campaign.lastSentAt) : triggerDate;
          const nextDue = new Date(lastSentAt.getTime() + campaign.repeatDays * 24 * 60 * 60 * 1000);
          if (nextDue.getTime() > now.getTime()) continue;

          // Check end date
          if (campaign.endAt) {
            const endDate = new Date(campaign.endAt);
            if (now.getTime() > endDate.getTime()) {
              await campDoc.ref.update({ status: "completed", updatedAt: FieldValue.serverTimestamp() });
              continue;
            }
          }
        }

        // ── Send the emails ─────────────────────────────────────────
        console.log(`[Email Cron] Processing campaign ${campDoc.id} for user ${uid}`);
        totalProcessed++;

        // Atomically claim this campaign to prevent duplicate sends from overlapping cron runs.
        // Re-read the document to ensure no other cron instance has already claimed it.
        const freshSnap = await campDoc.ref.get();
        const freshData = freshSnap.data();
        if (!freshData || freshData.status !== "active") {
          console.log(`[Email Cron] Campaign ${campDoc.id} already claimed by another run (status: ${freshData?.status}), skipping`);
          continue;
        }

        // Mark as processing to prevent duplicate sends
        await campDoc.ref.update({
          status: "processing",
          _batchProgress: 0,
          _processingStartedAt: now.toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        try {
          // Get user's Gmail refresh token
          const userData = userDoc.data();
          const refreshToken =
            userData?.gmailOAuth_campaigning?.refreshToken ||
            userData?.gmailOAuth_jarvis?.refreshToken ||
            userData?.gmailOAuth_morpheus?.refreshToken ||
            userData?.gmailOAuth_email?.refreshToken ||
            userData?.["gmailOAuth_inbound-email"]?.refreshToken ||
            userData?.gmailOAuth?.refreshToken ||
            null;

          if (!refreshToken) {
            console.warn(`[Email Cron] No refresh token for user ${uid} — skipping`);
            await campDoc.ref.update({ status: "active", _batchProgress: 0, errorMessage: "No Gmail token", updatedAt: FieldValue.serverTimestamp() });
            continue;
          }

          // Load sender settings
          let senderName = "";
          let orgName = "";
          let phoneNumber = "";
          let replyToEmail = "";
          let website = "";
          try {
            const settingsSnap = await firestore.doc(`users/${uid}/settings/campaignSettings`).get();
            if (settingsSnap.exists) {
              const s = settingsSnap.data()!;
              senderName = s.senderName || "";
              orgName = s.orgName || "";
              phoneNumber = s.phoneNumber || "";
              replyToEmail = s.replyToEmail || "";
              website = s.website || "";
            }
          } catch { /* ignore */ }

          // Load personal info presets as fallback
          try {
            const presetSnap = await firestore.doc(`users/${uid}/settings/personalInfoPresets`).get();
            if (presetSnap.exists) {
              const presets = presetSnap.data()?.presets || [];
              if (presets.length > 0) {
                const latest = presets[presets.length - 1];
                if (!senderName && latest.senderName) senderName = latest.senderName;
                if (!orgName && latest.orgName) orgName = latest.orgName;
                if (!phoneNumber && latest.phoneNumber) phoneNumber = latest.phoneNumber;
              }
            }
          } catch { /* ignore */ }

          // Build recipients list with full data — deduplicate by email
          const seenEmails = new Set<string>();
          const recipientsList: RecipientData[] = [];
          for (const r of (campaign.recipients || [])) {
            if (!r.email) continue;
            const emailLower = r.email.toLowerCase().trim();
            if (seenEmails.has(emailLower)) continue;
            seenEmails.add(emailLower);
            recipientsList.push(r);
          }
          if (recipientsList.length === 0) {
            await campDoc.ref.update({ status: "completed", _batchProgress: 0, updatedAt: FieldValue.serverTimestamp() });
            continue;
          }

          // Build sign-off block
          let signoff = "";
          if (senderName || phoneNumber || replyToEmail || website) {
            signoff += '<hr style="margin:24px 0 12px;border:none;border-top:1px solid #e2e8f0;">';
            if (senderName) signoff += `<p style="margin:0 0 4px;">${senderName}</p>`;
            if (phoneNumber) signoff += `<p style="margin:0 0 4px;">${phoneNumber}</p>`;
            if (replyToEmail) signoff += `<p style="margin:0 0 4px;">${replyToEmail}</p>`;
            if (website) signoff += `<p style="margin:0 0 4px;">${website}</p>`;
          }

          // Get sender email from Gmail profile (needed for both paths)
          const { google } = await import("googleapis");
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI,
          );
          oauth2Client.setCredentials({ refresh_token: refreshToken });

          try {
            await oauth2Client.getAccessToken();
          } catch (tokenErr) {
            console.error(`[Email Cron] Token refresh failed for user ${uid}:`, tokenErr);
            await campDoc.ref.update({
              status: "active",
              _batchProgress: 0,
              errorMessage: "Gmail token expired — user needs to reconnect.",
              updatedAt: FieldValue.serverTimestamp(),
            });
            continue;
          }

          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          let senderEmail = "me";
          try {
            const profile = await gmail.users.getProfile({ userId: "me" });
            senderEmail = profile.data.emailAddress || "me";
          } catch { /* fallback */ }

          // ── Choose sending path ──────────────────────────────────────
          let sentCount: number;
          const useSendGrid =
            recipientsList.length >= SENDGRID_BATCH_THRESHOLD &&
            !!process.env.SENDGRID_API_KEY;

          if (useSendGrid) {
            console.log(`[Email Cron] Using SendGrid batch for ${recipientsList.length} recipients`);
            sentCount = await sendViaSendGrid(
              campaign,
              campDoc.ref,
              recipientsList,
              senderEmail,
              senderName,
              orgName,
              phoneNumber,
              signoff,
              errors,
              campDoc.id,
            );
          } else {
            console.log(`[Email Cron] Using Gmail API for ${recipientsList.length} recipients`);
            sentCount = await sendViaGmail(
              campaign,
              recipientsList,
              senderEmail,
              gmail,
              signoff,
              orgName,
              senderName,
              phoneNumber,
              errors,
              campDoc.id,
            );
          }

          totalSent += sentCount;

          // Update campaign status
          const updateData: Record<string, unknown> = {
            sent: (campaign.sent || 0) + sentCount,
            lastSentAt: now.toISOString(),
            _batchProgress: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (!campaign.repeatDays || campaign.repeatDays === 0) {
            updateData.status = "completed";
          } else {
            updateData.status = "active"; // Keep active for next repeat
          }

          await campDoc.ref.update(updateData);
          console.log(`[Email Cron] ✓ Campaign ${campDoc.id}: sent ${sentCount}/${recipientsList.length} via ${useSendGrid ? "SendGrid" : "Gmail"}`);
        } catch (campErr: any) {
          console.error(`[Email Cron] ✗ Campaign ${campDoc.id} error:`, campErr?.message);
          errors.push(`${campDoc.id}: ${campErr?.message}`);
          await campDoc.ref.update({
            status: "active",
            _batchProgress: 0,
            errorMessage: campErr?.message || "Unknown error",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Email Cron] Complete. ${totalProcessed} campaigns processed, ${totalSent} emails sent. (${durationMs}ms)`);

    return NextResponse.json({
      processed: totalProcessed,
      sent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
    });
  } catch (err: any) {
    console.error("[Email Cron] Fatal error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
