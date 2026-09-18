import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { initAdmin } from "@/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyRequest } from "@/lib/api-auth";
import { google } from "googleapis";

export const maxDuration = 300; // Vercel timeout protection

const CRON_SECRET = process.env.CRON_SECRET || "";
const COOLDOWN_HOURS = 20; // Don't send nudges more than once every 20 hours per user unless forced

function verifyCronAuth(req: Request): boolean {
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

// ── Email Builder ─────────────────────────────────────────────────────────────

function buildBobbyNudgeEmail(params: {
  userName: string;
  roleName: string;
  orgId: string;
  orgName: string;
  overdueTasks: Array<{ title: string; dueDate?: string; requiresDoc?: boolean }>;
  upcomingTasks: Array<{ title: string; dueDate?: string; requiresDoc?: boolean }>;
}): { subject: string; html: string } {
  const { userName, roleName, orgId, orgName, overdueTasks, upcomingTasks } = params;
  const firstName = userName.split(" ")[0] || userName;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com";
  const roadmapUrl = `${appUrl}/portal/dashboard/${orgId}/onboarding`;

  const hasOverdue = overdueTasks.length > 0;
  const subject = hasOverdue
    ? `👋 Quick check-in from Bobby — items to wrap up for ${roleName} onboarding`
    : `⏰ Friendly nudge from Bobby: upcoming milestones for ${roleName}`;

  const overdueListHtml = overdueTasks.map(t => `
    <li style="margin-bottom: 8px; color: #b91c1c; font-size: 14px;">
      <strong>⚠️ ${t.title}</strong>
      ${t.requiresDoc ? '<span style="display:inline-block; font-size:11px; background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; margin-left:6px;">Upload Required</span>' : ''}
    </li>
  `).join("");

  const upcomingListHtml = upcomingTasks.map(t => `
    <li style="margin-bottom: 8px; color: #334155; font-size: 14px;">
      <strong>📅 ${t.title}</strong>
      ${t.requiresDoc ? '<span style="display:inline-block; font-size:11px; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:12px; margin-left:6px;">Document Pending</span>' : ''}
    </li>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 17px; font-weight: 700; margin-bottom: 12px; color: #0f172a; }
    .intro { font-size: 14px; color: #475569; margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 20px; margin-bottom: 10px; }
    .list-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
    .btn-container { text-align: center; margin: 32px 0 24px; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
    .footer { border-top: 1px solid #f1f5f9; padding: 24px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
    .bobby-signoff { display: flex; align-items: center; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px dashed #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🛠️ Workflow Check-in</h1>
      <p>${orgName} • Onboarding Roadmap</p>
    </div>
    <div class="content">
      <div class="greeting">Hey ${firstName}! 👋</div>
      <div class="intro">
        Bobby here — your workflow partner. I'm keeping tabs on your onboarding roadmap to help you stay ahead of your milestones. Here is a quick snapshot of what needs your attention:
      </div>

      ${hasOverdue ? `
        <div class="section-title" style="color:#b91c1c;">Needs Attention (Overdue)</div>
        <div class="list-box" style="border-color:#fecaca; background:#fff5f5;">
          <ul style="margin:0; padding-left: 20px;">
            ${overdueListHtml}
          </ul>
        </div>
      ` : ''}

      ${upcomingTasks.length > 0 ? `
        <div class="section-title">Coming Up Soon</div>
        <div class="list-box">
          <ul style="margin:0; padding-left: 20px;">
            ${upcomingListHtml}
          </ul>
        </div>
      ` : ''}

      <div class="btn-container">
        <a href="${roadmapUrl}" class="btn">Open Your Onboarding Roadmap &rarr;</a>
      </div>

      <div class="bobby-signoff">
        <div>
          <div style="font-weight: 700; font-size: 14px; color: #1e293b;">Bobby</div>
          <div style="font-size: 12px; color: #64748b;">Workflow Maestro @ ${orgName}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Got questions? Ask JARVIS anytime on your dashboard!</div>
        </div>
      </div>
    </div>
    <div class="footer">
      Sent automatically by INSiGHT Onboarding Engine for ${orgName}.
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

// ── Main Handler ─────────────────────────────────────────────────────────────

async function handleNudges(req: NextRequest, isCron = false) {
  try {
    initAdmin();
    const db = getFirestore();

    // Check optional body filters if POST
    let targetOrgId: string | null = null;
    let targetInstanceId: string | null = null;
    let force = false;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        targetOrgId = body.orgId || null;
        targetInstanceId = body.instanceId || null;
        force = Boolean(body.force);
      } catch { /* empty body ok */ }
    } else {
      const { searchParams } = new URL(req.url);
      targetOrgId = searchParams.get("orgId");
      targetInstanceId = searchParams.get("instanceId");
      force = searchParams.get("force") === "true";
    }

    // 1. Query active onboarding instances
    let queryRef = db.collection("onboarding_instances").where("status", "==", "in_progress");
    if (targetOrgId) {
      queryRef = queryRef.where("orgId", "==", targetOrgId);
    }

    const instancesSnap = await queryRef.get();
    let instances = instancesSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() as any }));

    if (targetInstanceId) {
      instances = instances.filter(i => i.id === targetInstanceId);
    }

    if (instances.length === 0) {
      return NextResponse.json({ success: true, message: "No active onboarding instances found", sentCount: 0 });
    }

    const now = Date.now();
    const cooldownMs = COOLDOWN_HOURS * 3600 * 1000;
    const window48h = now + 48 * 3600 * 1000;

    const results = [];
    let sentCount = 0;

    for (const inst of instances) {
      // Cooldown check unless force is true
      if (!force && inst.lastNudgeSentAt) {
        const lastSent = inst.lastNudgeSentAt.toDate ? inst.lastNudgeSentAt.toDate().getTime() : new Date(inst.lastNudgeSentAt).getTime();
        if (now - lastSent < cooldownMs) {
          results.push({ instanceId: inst.id, userName: inst.userName, status: "skipped_cooldown" });
          continue;
        }
      }

      // 2. Fetch tasks for this instance
      const tasksSnap = await db.collection("action_board_tasks")
        .where("metadata.onboardingInstanceId", "==", inst.id)
        .get();

      const incompleteTasks = tasksSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(t => t.column !== "done");

      const overdueTasks: Array<{ title: string; dueDate?: string; requiresDoc?: boolean }> = [];
      const upcomingTasks: Array<{ title: string; dueDate?: string; requiresDoc?: boolean }> = [];

      for (const t of incompleteTasks) {
        if (!t.dueDate) continue;
        const dueMs = t.dueDate.toDate ? t.dueDate.toDate().getTime() : new Date(t.dueDate).getTime();
        const requiresDoc = Boolean(t.metadata?.requiresDocumentUpload);

        if (dueMs < now) {
          overdueTasks.push({ title: t.title, requiresDoc });
        } else if (dueMs <= window48h) {
          upcomingTasks.push({ title: t.title, requiresDoc });
        }
      }

      // If no tasks need a nudge, skip
      if (overdueTasks.length === 0 && upcomingTasks.length === 0) {
        results.push({ instanceId: inst.id, userName: inst.userName, status: "no_nudges_needed" });
        continue;
      }

      // 3. Resolve Gmail OAuth refresh token
      // Check initiator user doc first, then fallback to any admin
      let refreshToken: string | null = null;
      let senderEmail = "me";

      if (inst.initiatedBy) {
        const initiatorSnap = await db.collection("users").doc(inst.initiatedBy).get();
        if (initiatorSnap.exists) {
          const uData = initiatorSnap.data();
          refreshToken =
            uData?.gmailOAuth_jarvis?.refreshToken ||
            uData?.gmailOAuth_campaigning?.refreshToken ||
            uData?.gmailOAuth?.refreshToken ||
            uData?.gmailOAuth_email?.refreshToken ||
            null;
          if (uData?.email) senderEmail = uData.email;
        }
      }

      // Fallback: Check org users collection for an admin with connected Gmail
      if (!refreshToken) {
        const usersSnap = await db.collection("users").limit(15).get();
        for (const uDoc of usersSnap.docs) {
          const uData = uDoc.data();
          const token =
            uData?.gmailOAuth_jarvis?.refreshToken ||
            uData?.gmailOAuth_campaigning?.refreshToken ||
            uData?.gmailOAuth?.refreshToken ||
            null;
          if (token) {
            refreshToken = token;
            if (uData?.email) senderEmail = uData.email;
            break;
          }
        }
      }

      if (!refreshToken) {
        results.push({ instanceId: inst.id, userName: inst.userName, status: "error_no_gmail_token" });
        continue;
      }

      // 4. Send email via Google Gmail API
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const emailData = buildBobbyNudgeEmail({
          userName: inst.userName,
          roleName: inst.roleName,
          orgId: inst.orgId,
          orgName: inst.orgId === "nxtchapter" ? "NXT Chapter" : "SOLTheory",
          overdueTasks,
          upcomingTasks,
        });

        // MIME message encoding
        const mimeMessage = [
          `MIME-Version: 1.0`,
          `To: ${inst.userEmail}`,
          `Subject: =?UTF-8?B?${Buffer.from(emailData.subject, "utf-8").toString("base64")}?=`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          ``,
          Buffer.from(emailData.html, "utf-8").toString("base64"),
        ].join("\r\n");

        const encodedMessage = Buffer.from(mimeMessage)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const sendRes = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encodedMessage },
        });

        // Update instance timestamp
        await inst.ref.update({
          lastNudgeSentAt: FieldValue.serverTimestamp(),
          nudgeCount: FieldValue.increment(1),
          lastNudgeMessageId: sendRes.data.id || null,
        });

        sentCount++;
        results.push({
          instanceId: inst.id,
          userName: inst.userName,
          userEmail: inst.userEmail,
          status: "sent",
          messageId: sendRes.data.id,
          overdueCount: overdueTasks.length,
          upcomingCount: upcomingTasks.length,
        });
      } catch (sendErr: any) {
        console.error(`[Bobby Nudge Error] Failed for ${inst.userName}:`, sendErr);
        results.push({ instanceId: inst.id, userName: inst.userName, status: "error", error: sendErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalChecked: instances.length,
      results,
    });
  } catch (err: any) {
    console.error("[Nudge Cron Exception]:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// GET: Cron runner
export async function GET(req: NextRequest) {
  const isAuthorized = verifyCronAuth(req);
  if (!isAuthorized && process.env.NODE_ENV === "production" && CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleNudges(req, true);
}

// POST: Admin trigger / Manual nudge
export async function POST(req: NextRequest) {
  // Allow CRON_SECRET or user auth
  const isCronAuth = verifyCronAuth(req);
  if (!isCronAuth) {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
  }
  return handleNudges(req, false);
}
