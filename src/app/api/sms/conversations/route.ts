import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";

/**
 * POST /api/sms/conversations
 * Get a list of unique conversations (grouped by contact number) for a user.
 * Body: { uid }
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    initAdmin();
    const db = getAdminFirestore();

    // Get user's Twilio number
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const myNumber = userData?.twilioPhoneNumber;

    if (!myNumber) {
      return NextResponse.json({ conversations: [], phoneNumber: null });
    }

    // Get all messages
    const snapshot = await db.collection("users").doc(uid).collection("sms_messages")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    // Group by the "other" party's number
    const convMap = new Map<string, {
      contact: string;
      lastMessage: string;
      lastTime: string;
      direction: string;
      unreadCount: number;
      messageCount: number;
    }>();

    snapshot.docs.forEach((d) => {
      const data = d.data();
      // The "contact" is whoever is NOT us
      const contact = data.direction === "inbound" ? data.from : data.to;

      if (!convMap.has(contact)) {
        convMap.set(contact, {
          contact,
          lastMessage: data.body || (data.mediaUrls?.length ? "📎 Media" : ""),
          lastTime: data.createdAt,
          direction: data.direction,
          unreadCount: 0,
          messageCount: 0,
        });
      }

      const conv = convMap.get(contact)!;
      conv.messageCount++;
      if (data.direction === "inbound" && !data.read) {
        conv.unreadCount++;
      }
    });

    const conversations = Array.from(convMap.values())
      .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());

    return NextResponse.json({
      conversations,
      phoneNumber: myNumber,
    });
  } catch (err: any) {
    console.error("[SMS Conversations] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
