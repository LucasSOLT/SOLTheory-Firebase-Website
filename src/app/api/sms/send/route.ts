import { NextResponse } from "next/server";
import twilio from "twilio";

/**
 * POST /api/sms/send
 * Send an SMS via Twilio Messaging Service (A2P compliant).
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

    // Use Messaging Service SID for A2P compliance, fall back to direct 'from' number
    const msgParams: any = {
      body: message,
      to: normalizedTo,
    };

    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      msgParams.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    } else if (from) {
      msgParams.from = from;
    } else {
      return NextResponse.json({ error: "No messaging service or 'from' number configured." }, { status: 400 });
    }

    const sent = await client.messages.create(msgParams);

    console.log(`[SMS Send] → ${normalizedTo}: ${sent.sid} (status: ${sent.status})`);

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
