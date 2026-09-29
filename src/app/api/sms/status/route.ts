import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Twilio Delivery Status Webhook
 * Receives delivery updates from Twilio (queued -> sent -> delivered -> failed).
 * Updates message status in Firestore for true WhatsApp-style double-tick delivery receipts.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string;
    const errorMessage = formData.get("ErrorMessage") as string;

    if (!messageSid || !messageStatus) {
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    console.log(`[Twilio Status] Message ${messageSid} updated to "${messageStatus}"`);

    initAdmin();
    const db = getFirestore();

    // Query across users collectionGroup for sms_messages with this sid
    const messageSnap = await db
      .collectionGroup("sms_messages")
      .where("sid", "==", messageSid)
      .limit(1)
      .get();

    if (!messageSnap.empty) {
      const docRef = messageSnap.docs[0].ref;
      await docRef.update({
        status: messageStatus,
        deliveryUpdatedAt: FieldValue.serverTimestamp(),
        ...(errorCode ? { errorCode, errorMessage } : {}),
      });
    }

    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  } catch (err: any) {
    console.error("[Twilio Status Webhook] Error:", err?.message || err);
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }
}
