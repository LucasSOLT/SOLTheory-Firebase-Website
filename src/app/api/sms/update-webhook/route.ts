import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { verifyRequest } from "@/lib/api-auth";

/**
 * POST /api/sms/update-webhook
 * Update the SMS webhook URL on a Twilio phone number.
 * Body: { phoneNumber, webhookUrl? }
 */
export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { phoneNumber, webhookUrl } = await req.json();
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

    // Normalize phone number
    let normalized = (phoneNumber || "").replace(/[^+\d]/g, "");
    if (!normalized.startsWith("+")) normalized = "+1" + normalized;

    // Find the phone number SID
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: normalized, limit: 1 });
    if (numbers.length === 0) {
      return NextResponse.json({ error: `Phone number ${normalized} not found in your Twilio account` }, { status: 404 });
    }

    const targetUrl = webhookUrl || "https://soltheory.com/api/sms/webhook";

    // Update the webhook URL
    const updated = await client.incomingPhoneNumbers(numbers[0].sid).update({
      smsUrl: targetUrl,
      smsMethod: "POST",
    });

    console.log(`[SMS Webhook Update] ${updated.phoneNumber} → ${targetUrl}`);

    return NextResponse.json({
      success: true,
      phoneNumber: updated.phoneNumber,
      smsUrl: targetUrl,
      message: `Webhook URL updated to ${targetUrl}`,
    });
  } catch (err: any) {
    console.error("[SMS Webhook Update] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
