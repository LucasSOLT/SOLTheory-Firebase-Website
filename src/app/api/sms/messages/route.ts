import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";

/**
 * POST /api/sms/messages
 * List SMS messages for a user, optionally filtered by contact number.
 * Body: { uid, contact?, limit?, direction? }
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { uid, contact, limit = 50, direction } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    initAdmin();
    const db = getAdminFirestore();

    let query = db.collection("users").doc(uid).collection("sms_messages")
      .orderBy("createdAt", "desc")
      .limit(limit);

    const snapshot = await query.get();

    let messages = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        sid: data.sid,
        from: data.from,
        to: data.to,
        body: data.body,
        direction: data.direction,
        status: data.status,
        mediaUrls: data.mediaUrls || [],
        createdAt: data.createdAt,
        read: data.read !== false,
      };
    });

    // Client-side filtering by contact (since Firestore can't OR query from/to)
    if (contact) {
      const normalizedContact = contact.replace(/[^+\d]/g, "");
      messages = messages.filter(
        (m) =>
          m.from.includes(normalizedContact) ||
          m.to.includes(normalizedContact)
      );
    }

    if (direction) {
      messages = messages.filter((m) => m.direction === direction);
    }

    // Group messages by conversation (contact number)
    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error("[SMS Messages] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
