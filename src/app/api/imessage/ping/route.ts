import { NextResponse } from "next/server";

/**
 * GET /api/imessage/ping
 * Test the connection to a user's BlueBubbles server.
 * Query params: serverUrl, password
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serverUrl = searchParams.get("serverUrl");
    const password = searchParams.get("password");

    if (!serverUrl || !password) {
      return NextResponse.json({ error: "Missing serverUrl or password" }, { status: 400 });
    }

    const cleanUrl = serverUrl.replace(/\/+$/, "");
    const res = await fetch(`${cleanUrl}/api/v1/ping?password=${encodeURIComponent(password)}`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    if (data.status === 200 && data.data === "pong") {
      return NextResponse.json({ connected: true, message: "BlueBubbles server is reachable!" });
    }

    return NextResponse.json({ connected: false, message: "Server responded but ping failed.", raw: data });
  } catch (err: any) {
    console.error("[iMessage Ping] Error:", err.message);
    return NextResponse.json(
      { connected: false, message: `Connection failed: ${err.message}` },
      { status: 502 }
    );
  }
}
