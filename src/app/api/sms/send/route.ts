import { NextResponse } from "next/server";
import twilio from "twilio";

/**
 * POST /api/sms/send
 * Send an SMS via Twilio. No Firebase Admin SDK needed.
 * Firestore caching is handled client-side.
 * Body: { from, to, message }
 */
export async function POST(req: Request) {
  try {
    const { from, to, message } = await req.json();
    if (!from) return NextResponse.json({ error: "Missing 'from' number. Set up messaging first." }, { status: 400 });
    if (!to) return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

    // Normalize phone number
    let normalizedTo = to.replace(/[^+\d]/g, "");
    if (!normalizedTo.startsWith("+")) {
      normalizedTo = "+1" + normalizedTo; // Default to US
    }

    const sent = await client.messages.create({
      body: message,
      from,
      to: normalizedTo,
    });

    console.log(`[SMS Send] ${from} → ${normalizedTo}: ${sent.sid}`);

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
