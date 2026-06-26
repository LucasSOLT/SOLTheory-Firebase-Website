import { NextResponse } from "next/server";
import { getBlueBubblesConfig } from "../utils";

/**
 * POST /api/imessage/search
 * Search iMessage conversations by keyword.
 * Body: { uid, query, limit? }
 */
export async function POST(req: Request) {
  try {
    const { uid, query: searchQuery, limit = 25 } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (!searchQuery) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const { serverUrl, password } = await getBlueBubblesConfig(uid);

    // BlueBubbles message search
    const res = await fetch(`${serverUrl}/api/v1/message/query?password=${encodeURIComponent(password)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit,
        offset: 0,
        with: ["chat", "handle"],
        sort: "DESC",
        where: [
          {
            statement: "message.text LIKE :query",
            args: { query: `%${searchQuery}%` },
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.status !== 200) {
      return NextResponse.json({ error: "BlueBubbles search error", raw: data }, { status: 502 });
    }

    const results = (data.data || []).map((msg: any) => ({
      guid: msg.guid,
      text: msg.text || "",
      dateCreated: msg.dateCreated,
      isFromMe: msg.isFromMe,
      chatGuid: msg.chats?.[0]?.guid || "",
      chatDisplayName: msg.chats?.[0]?.displayName || msg.chats?.[0]?.chatIdentifier || "Unknown",
      handle: msg.handle ? {
        address: msg.handle.address,
        displayName: msg.handle.displayName || msg.handle.address,
      } : null,
    }));

    return NextResponse.json({ results, count: results.length });
  } catch (err: any) {
    console.error("[iMessage Search] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
