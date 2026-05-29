import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp, cert } from "firebase-admin/app";

// Initialize Firebase Admin (for server-side auth verification and Firestore access)
function getAdminFirestore() {
  if (!getApps().length) {
    // Use application default credentials or service account
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    } catch {
      // Already initialized or missing credentials — fall through
      try { initializeApp(); } catch { /* already initialized */ }
    }
  }
  return getFirestore();
}

/**
 * POST /api/action-board/on-complete
 *
 * Triggered when a task moves to "Done". Parses the configured automations
 * and dispatches emails via Gmail API / Slack webhooks.
 *
 * Request body:
 *   task: { title, description, priority, assignedToEmail, assignedToName, createdByEmail, createdByName, completedAt }
 *   automations: { emails?: string[], slackWebhook?: string, slackChannel?: string, googleAction?: string }
 *   userId?: string  (for server-side refresh token lookup)
 */

export async function POST(req: Request) {
  try {
    const { task, automations, userId } = await req.json();

    if (!task || !automations) {
      return NextResponse.json({ error: "Missing task or automations" }, { status: 400 });
    }

    const results: { type: string; status: string; error?: string }[] = [];

    // Look up refresh token server-side from Firestore (secure — never sent from client)
    let refreshToken: string | null = null;
    if (userId) {
      try {
        const adminDb = getAdminFirestore();
        const userDoc = await adminDb.collection("users").doc(userId).get();
        const userData = userDoc.data();
        refreshToken = userData?.googleRefreshToken || userData?.google?.refreshToken || null;
      } catch (err) {
        console.warn("[ActionBoard/on-complete] Could not look up refresh token:", err);
      }
    }

    // ── 1. Email Notifications via Gmail API ──
    if (automations.emails && automations.emails.length > 0 && refreshToken) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        for (const email of automations.emails) {
          const trimmed = email.trim();
          if (!trimmed) continue;

          const subject = `✅ Task Completed: ${task.title}`;
          const body = [
            `Hi,`,
            ``,
            `A task has been completed on the Action Board.`,
            ``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📋 Task: ${task.title}`,
            task.description ? `📝 Description: ${task.description}` : null,
            `⚡ Priority: ${task.priority}`,
            `👤 Assigned to: ${task.assignedToName || task.assignedToEmail}`,
            `🔧 Created by: ${task.createdByName || task.createdByEmail}`,
            task.completedAt ? `✅ Completed: ${new Date(task.completedAt).toLocaleString("en-US", { timeZone: "America/Denver" })}` : `✅ Completed: Just now`,
            task.isLate ? `⚠️ Status: Completed Late` : `🎯 Status: Completed On Time`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `— SOL Theory Action Board`,
          ]
            .filter(Boolean)
            .join("\n");

          const rawEmail = [
            `To: ${trimmed}`,
            `Subject: ${subject}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            body,
          ].join("\n");

          const encodedMessage = Buffer.from(rawEmail)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedMessage },
          });

          results.push({ type: "email", status: "sent" });
        }
      } catch (err: any) {
        console.error("[ActionBoard/on-complete] Email error:", err.message);
        results.push({ type: "email", status: "error", error: err.message });
      }
    }

    // ── 2. Slack Webhook ──
    if (automations.slackWebhook) {
      try {
        const slackPayload = {
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: `✅ Task Completed: ${task.title}`, emoji: true },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Priority:*\n${task.priority}` },
                { type: "mrkdwn", text: `*Status:*\n${task.isLate ? "⚠️ Late" : "🎯 On Time"}` },
                { type: "mrkdwn", text: `*Assigned to:*\n${task.assignedToName || task.assignedToEmail}` },
                { type: "mrkdwn", text: `*Created by:*\n${task.createdByName || task.createdByEmail}` },
              ],
            },
            ...(task.description
              ? [
                  {
                    type: "section",
                    text: { type: "mrkdwn", text: `*Description:*\n${task.description}` },
                  },
                ]
              : []),
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `📅 Completed: ${task.completedAt ? new Date(task.completedAt).toLocaleString("en-US", { timeZone: "America/Denver" }) : "Just now"} | SOL Theory Action Board`,
                },
              ],
            },
          ],
        };

        // If a channel is specified, add it
        if (automations.slackChannel) {
          (slackPayload as any).channel = automations.slackChannel;
        }

        const slackRes = await fetch(automations.slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload),
        });

        if (slackRes.ok) {
          results.push({ type: "slack", status: "sent" });
        } else {
          const errText = await slackRes.text();
          console.error("[ActionBoard/on-complete] Slack error:", errText);
          results.push({ type: "slack", status: "error", error: errText });
        }
      } catch (err: any) {
        console.error("[ActionBoard/on-complete] Slack error:", err.message);
        results.push({ type: "slack", status: "error", error: err.message });
      }
    }

    // ── 3. Google Suite Actions ──
    if (automations.googleAction && refreshToken) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        if (automations.googleAction === "calendar_event") {
          const calendar = google.calendar({ version: "v3", auth: oauth2Client });

          const now = new Date();
          const end = new Date(now.getTime() + 30 * 60000); // 30 min event

          await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
              summary: `✅ Completed: ${task.title}`,
              description: [
                `Task completed on the Action Board.`,
                task.description ? `\nDescription: ${task.description}` : "",
                `\nPriority: ${task.priority}`,
                `Assigned to: ${task.assignedToName || task.assignedToEmail}`,
                `Created by: ${task.createdByName || task.createdByEmail}`,
              ].join(""),
              start: { dateTime: now.toISOString() },
              end: { dateTime: end.toISOString() },
              colorId: "10", // Basil (green)
            },
          });

          results.push({ type: "google_calendar", status: "created" });
        } else if (automations.googleAction === "draft_email") {
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          const subject = `✅ Task Completed: ${task.title}`;
          const body = `Task "${task.title}" has been completed.\n\nPriority: ${task.priority}\nAssigned to: ${task.assignedToName || task.assignedToEmail}\nCreated by: ${task.createdByName || task.createdByEmail}`;

          const rawEmail = [
            `Subject: ${subject}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            body,
          ].join("\n");

          const encodedMessage = Buffer.from(rawEmail)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          await gmail.users.drafts.create({
            userId: "me",
            requestBody: { message: { raw: encodedMessage } },
          });

          results.push({ type: "google_draft", status: "created" });
        }
      } catch (err: any) {
        console.error("[ActionBoard/on-complete] Google Suite error:", err.message);
        results.push({ type: "google_suite", status: "error", error: err.message });
      }
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error: any) {
    console.error("[ActionBoard/on-complete] Fatal error:", error.message);
    return NextResponse.json({
      status: "error",
      message: "Automation dispatch failed, but the task was still completed.",
      error: error.message,
    }, { status: 500 });
  }
}
