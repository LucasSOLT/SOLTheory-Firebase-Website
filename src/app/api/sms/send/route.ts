import { NextResponse } from "next/server";
import twilio from "twilio";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");
    const serviceAccount = JSON.parse(raw);
    initializeApp({ credential: cert(serviceAccount) });
  }
}

/**
 * Check if a phone number has an active SMS opt-in.
 * Looks in the `sms_optins` collection for a matching phone with consentGiven === true.
 * Also checks the `users` collection for sms_opt_in === true on the user doc.
 */
async function hasOptIn(phone: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, "");
  // Normalize: strip leading 1 for US numbers to get 10-digit form
  const tenDigit = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  initAdmin();
  const db = getFirestore();

  // Check sms_optins collection
  const optinsSnap = await db.collection("sms_optins")
    .where("phone", "==", tenDigit)
    .limit(1)
    .get();

  if (!optinsSnap.empty) {
    const doc = optinsSnap.docs[0].data();
    if (doc.consentGiven === true && doc.optedOut !== true) return true;
  }

  // Also check if user doc has sms_opt_in: true (for users who opted in via other flows)
  const usersSnap = await db.collection("users")
    .where("phone", "==", tenDigit)
    .limit(1)
    .get();

  if (!usersSnap.empty) {
    const userData = usersSnap.docs[0].data();
    if (userData.sms_opt_in === true) return true;
  }

  return false;
}

/**
 * POST /api/sms/send
 * Send an SMS via Twilio.
 * Tries Messaging Service first (A2P compliant), falls back to direct number if A2P not approved.
 * Body: { from, to, message }
 */
export async function POST(req: Request) {
  try {
    const { from, to, message } = await req.json();
    if (!to) return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

    // Validate SMS opt-in before sending
    try {
      const recipientOptedIn = await hasOptIn(to);
      if (!recipientOptedIn) {
        console.warn(`[SMS Send] Blocked: ${to} has not opted in to SMS.`);
        return NextResponse.json(
          { error: "Recipient has not opted in to receive SMS messages. They must consent via the SMS Opt-In page first." },
          { status: 403 }
        );
      }
    } catch (optInErr: any) {
      console.warn(`[SMS Send] Opt-in check failed (allowing send): ${optInErr.message}`);
      // If the opt-in check fails (e.g. Firestore error), log but allow the send
      // to avoid blocking legitimate messages due to infrastructure issues
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

    // Normalize phone number
    let normalizedTo = to.replace(/[^+\d]/g, "");
    if (!normalizedTo.startsWith("+")) {
      normalizedTo = "+1" + normalizedTo;
    }

    let sent: any;

    // Strategy 1: Use Messaging Service SID (A2P compliant)
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      try {
        sent = await client.messages.create({
          body: message,
          to: normalizedTo,
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        });
        console.log(`[SMS Send] via MessagingService → ${normalizedTo}: ${sent.sid} (status: ${sent.status})`);
      } catch (msErr: any) {
        console.warn(`[SMS Send] Messaging Service failed: ${msErr.message}. Falling back to direct number...`);
        // Fall through to Strategy 2
      }
    }

    // Strategy 2: Use direct 'from' number (works without A2P approval for testing/low volume)
    if (!sent && from) {
      let normalizedFrom = from.replace(/[^+\d]/g, "");
      if (!normalizedFrom.startsWith("+")) normalizedFrom = "+1" + normalizedFrom;
      
      try {
        sent = await client.messages.create({
          body: message,
          to: normalizedTo,
          from: normalizedFrom,
        });
        console.log(`[SMS Send] via direct number ${normalizedFrom} → ${normalizedTo}: ${sent.sid} (status: ${sent.status})`);
      } catch (directErr: any) {
        console.error(`[SMS Send] Direct number also failed: ${directErr.message}`);
        return NextResponse.json({ 
          error: `SMS sending failed. Messaging Service error may be A2P registration pending. Direct send error: ${directErr.message}` 
        }, { status: 500 });
      }
    }

    if (!sent) {
      return NextResponse.json({ error: "No messaging service or 'from' number configured." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Message sent to ${normalizedTo}`,
      sid: sent.sid,
      to: normalizedTo,
    });
  } catch (err: any) {
    console.error("[SMS Send] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
