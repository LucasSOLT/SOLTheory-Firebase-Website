import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore } from "@/firebase/admin";

/**
 * /api/notifications — the signed-in user's persistent notifications.
 * Reads/writes only `users/{auth.uid}/notifications`, so a user can never touch
 * someone else's notifications. Creation happens server-side (see @/lib/notifications).
 *
 *   GET    ?limit=100            → { notifications: AppNotification[], unread: number }
 *   PATCH  { ids?: string[], all?: true }   → mark as read
 *   DELETE { ids?: string[], all?: true }   → delete
 */

const MAX_LIMIT = 200;

function userNotifications(uid: string) {
  initAdmin();
  return getFirestore().collection("users").doc(uid).collection("notifications");
}

export async function GET(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), MAX_LIMIT);
    const snap = await userNotifications(auth.uid).orderBy("createdAt", "desc").limit(limit).get();
    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const unread = notifications.filter((n: any) => !n.read).length;
    return NextResponse.json({ notifications, unread });
  } catch (error: any) {
    console.error("[Notifications API] GET failed:", error?.message || error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

async function resolveTargets(uid: string, body: any) {
  const col = userNotifications(uid);
  if (body?.all === true) {
    const snap = await col.limit(500).get();
    return snap.docs.map((d) => d.ref);
  }
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown) => typeof id === "string" && id.length > 0 && !id.includes("/")).slice(0, 500)
    : [];
  return ids.map((id) => col.doc(id));
}

export async function PATCH(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const refs = await resolveTargets(auth.uid, body);
    if (refs.length === 0) return NextResponse.json({ success: true, updated: 0 });
    const batch = getFirestore().batch();
    // set+merge (not update) so a stale id in the request can't fail the whole batch
    refs.forEach((ref) => batch.set(ref, { read: true }, { merge: true }));
    await batch.commit();
    return NextResponse.json({ success: true, updated: refs.length });
  } catch (error: any) {
    console.error("[Notifications API] PATCH failed:", error?.message || error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const refs = await resolveTargets(auth.uid, body);
    if (refs.length === 0) return NextResponse.json({ success: true, deleted: 0 });
    const batch = getFirestore().batch();
    refs.forEach((ref) => batch.delete(ref));
    await batch.commit();
    return NextResponse.json({ success: true, deleted: refs.length });
  } catch (error: any) {
    console.error("[Notifications API] DELETE failed:", error?.message || error);
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
  }
}
