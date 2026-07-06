import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { verifyRequest } from "@/lib/api-auth";

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Trigger-specific content configuration
type EmailTrigger = "assigned" | "in_progress" | "completed" | "overdue";

const TRIGGER_CONFIG: Record<EmailTrigger, { emoji: string; label: string; headerGradient: string; statusLine: string }> = {
  assigned: {
    emoji: "📋",
    label: "Task Assigned",
    headerGradient: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
    statusLine: "A new task has been assigned on the Action Board.",
  },
  in_progress: {
    emoji: "🔄",
    label: "Task In Progress",
    headerGradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    statusLine: "A task has been moved to In Progress on the Action Board.",
  },
  completed: {
    emoji: "✅",
    label: "Task Completed",
    headerGradient: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
    statusLine: "A task has been completed on the Action Board.",
  },
  overdue: {
    emoji: "⚠️",
    label: "Task Overdue",
    headerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    statusLine: "A task is overdue on the Action Board.",
  },
};

/**
 * POST /api/action-board/on-complete
 *
 * Triggered when a task changes state. Sends email notifications via SendGrid
 * based on the configured trigger type.
 *
 * Request body:
 *   task: { title, description, priority, assignedToEmail, assignedToName, createdByEmail, createdByName, completedAt, isLate }
 *   automations: { emails?: string[] }
 *   trigger?: "assigned" | "in_progress" | "completed" | "overdue"
 *   userId?: string
 */

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { task, automations, trigger = "completed", orgId = "soltheory" } = await req.json();

    // Org-specific branding
    const ORG_NAMES: Record<string, string> = {
      soltheory: "SOL Theory",
      nxtchapter: "NXT Chapter",
      lnu: "LifeNavigationU",
    };
    const orgDisplayName = ORG_NAMES[orgId] || "SOL Theory";

    if (!task || !automations) {
      return NextResponse.json({ error: "Missing task or automations" }, { status: 400 });
    }

    const results: { type: string; status: string; error?: string }[] = [];
    const triggerKey = (trigger as EmailTrigger) || "completed";
    const config = TRIGGER_CONFIG[triggerKey] || TRIGGER_CONFIG.completed;

    // ── Email Notifications via SendGrid ──
    if (automations.emails && automations.emails.length > 0) {
      if (!process.env.SENDGRID_API_KEY) {
        console.error("[ActionBoard] SENDGRID_API_KEY not configured");
        results.push({ type: "email", status: "error", error: "SendGrid API key not configured" });
      } else {
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com";
        const fromName = orgDisplayName;

        for (const email of automations.emails) {
          const trimmed = email.trim();
          if (!trimmed) continue;

          try {
            const subject = `${config.emoji} ${config.label}: ${task.title}`;
            const textBody = [
              `Hi,`,
              ``,
              config.statusLine,
              ``,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `📋 Task: ${task.title}`,
              task.description ? `📝 Description: ${task.description}` : null,
              `⚡ Priority: ${task.priority}`,
              `👤 Assigned to: ${task.assignedToName || task.assignedToEmail}`,
              `🔧 Created by: ${task.createdByName || task.createdByEmail}`,
              triggerKey === "completed" && task.completedAt
                ? `✅ Completed: ${new Date(task.completedAt).toLocaleString("en-US", { timeZone: "America/Denver" })}`
                : null,
              triggerKey === "completed"
                ? (task.isLate ? `⚠️ Status: Completed Late` : `🎯 Status: Completed On Time`)
                : null,
              triggerKey === "overdue" ? `⚠️ Status: OVERDUE — action required` : null,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              ``,
              `— ${orgDisplayName} Action Board`,
            ]
              .filter(Boolean)
              .join("\n");

            const statusColor = triggerKey === "overdue" ? "#ef4444" :
                                triggerKey === "completed" ? (task.isLate ? "#f97316" : "#22c55e") :
                                triggerKey === "in_progress" ? "#f59e0b" : "#3b82f6";
            const statusText = triggerKey === "overdue" ? "⚠️ Overdue" :
                               triggerKey === "completed" ? (task.isLate ? "⚠️ Completed Late" : "🎯 On Time") :
                               triggerKey === "in_progress" ? "🔄 In Progress" : "📋 Assigned";

            const htmlBody = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #0A0A0B; color: #e2e8f0; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                <div style="background: ${config.headerGradient}; padding: 28px 32px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.02em;">${config.emoji} ${config.label}</h1>
                </div>
                <div style="padding: 28px 32px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 600; color: #f1f5f9;">${task.title}</h2>
                  ${task.description ? `<p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">${task.description}</p>` : ""}
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Priority</td>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #f1f5f9; font-size: 13px; text-align: right; font-weight: 600;">${task.priority}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Assigned to</td>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #f1f5f9; font-size: 13px; text-align: right;">${task.assignedToName || task.assignedToEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Created by</td>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #f1f5f9; font-size: 13px; text-align: right;">${task.createdByName || task.createdByEmail}</td>
                    </tr>
                    ${triggerKey === "completed" ? `
                    <tr>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Completed</td>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #f1f5f9; font-size: 13px; text-align: right;">${task.completedAt ? new Date(task.completedAt).toLocaleString("en-US", { timeZone: "America/Denver" }) : "Just now"}</td>
                    </tr>` : ""}
                    <tr>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Status</td>
                      <td style="padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); color: ${statusColor}; font-size: 13px; text-align: right; font-weight: 600;">${statusText}</td>
                    </tr>
                  </table>
                </div>
                <div style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
                  <p style="margin: 0; color: #64748b; font-size: 11px;">${orgDisplayName} Action Board</p>
                </div>
              </div>
            `;

            await sgMail.send({
              to: trimmed,
              from: { email: fromEmail, name: fromName },
              subject,
              text: textBody,
              html: htmlBody,
            });

            results.push({ type: "email", status: "sent" });
          } catch (err: any) {
            console.error("[ActionBoard] SendGrid email error:", err?.response?.body || err.message);
            results.push({ type: "email", status: "error", error: err?.response?.body?.errors?.[0]?.message || err.message });
          }
        }
      }
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error: any) {
    console.error("[ActionBoard] Fatal error:", error.message);
    return NextResponse.json({
      status: "error",
      message: "Automation dispatch failed, but the task status was still updated.",
      error: error.message,
    }, { status: 500 });
  }
}
