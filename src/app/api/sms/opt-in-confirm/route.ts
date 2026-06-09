import { NextResponse } from "next/server";
import twilio from "twilio";

/**
 * POST /api/sms/opt-in-confirm
 * Sends a confirmation SMS to a newly opted-in user.
 * This is called immediately after the opt-in form is submitted.
 * 
 * Body: { phone: string }  (10-digit US phone)
 *
 * The confirmation message matches EXACTLY what is registered
 * in the A2P 10DLC campaign:
 *   "SOLTheory: You are now opted in to receive messages.
 *    For help, reply HELP. To stop, reply STOP.
 *    Msg and data rates may apply."
 */
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "A valid 10-digit phone number is required." },
        { status: 400 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error("[Opt-In Confirm] Missing Twilio credentials");
      return NextResponse.json(
        { error: "SMS service is not configured." },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    // Normalize to E.164 format
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10) digits = "1" + digits;
    const normalizedTo = "+" + digits;

    // The confirmation message — MUST match the A2P campaign registration exactly
    const confirmationMessage =
      "SOLTheory: You are now opted in to receive messages. For help, reply HELP. To stop, reply STOP. Msg and data rates may apply.";

    let sent: any;

    // Strategy 1: Use Messaging Service SID (A2P compliant)
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      try {
        sent = await client.messages.create({
          body: confirmationMessage,
          to: normalizedTo,
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        });
        console.log(
          `[Opt-In Confirm] Sent via MessagingService → ${normalizedTo}: ${sent.sid}`
        );
      } catch (msErr: any) {
        console.warn(
          `[Opt-In Confirm] Messaging Service failed: ${msErr.message}. Trying direct...`
        );
      }
    }

    // Strategy 2: Use the default Twilio number from env
    if (!sent && process.env.TWILIO_PHONE_NUMBER) {
      try {
        sent = await client.messages.create({
          body: confirmationMessage,
          to: normalizedTo,
          from: process.env.TWILIO_PHONE_NUMBER,
        });
        console.log(
          `[Opt-In Confirm] Sent via env TWILIO_PHONE_NUMBER → ${normalizedTo}: ${sent.sid}`
        );
      } catch (directErr: any) {
        console.warn(
          `[Opt-In Confirm] Env phone number failed: ${directErr.message}. Trying account numbers...`
        );
      }
    }

    // Strategy 3: List Twilio account phone numbers and use the first one
    if (!sent) {
      try {
        const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 1 });
        if (incomingNumbers.length > 0) {
          const fromNumber = incomingNumbers[0].phoneNumber;
          sent = await client.messages.create({
            body: confirmationMessage,
            to: normalizedTo,
            from: fromNumber,
          });
          console.log(
            `[Opt-In Confirm] Sent via account number ${fromNumber} → ${normalizedTo}: ${sent.sid}`
          );
        }
      } catch (acctErr: any) {
        console.error(
          `[Opt-In Confirm] Account number fallback failed: ${acctErr.message}`
        );
      }
    }

    if (!sent) {
      console.error("[Opt-In Confirm] All sending strategies failed.");
      return NextResponse.json(
        { error: "Failed to send confirmation SMS. No available sending method." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Confirmation SMS sent to ${normalizedTo}`,
      sid: sent.sid,
    });
  } catch (err: any) {
    console.error("[Opt-In Confirm] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
