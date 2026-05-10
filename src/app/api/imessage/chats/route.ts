import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

/**
 * POST /api/imessage/chats
 * List iMessage conversations from the user's BlueBubbles server.
 * Body: { uid, limit?, offset? }
 */
export async function POST(req: Request) {
  try {
    const { uid, limit = 25, offset = 0 } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { serverUrl, password } = await getBlueBubblesConfig(uid);

    const res = await fetch(`${serverUrl}/api/v1/chat/query?password=${encodeURIComponent(password)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit,
        offset,
        with: ["lastMessage", "sms"],
        sort: "lastmessage",
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.status !== 200) {
      return NextResponse.json({ error: "BlueBubbles error", raw: data }, { status: 502 });
    }

    // Normalize the chat data
    const chats = (data.data || []).map((chat: any) => ({
      guid: chat.guid,
      chatIdentifier: chat.chatIdentifier,
      displayName: chat.displayName || chat.chatIdentifier,
      participants: (chat.participants || []).map((p: any) => ({
        address: p.address,
        displayName: p.displayName || p.address,
      })),
      lastMessage: chat.lastMessage ? {
        text: chat.lastMessage.text,
        dateCreated: chat.lastMessage.dateCreated,
        isFromMe: chat.lastMessage.isFromMe,
      } : null,
      hasUnreadMessages: chat.hasUnreadMessages || false,
    }));

    return NextResponse.json({ chats });
  } catch (err: any) {
    console.error("[iMessage Chats] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Retrieve BlueBubbles credentials from Firestore for a given user. */
export async function getBlueBubblesConfig(uid: string): Promise<{ serverUrl: string; password: string }> {
  initAdmin();
  const db = getAdminFirestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const data = userDoc.data();

  const serverUrl = data?.imessageServerUrl;
  const password = data?.imessagePassword;

  if (!serverUrl || !password) {
    throw new Error("BlueBubbles not configured. Go to Settings → Integrations to connect iMessage.");
  }

  return { serverUrl: serverUrl.replace(/\/+$/, ""), password };
}
