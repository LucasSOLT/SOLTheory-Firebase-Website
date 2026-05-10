import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * POST /api/sms/webhook
 * Receives incoming SMS from Twilio webhook.
 * Twilio sends form-encoded data.
 * 
 * This uses Admin SDK because it runs server-side on Vercel (not client-side).
 * For local dev, use ngrok to tunnel localhost to a public URL.
 */

function getAdminDb() {
  if (!getApps().length) {
    // On Vercel, use env-based service account credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      // Fallback: try application default credentials
      initializeApp();
    }
  }
  return getFirestore();
}

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

    const db = getAdminDb();

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
