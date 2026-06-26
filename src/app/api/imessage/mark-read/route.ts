import { NextResponse } from "next/server";
import { getBlueBubblesConfig } from "../utils";

/**
 * POST /api/imessage/mark-read
 * Mark a chat conversation as read.
 * Body: { uid, chatGuid }
 * 
 * NOTE: Requires BlueBubbles Private API for full functionality.
 */
export async function POST(req: Request) {
  try {
    const { uid, chatGuid } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (!chatGuid) return NextResponse.json({ error: "Missing chatGuid" }, { status: 400 });

    const { serverUrl, password } = await getBlueBubblesConfig(uid);

    const res = await fetch(
      `${serverUrl}/api/v1/chat/${encodeURIComponent(chatGuid)}/mark-read?password=${encodeURIComponent(password)}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await res.json();
    if (data.status !== 200) {
      return NextResponse.json({ error: "Failed to mark as read", raw: data }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "Chat marked as read." });
  } catch (err: any) {
    console.error("[iMessage Mark-Read] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
