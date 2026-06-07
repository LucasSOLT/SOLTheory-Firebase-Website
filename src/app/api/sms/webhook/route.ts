import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, limit, updateDoc, doc } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp as initAdmin, cert, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// Use a named app to avoid conflicts with other Firebase instances
const WEBHOOK_APP_NAME = "sms-webhook";

function getWebhookApp() {
  try {
    return getApp(WEBHOOK_APP_NAME);
  } catch {
    return initializeApp(firebaseConfig, WEBHOOK_APP_NAME);
  }
}

function ensureAdmin() {
  if (getAdminApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
    const serviceAccount = JSON.parse(raw);
    initAdmin({ credential: cert(serviceAccount) });
  }
}

// Opt-out keywords per CTIA guidelines
const OPT_OUT_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "revoke"];
const OPT_IN_KEYWORDS = ["start", "yes"];
const HELP_KEYWORDS = ["help", "info"];

/**
 * POST /api/sms/webhook
 * Twilio inbound SMS webhook. Receives messages and stores them in Firestore.
 * Handles STOP/HELP keywords for A2P compliance.
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

    // Find the user who owns this Twilio number
    const q = query(collection(db, "users"), where("twilioPhoneNumber", "==", to), limit(1));
    const usersSnapshot = await getDocs(q);

    if (usersSnapshot.empty) {
      console.warn(`[SMS Webhook] No user found for number ${to}`);
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    const uid = usersSnapshot.docs[0].id;

    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      if (mediaUrl) mediaUrls.push(mediaUrl);
    }

    // Store the incoming message
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

    // --- Handle STOP / HELP keywords for A2P compliance ---
    const normalizedBody = (body || "").trim().toLowerCase();
    const senderDigits = from.replace(/\D/g, "");
    const tenDigit = senderDigits.length === 11 && senderDigits.startsWith("1")
      ? senderDigits.slice(1) : senderDigits;

    if (OPT_OUT_KEYWORDS.includes(normalizedBody)) {
      console.log(`[SMS Webhook] OPT-OUT received from ${from}. Updating sms_optins...`);
      try {
        ensureAdmin();
        const adminDb = getAdminFirestore();

        // Update sms_optins collection
        const optinsSnap = await adminDb.collection("sms_optins")
          .where("phone", "==", tenDigit)
          .get();

        const batch = adminDb.batch();
        optinsSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            optedOut: true,
            optOutTimestamp: new Date(),
            optOutKeyword: normalizedBody,
          });
        });

        // Also update any user doc with matching phone
        const usersAdminSnap = await adminDb.collection("users")
          .where("phone", "==", tenDigit)
          .get();

        usersAdminSnap.docs.forEach((d) => {
          batch.update(d.ref, { sms_opt_in: false });
        });

        await batch.commit();
        console.log(`[SMS Webhook] Opt-out processed for ${tenDigit}. Updated ${optinsSnap.size} opt-in records, ${usersAdminSnap.size} user records.`);
      } catch (optOutErr: any) {
        console.error(`[SMS Webhook] Error processing opt-out: ${optOutErr.message}`);
      }

      // Return the exact opt-out confirmation from A2P registration
      const optOutMsg = "You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.";
      return new Response(
        `<Response><Message>${optOutMsg}</Message></Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // --- Handle START / YES opt-in keywords ---
    if (OPT_IN_KEYWORDS.includes(normalizedBody)) {
      console.log(`[SMS Webhook] OPT-IN received from ${from}. Re-activating...`);
      try {
        ensureAdmin();
        const adminDb = getAdminFirestore();

        const optinsSnap = await adminDb.collection("sms_optins")
          .where("phone", "==", tenDigit)
          .get();

        const batch = adminDb.batch();
        optinsSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            optedOut: false,
            sms_opt_in: true,
            reOptInTimestamp: new Date(),
            reOptInKeyword: normalizedBody,
          });
        });

        const usersAdminSnap = await adminDb.collection("users")
          .where("phone", "==", tenDigit)
          .get();

        usersAdminSnap.docs.forEach((d) => {
          batch.update(d.ref, { sms_opt_in: true });
        });

        await batch.commit();
        console.log(`[SMS Webhook] Opt-in re-activated for ${tenDigit}.`);
      } catch (optInErr: any) {
        console.error(`[SMS Webhook] Error processing opt-in: ${optInErr.message}`);
      }

      const optInMsg = "SOLTheory: You are now opted in to receive messages. For help, reply HELP. To stop, reply STOP. Msg & data rates may apply.";
      return new Response(
        `<Response><Message>${optInMsg}</Message></Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    if (HELP_KEYWORDS.includes(normalizedBody)) {
      console.log(`[SMS Webhook] HELP received from ${from}. Sending help response.`);
      const helpText = "SOLTheory Support: For assistance, please email support@soltheory.com. Msg & data rates may apply. Reply STOP to unsubscribe.";
      return new Response(
        `<Response><Message>${helpText}</Message></Response>`,
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  } catch (err: any) {
    console.error("[SMS Webhook] Error:", err.message);
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }
}
