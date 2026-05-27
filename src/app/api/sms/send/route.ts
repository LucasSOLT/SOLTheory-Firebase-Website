import { NextResponse } from "next/server";
import twilio from "twilio";

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
