import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

/**
 * POST /api/sms/webhook
 * Receives incoming SMS from Twilio webhook.
 * Twilio sends form-encoded data, so we parse it from the request.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0");

    console.log(`[SMS Webhook] Incoming: ${from} → ${to}: "${body}" (${messageSid})`);

    if (!to) {
      return new Response("<Response></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    initAdmin();
    const db = getAdminFirestore();

    // Find the user who owns this Twilio number
    const usersSnapshot = await db.collection("users")
      .where("twilioPhoneNumber", "==", to)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.warn(`[SMS Webhook] No user found for number ${to}`);
      return new Response("<Response></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const uid = userDoc.id;

    // Collect media URLs if any
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      if (mediaUrl) mediaUrls.push(mediaUrl);
    }

    // Store the incoming message in Firestore
    await db.collection("users").doc(uid).collection("sms_messages").add({
      sid: messageSid,
      from,
      to,
      body: body || "",
      direction: "inbound",
      mediaUrls,
      createdAt: new Date().toISOString(),
      read: false,
    });

    // Update unread count
    const userRef = db.collection("users").doc(uid);
    const userData = userDoc.data();
    await userRef.update({
      smsUnreadCount: (userData.smsUnreadCount || 0) + 1,
    });

    console.log(`[SMS Webhook] Stored inbound message for user ${uid}`);

    // Return empty TwiML response (no auto-reply)
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err: any) {
    console.error("[SMS Webhook] Error:", err.message);
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
