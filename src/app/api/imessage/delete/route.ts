import { NextResponse } from "next/server";
import { getBlueBubblesConfig } from "../chats/route";

/**
 * POST /api/imessage/delete
 * Delete a specific iMessage by its GUID.
 * Body: { uid, messageGuid }
 * 
 * NOTE: Requires BlueBubbles Private API to be enabled.
 */
export async function POST(req: Request) {
  try {
    const { uid, messageGuid } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (!messageGuid) return NextResponse.json({ error: "Missing messageGuid" }, { status: 400 });

    const { serverUrl, password } = await getBlueBubblesConfig(uid);

    const res = await fetch(
      `${serverUrl}/api/v1/message/${encodeURIComponent(messageGuid)}?password=${encodeURIComponent(password)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await res.json();
    if (data.status !== 200) {
      return NextResponse.json(
        { error: "Failed to delete message. This may require the BlueBubbles Private API.", raw: data },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: "Message deleted successfully." });
  } catch (err: any) {
    console.error("[iMessage Delete] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
