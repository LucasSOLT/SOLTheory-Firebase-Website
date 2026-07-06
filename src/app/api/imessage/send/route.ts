import { NextResponse } from "next/server";
import { getBlueBubblesConfig } from "../utils";
import { verifyRequest } from "@/lib/api-auth";

/**
 * POST /api/imessage/send
 * Send an iMessage text to a specific chat or phone number.
 * Body: { uid, chatGuid, message }
 * 
 * chatGuid formats:
 *   - Phone: "iMessage;-;+15551234567"
 *   - Email: "iMessage;-;user@icloud.com"  
 *   - Group: "iMessage;+;chat123456789"
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { uid, chatGuid, message } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (!chatGuid) return NextResponse.json({ error: "Missing chatGuid" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

    const { serverUrl, password } = await getBlueBubblesConfig(uid);

    const tempGuid = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const res = await fetch(`${serverUrl}/api/v1/message/text?password=${encodeURIComponent(password)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatGuid,
        tempGuid,
        message,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.status !== 200) {
      return NextResponse.json({ error: "Failed to send message", raw: data }, { status: 502 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Message sent successfully to ${chatGuid}`,
      messageGuid: data.data?.guid,
    });
  } catch (err: any) {
    console.error("[iMessage Send] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
