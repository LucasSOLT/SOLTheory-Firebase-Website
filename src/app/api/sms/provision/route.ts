import { NextResponse } from "next/server";
import twilio from "twilio";

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env.local");
  }
  return twilio(accountSid, authToken);
};

/**
 * POST /api/sms/provision
 * Search for and purchase a Twilio phone number.
 * Firestore persistence is handled client-side.
 * Body: { areaCode? }
 */
export async function POST(req: Request) {
  try {
    const { areaCode } = await req.json();

    const client = getTwilioClient();

    // Search for available numbers
    const searchParams: any = {
      smsEnabled: true,
      mmsEnabled: true,
      voiceEnabled: false,
    };
    if (areaCode) searchParams.areaCode = areaCode;

    const availableNumbers = await client.availablePhoneNumbers("US").local.list({
      ...searchParams,
      limit: 1,
    });

    if (availableNumbers.length === 0) {
      return NextResponse.json(
        { error: "No phone numbers available" + (areaCode ? ` for area code ${areaCode}` : "") + ". Try a different area code." },
        { status: 404 }
      );
    }

    const number = availableNumbers[0];

    // Purchase the number
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: number.phoneNumber,
      smsUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com"}/api/sms/webhook`,
      smsMethod: "POST",
      friendlyName: `SOLTheory Messaging`,
    });

    console.log(`[SMS] Provisioned ${purchased.phoneNumber} (SID: ${purchased.sid})`);

    return NextResponse.json({
      success: true,
      phoneNumber: purchased.phoneNumber,
      phoneSid: purchased.sid,
      message: `Your messaging number ${purchased.phoneNumber} is now active!`,
    });
  } catch (err: any) {
    console.error("[SMS Provision] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
