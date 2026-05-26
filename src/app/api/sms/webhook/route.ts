import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, limit } from "firebase/firestore";

// Client-side Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Use a named app to avoid conflicts with other Firebase instances
const WEBHOOK_APP_NAME = "sms-webhook";

function getWebhookApp() {
  try {
    return getApp(WEBHOOK_APP_NAME);
  } catch {
    return initializeApp(firebaseConfig, WEBHOOK_APP_NAME);
  }
}

/**
 * POST /api/sms/webhook
 * Twilio inbound SMS webhook. Receives messages and stores them in Firestore.
 * Uses Firebase Client SDK with security rules that allow inbound message creation.
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
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    const app = getWebhookApp();
    const db = getFirestore(app);

    console.log(`[SMS Webhook] Firebase app initialized with project: ${firebaseConfig.projectId}`);

    // Find the user who owns this Twilio number
    const q = query(collection(db, "users"), where("twilioPhoneNumber", "==", to), limit(1));
    const usersSnapshot = await getDocs(q);

    console.log(`[SMS Webhook] User query returned ${usersSnapshot.size} results`);

    if (usersSnapshot.empty) {
      console.warn(`[SMS Webhook] No user found for number ${to}`);
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    const uid = usersSnapshot.docs[0].id;
    console.log(`[SMS Webhook] Found user: ${uid}`);

    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      if (mediaUrl) mediaUrls.push(mediaUrl);
    }

    // Store the incoming message in Firestore
    // Firestore rule allows create when direction == "inbound" (no auth required)
    const docRef = await addDoc(collection(db, "users", uid, "sms_messages"), {
      sid: messageSid,
      from,
      to,
      body: body || "",
      direction: "inbound",
      mediaUrls,
      createdAt: new Date().toISOString(),
      read: false,
    });

    console.log(`[SMS Webhook] Stored inbound message ${docRef.id} for user ${uid}`);

    // Return empty TwiML response
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  } catch (err: any) {
    console.error("[SMS Webhook] Error:", err.message, err.stack);
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }
}
