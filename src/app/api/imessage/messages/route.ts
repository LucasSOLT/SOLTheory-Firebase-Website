import { NextResponse } from "next/server";
import { getBlueBubblesConfig } from "../utils";

/**
 * POST /api/imessage/messages
 * Get messages from a specific iMessage chat thread.
 * Body: { uid, chatGuid, limit?, offset?, after? }
 */
export async function POST(req: Request) {
  try {
    const { uid, chatGuid, limit = 50, offset = 0, after } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (!chatGuid) return NextResponse.json({ error: "Missing chatGuid" }, { status: 400 });

    const { serverUrl, password } = await getBlueBubblesConfig(uid);

    const where: any[] = [
      {
        statement: "message.associatedMessageGuid IS NULL",
        args: {},
      },
    ];

    // If a specific chat is requested
    if (chatGuid !== "all") {
      where.push({
        statement: "chat.guid = :chatGuid",
        args: { chatGuid },
      });
    }

    // If filtering by date
    if (after) {
      where.push({
        statement: "message.dateCreated >= :after",
        args: { after },
      });
    }

    const res = await fetch(`${serverUrl}/api/v1/message/query?password=${encodeURIComponent(password)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit,
        offset,
        with: ["chat", "handle", "attachment"],
        sort: "DESC",
        where,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.status !== 200) {
      return NextResponse.json({ error: "BlueBubbles error", raw: data }, { status: 502 });
    }

    const messages = (data.data || []).map((msg: any) => ({
      guid: msg.guid,
      text: msg.text || "",
      dateCreated: msg.dateCreated,
      isFromMe: msg.isFromMe,
      handle: msg.handle ? {
        address: msg.handle.address,
        displayName: msg.handle.displayName || msg.handle.address,
      } : null,
      hasAttachments: (msg.attachments || []).length > 0,
      attachments: (msg.attachments || []).map((a: any) => ({
        guid: a.guid,
        mimeType: a.mimeType,
        transferName: a.transferName,
      })),
    }));

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error("[iMessage Messages] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
