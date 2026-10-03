/**
 * notifications.ts — Persistent in-app notification system (SERVER-ONLY)
 * ────────────────────────────────────────────────────────────────
 * Notifications are stored at `users/{uid}/notifications/{id}` and written only
 * from server code via the Admin SDK. Clients read/update them through the
 * authenticated `/api/notifications` route, so no Firestore client rules are needed.
 *
 * Design rules:
 *  - NEVER throw from these helpers. A failed notification must not break the
 *    action that triggered it (assigning a task, saving a timesheet, etc).
 *  - Use `dedupeKey` for anything that could fire more than once (re-saves,
 *    multiple browser tabs running the grant worker, retries). The key becomes
 *    the document id, and existing documents are never overwritten.
 *  - The actor is never notified about their own action.
 */

import { initAdmin, getFirestore } from "@/firebase/admin";
import { sendPushToUser } from "@/lib/fcm-notify";
import { ORG_REGISTRY } from "@/lib/org-config";

export type NotificationType =
  | "action_board_assigned"
  | "onboarding_assigned"
  | "onboarding_phase_completed"
  | "onboarding_document_completed"
  | "onboarding_blueprint_completed"
  | "timesheet_entry"
  | "grant_found"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  orgId?: string;
  /** Id of the related record (task id, grant id, timesheet entry id, ...) */
  refId?: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: number;
  read: boolean;
}

export interface CreateNotificationParams {
  recipientUids?: string[];
  recipientEmails?: string[];
  /** Actor's uid/email — always excluded from recipients */
  actorUid?: string;
  actorEmail?: string;
  actorName?: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  orgId?: string;
  refId?: string;
  /** Stable key to prevent duplicates (becomes part of the doc id per recipient) */
  dedupeKey?: string;
  /** Also send a phone/desktop push notification (only to users who opted in) */
  push?: boolean;
}

function db() {
  initAdmin();
  return getFirestore();
}

/** Firestore doc ids cannot contain "/" and should stay reasonably short */
function toDocId(key: string): string {
  return key.replace(/[\/\s#?\[\]]+/g, "_").substring(0, 300);
}

/** Resolve user emails to Firebase uids (Firestore `in` queries max out at 30 values) */
export async function resolveUidsByEmail(emails: string[]): Promise<string[]> {
  const unique = Array.from(new Set(emails.filter(Boolean).map((e) => e.toLowerCase().trim())));
  if (unique.length === 0) return [];
  const uids: string[] = [];
  try {
    const firestore = db();
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      const snap = await firestore.collection("users").where("email", "in", chunk).get();
      snap.forEach((d) => uids.push(d.id));
    }
  } catch (e) {
    console.warn("[notifications] resolveUidsByEmail failed:", e);
  }
  return uids;
}

/**
 * All admins for an org: Firestore role-based members (admin/oracle) plus the
 * static adminEmails list in ORG_REGISTRY.
 */
export async function getOrgAdminUids(orgId: string): Promise<string[]> {
  const uids = new Set<string>();
  try {
    const snap = await db()
      .collection("orgs").doc(orgId).collection("members")
      .where("role", "in", ["admin", "oracle"])
      .get();
    snap.forEach((d) => uids.add(d.id));
  } catch (e) {
    console.warn(`[notifications] getOrgAdminUids(${orgId}) member query failed:`, e);
  }
  const registryEmails = ORG_REGISTRY[orgId]?.adminEmails || [];
  (await resolveUidsByEmail(registryEmails)).forEach((u) => uids.add(u));
  return Array.from(uids);
}

/**
 * Create one notification per recipient. Safe to call from any server route —
 * it never throws and returns the number of notifications actually created.
 */
export async function createNotification(params: CreateNotificationParams): Promise<number> {
  try {
    const firestore = db();
    const fromEmails = await resolveUidsByEmail(params.recipientEmails || []);
    let recipients = Array.from(new Set([...(params.recipientUids || []), ...fromEmails].filter(Boolean)));

    // Never notify someone about their own action
    if (params.actorUid) recipients = recipients.filter((u) => u !== params.actorUid);
    if (params.actorEmail) {
      const actorUids = await resolveUidsByEmail([params.actorEmail]);
      recipients = recipients.filter((u) => !actorUids.includes(u));
    }
    if (recipients.length === 0) return 0;

    const createdAt = Date.now();
    let created = 0;

    await Promise.all(recipients.map(async (uid) => {
      const col = firestore.collection("users").doc(uid).collection("notifications");
      const ref = params.dedupeKey ? col.doc(toDocId(params.dedupeKey)) : col.doc();
      const data: Omit<AppNotification, "id"> = {
        type: params.type,
        title: params.title,
        body: params.body,
        createdAt,
        read: false,
        ...(params.link ? { link: params.link } : {}),
        ...(params.orgId ? { orgId: params.orgId } : {}),
        ...(params.refId ? { refId: params.refId } : {}),
        ...(params.actorEmail ? { actorEmail: params.actorEmail } : {}),
        ...(params.actorName ? { actorName: params.actorName } : {}),
      };
      try {
        // .create() fails if the doc exists → dedupeKey prevents duplicate notifications
        await ref.create(data);
        created++;
        if (params.push) {
          sendPushToUser(uid, {
            title: params.title,
            body: params.body,
            url: params.link,
            tag: params.dedupeKey ? toDocId(params.dedupeKey) : undefined,
            type: "system",
          }).catch((e) => console.warn("[notifications] push failed:", e));
        }
      } catch (e: any) {
        // gRPC code 6 = ALREADY_EXISTS (duplicate dedupeKey) — expected, ignore
        if (e?.code !== 6) console.warn(`[notifications] write failed for ${uid}:`, e?.message || e);
      }
    }));

    if (created > 0) console.log(`[notifications] ${params.type}: created ${created} notification(s)`);
    return created;
  } catch (e) {
    console.warn("[notifications] createNotification failed:", e);
    return 0;
  }
}

/** Dashboard base path for links inside notifications */
export function dashboardPath(orgId: string, sub = ""): string {
  return `/portal/dashboard/${orgId}${sub ? `/${sub.replace(/^\//, "")}` : ""}`;
}
