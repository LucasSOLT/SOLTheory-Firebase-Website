import crypto from "crypto";
import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Vercel serverless: allow up to 60 seconds for email sending
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Email Campaign Cron
// ---------------------------------------------------------------------------
// Runs every 5 minutes (configured in vercel.json).
// Scans ALL users' campaigns for those with status === "active" and
// triggerAt <= now, then sends the emails via the Gmail API route.
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET || "";

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

        // Mark as processing to prevent duplicate sends
        await campDoc.ref.update({ status: "processing", updatedAt: FieldValue.serverTimestamp() });

        try {
          // Get user's Gmail refresh token
          const userData = userDoc.data();
          const refreshToken =
            userData?.gmailOAuth_jarvis?.refreshToken ||
            userData?.gmailOAuth_morpheus?.refreshToken ||
            userData?.gmailOAuth_email?.refreshToken ||
            userData?.["gmailOAuth_inbound-email"]?.refreshToken ||
            userData?.gmailOAuth?.refreshToken ||
            null;

          if (!refreshToken) {
            console.warn(`[Email Cron] No refresh token for user ${uid} — skipping`);
            await campDoc.ref.update({ status: "active", errorMessage: "No Gmail token", updatedAt: FieldValue.serverTimestamp() });
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

          // Send via the existing send API route (internal fetch)
          const recipients = (campaign.recipients || []).map((r: { email: string }) => r.email).filter(Boolean);
          if (recipients.length === 0) {
            await campDoc.ref.update({ status: "completed", updatedAt: FieldValue.serverTimestamp() });
            continue;
          }

          // Resolve merge fields in subject and body
          let resolvedSubject = campaign.subject || "";
          let resolvedBody = campaign.body || "";

          // Simple merge field resolution for the cron context
          const firstRecipient = campaign.recipients?.[0];
          if (firstRecipient) {
            resolvedSubject = resolvedSubject.replace(/\{\{first_name\}\}/gi, firstRecipient.name?.split(" ")[0] || "");
            resolvedSubject = resolvedSubject.replace(/\{\{org_name\}\}/gi, orgName || "");
          }

          // Build HTML body
          const htmlBody = resolvedBody.split('\n').map((line: string) => `<p style="margin:0 0 12px 0;">${line}</p>`).join('');
          
          // Append sign-off
          let signoff = "";
          if (senderName || phoneNumber || replyToEmail || website) {
            signoff += '<hr style="margin:24px 0 12px;border:none;border-top:1px solid #e2e8f0;">';
            if (senderName) signoff += `<p style="margin:0 0 4px;">${senderName}</p>`;
            if (phoneNumber) signoff += `<p style="margin:0 0 4px;">${phoneNumber}</p>`;
            if (replyToEmail) signoff += `<p style="margin:0 0 4px;">${replyToEmail}</p>`;
            if (website) signoff += `<p style="margin:0 0 4px;">${website}</p>`;
          }

          const finalHtml = htmlBody + signoff;

          // Use the Gmail API directly via googleapis
          const { google } = await import("googleapis");
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
          );
          oauth2Client.setCredentials({ refresh_token: refreshToken });

          try {
            await oauth2Client.getAccessToken();
          } catch (tokenErr) {
            console.error(`[Email Cron] Token refresh failed for user ${uid}:`, tokenErr);
            await campDoc.ref.update({
              status: "active",
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

          let sentCount = 0;
          for (const recipientEmail of recipients) {
            try {
              // Resolve per-recipient merge fields
              const recipientData = campaign.recipients.find((r: { email: string }) => r.email === recipientEmail);
              let perSubject = campaign.subject || "";
              let perBody = campaign.body || "";
              if (recipientData) {
                const firstName = recipientData.name?.split(" ")[0] || "";
                perSubject = perSubject.replace(/\{\{first_name\}\}/gi, firstName);
                perSubject = perSubject.replace(/\{\{org_name\}\}/gi, orgName);
                perBody = perBody.replace(/\{\{first_name\}\}/gi, firstName);
                perBody = perBody.replace(/\{\{org_name\}\}/gi, orgName);
              }

              const perHtml = perBody.split('\n').map((line: string) => `<p style="margin:0 0 12px 0;">${line}</p>`).join('') + signoff;

              const emailLines = [
                `MIME-Version: 1.0`,
                `From: ${senderEmail}`,
                `To: ${recipientEmail}`,
                `Subject: ${perSubject}`,
                `Content-Type: text/html; charset=utf-8`,
                ``,
                perHtml,
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
              console.error(`[Email Cron] Failed to send to ${recipientEmail}:`, sendErr?.message);
              errors.push(`${campDoc.id}→${recipientEmail}: ${sendErr?.message}`);
            }
          }

          totalSent += sentCount;

          // Update campaign status
          const updateData: Record<string, unknown> = {
            sent: (campaign.sent || 0) + sentCount,
            lastSentAt: now.toISOString(),
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (!campaign.repeatDays || campaign.repeatDays === 0) {
            updateData.status = "completed";
          } else {
            updateData.status = "active"; // Keep active for next repeat
          }

          await campDoc.ref.update(updateData);
          console.log(`[Email Cron] ✓ Campaign ${campDoc.id}: sent ${sentCount}/${recipients.length}`);
        } catch (campErr: any) {
          console.error(`[Email Cron] ✗ Campaign ${campDoc.id} error:`, campErr?.message);
          errors.push(`${campDoc.id}: ${campErr?.message}`);
          await campDoc.ref.update({
            status: "active",
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
