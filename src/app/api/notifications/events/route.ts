import { NextResponse } from "next/server";
import { verifyOrgMember } from "@/lib/api-auth";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { createNotification, getOrgAdminUids, dashboardPath } from "@/lib/notifications";
import { notifyOnboardingTaskCompleted } from "@/lib/onboarding-notifications";

/**
 * POST /api/notifications/events — report a client-side event that should notify people.
 *
 * Body: { event, orgId, refId }
 *
 * The client only says WHAT happened and WHICH record. The server re-reads that record
 * with the Admin SDK and derives recipients + text itself, so notifications can't be
 * forged. Every event uses a dedupeKey, so repeated calls (re-saves, retries, multiple
 * tabs running the grant agent) never create duplicates.
 */

type EventName = "action_board_assigned" | "timesheet_entry" | "grant_found" | "onboarding_task_completed";
const EVENTS: EventName[] = ["action_board_assigned", "timesheet_entry", "grant_found", "onboarding_task_completed"];

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, orgId, refId } = body || {};
  if (!EVENTS.includes(event) || typeof orgId !== "string" || typeof refId !== "string" || !refId || refId.includes("/")) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const auth = await verifyOrgMember(req, orgId);
  if (!auth.ok) return auth.response;

  try {
    initAdmin();
    const db = getFirestore();
    let created = 0;

    switch (event as EventName) {
      // ── Action board task assigned / reassigned ──
      case "action_board_assigned": {
        const snap = await db.collection("action_board_tasks").doc(refId).get();
        if (!snap.exists) break;
        const t = snap.data() || {};
        if (t.orgId && t.orgId !== orgId) break;
        const assigneeUid: string = t.assignedTo || "";
        const assigneeEmail: string = t.assignedToEmail || "";
        if (!assigneeUid && !assigneeEmail) break;
        const pending = t.assignmentStatus === "pending_approval";
        // Credit whoever made the change (a reassignment may not be done by the creator)
        let actorName: string = t.createdByName || t.createdByEmail || "Someone";
        if (t.createdBy !== auth.uid) {
          try {
            const actorDoc = await db.collection("users").doc(auth.uid).get();
            const a = actorDoc.data() || {};
            actorName = a.displayName || a.name || auth.email || "Someone";
          } catch {
            actorName = auth.email || "Someone";
          }
        }
        created = await createNotification({
          // assignedTo may hold an email for external assignees — only treat it as a uid if it isn't one
          recipientUids: assigneeUid && !assigneeUid.includes("@") ? [assigneeUid] : [],
          recipientEmails: assigneeEmail ? [assigneeEmail] : [],
          actorUid: auth.uid,
          actorEmail: auth.email,
          actorName,
          type: "action_board_assigned",
          title: pending ? "New task request" : "New task assigned",
          body: `${actorName} ${pending ? "requested" : "assigned you"} "${t.title || "Untitled task"}"`,
          link: dashboardPath(orgId, "action-board"),
          orgId,
          refId,
          // Key includes the assignee so a REASSIGNMENT notifies the new person
          dedupeKey: `ab-${refId}-${assigneeUid || assigneeEmail}`,
          push: true,
        });
        break;
      }

      // ── Someone logged time → notify org admins ──
      case "timesheet_entry": {
        const snap = await db.collection("timesheet_entries").doc(refId).get();
        if (!snap.exists) break;
        const e = snap.data() || {};
        const who = e.userName || e.userEmail || "A team member";
        const minutes = Number(e.durationMinutes) || 0;
        created = await createNotification({
          recipientUids: await getOrgAdminUids(orgId),
          actorUid: auth.uid,
          actorEmail: e.userEmail || auth.email,
          actorName: who,
          type: "timesheet_entry",
          title: "Time logged",
          body: `${who} logged ${formatMinutes(minutes)}${e.customerName ? ` for ${e.customerName}` : ""}${e.startDate ? ` on ${e.startDate}` : ""}`,
          link: dashboardPath(orgId, "timesheets"),
          orgId,
          refId,
          dedupeKey: `ts-${refId}`,
        });
        break;
      }

      // ── Grant prospecting agent found a grant → notify org admins ──
      case "grant_found": {
        const snap = await db.collection("grant_suggestions").doc(refId).get();
        if (!snap.exists) break;
        const g = snap.data() || {};
        if (g.orgId && g.orgId !== orgId) break;
        created = await createNotification({
          recipientUids: await getOrgAdminUids(orgId),
          type: "grant_found",
          title: "New grant found",
          body: `${g.title || "A new opportunity"}${g.agency ? ` · ${g.agency}` : ""}`,
          link: dashboardPath(orgId, "grant-statuses"),
          orgId,
          refId,
          // One notification per grant, even if several browser tabs run the agent
          dedupeKey: `grant-${refId}`,
        });
        break;
      }

      // ── Onboarding item marked complete from the client ──
      case "onboarding_task_completed": {
        created = await notifyOnboardingTaskCompleted({
          orgId,
          taskId: refId,
          actorUid: auth.uid,
          actorEmail: auth.email,
        });
        break;
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (error: any) {
    console.error(`[Notification Events] ${event} failed:`, error?.message || error);
    // Notifications are best-effort — never surface as a hard failure to the caller
    return NextResponse.json({ success: false, created: 0 });
  }
}
