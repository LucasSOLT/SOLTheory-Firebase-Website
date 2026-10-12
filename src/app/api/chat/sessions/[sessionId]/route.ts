/**
 * Chat Session Detail API — Get, Update, Delete
 *
 * GET    /api/chat/sessions/[sessionId]        — Load session with all messages
 * PUT    /api/chat/sessions/[sessionId]        — Update session title + merge-sync messages
 * DELETE /api/chat/sessions/[sessionId]        — Delete session (messages cascade)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { deriveMessageRowId, isUuid } from "@/lib/chat-session-persist";

/** Look up the Supabase user UUID from a Firebase UID */
async function resolveSupabaseUser(firebaseUid: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("users")
    .select("id")
    .eq("firebase_uid", firebaseUid)
    .single();
  return data?.id as string | null;
}

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  const { sessionId } = await ctx.params;
  const userId = await resolveSupabaseUser(auth.uid);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const sb = createServiceClient();

  // Load session
  const { data: session, error: sessionErr } = await sb
    .from("chat_sessions")
    .select("id, session_name, scope, org_id, user_id, updated_at, created_at")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Access check: user must own the session OR be an org member for org-scoped sessions
  if (session.scope === "user" && session.user_id !== userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (session.scope === "org" && session.org_id) {
    const { data: membership } = await sb
      .from("org_members")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", session.org_id)
      .single();
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Load messages ordered by created_at
  const { data: messages, error: msgErr } = await sb
    .from("messages")
    .select("id, role, content, tokens, metadata, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("[Session API] Messages load error:", msgErr.message);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Transform DB messages to client format
  // `id` is the client's original message id when known (metadata.clientId) so that the
  // browser's later syncs and the chat route keep addressing the same row.
  let hasUnread = false;
  const clientMessages = (messages || []).map((m) => {
    const meta = (m.metadata || {}) as Record<string, unknown>;
    if (m.role === "assistant" && (meta.serverSaved === true || meta.serverSaved === "true")) hasUnread = true;
    return {
      id: typeof meta.clientId === "string" && meta.clientId ? meta.clientId : m.id,
      text: m.content,
      isSelf: m.role === "user",
      createdAt: new Date(m.created_at).getTime(),
      ...(meta.hiddenContext ? { hiddenContext: meta.hiddenContext as string } : {}),
      ...(meta.imageUrl ? { imageUrl: meta.imageUrl as string } : {}),
      ...(meta.citations ? { citations: meta.citations as { text: string; source: string; type: string }[] } : {}),
    };
  });

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.session_name || "New Chat",
      updatedAt: new Date(session.updated_at).getTime(),
      scope: session.scope as "user" | "org",
      messages: clientMessages,
      hasUnread,
    },
  });
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  const { sessionId } = await ctx.params;
  const userId = await resolveSupabaseUser(auth.uid);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const sb = createServiceClient();

  // Verify ownership
  const { data: session } = await sb
    .from("chat_sessions")
    .select("id, user_id, scope, org_id")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // For user-scoped sessions, only the owner can update
  // For org-scoped sessions, any org member can update (they're contributing)
  if (session.scope === "user" && session.user_id !== userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Update session title if provided. Never downgrade a real title back to the "New Chat"
  // placeholder: /api/chat titles a session it finished while the user was away, and a stale
  // tab that still shows "New Chat" would otherwise undo that (untitled sessions are hidden
  // from the sidebar after a reload).
  if (body.title !== undefined && body.title !== "New Chat") {
    await sb
      .from("chat_sessions")
      .update({ session_name: body.title, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  // Save messages if provided — MERGE strategy (never a blind wipe).
  //
  // The chat route (/api/chat) also writes into this table: the user's prompt as soon as it
  // arrives and the AI's final answer when it is ready — even if this browser tab has gone
  // away. The old delete-all + re-insert here raced with those writes and could wipe a
  // background answer or leave an empty placeholder. Now:
  //   • each client message maps to a stable row id (same id the chat route uses),
  //   • rows are upserted, keeping their original created_at (ordering stays stable),
  //   • rows missing from the client's list are deleted ONLY if they were not written by the
  //     server and not yet seen by the client (metadata.serverSaved).
  if (body.messages && Array.isArray(body.messages)) {
    const incoming = (body.messages as Record<string, unknown>[]).filter(
      (m) => m && typeof m === "object" && typeof m.id === "string" && (m.id as string).length > 0
    );

    const { data: existingRows, error: existingErr } = await sb
      .from("messages")
      .select("id, created_at, server_saved:metadata->serverSaved")
      .eq("session_id", sessionId);
    if (existingErr) {
      console.error("[Session API] Messages read error:", existingErr.message);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }
    const existing = new Map(
      (existingRows || []).map((r: { id: string; created_at: string; server_saved: unknown }) => [r.id, r])
    );

    const now = Date.now();
    let prevTs = 0;
    const seen = new Set<string>();
    const dbMessages: Record<string, unknown>[] = [];
    for (const m of incoming) {
      const clientId = m.id as string;
      // Ids loaded from the DB pass through; client-generated ids map to a session-bound id
      const rowId = isUuid(clientId) && existing.has(clientId.toLowerCase())
        ? clientId.toLowerCase()
        : deriveMessageRowId(sessionId, clientId);
      if (seen.has(rowId)) continue;
      seen.add(rowId);

      const metadata: Record<string, unknown> = { clientId };
      if (m.hiddenContext) metadata.hiddenContext = m.hiddenContext;
      if (m.imageUrl) metadata.imageUrl = m.imageUrl;
      if (m.citations) metadata.citations = m.citations;

      const prior = existing.get(rowId);
      let ts = prior ? new Date(prior.created_at).getTime() : Math.max(now, prevTs + 1);
      if (!prior && ts <= prevTs) ts = prevTs + 1;
      prevTs = Math.max(prevTs, ts);

      dbMessages.push({
        id: rowId,
        session_id: sessionId,
        role: m.isSelf ? "user" : "assistant",
        content: (m.text as string) || "",
        metadata,
        created_at: new Date(ts).toISOString(),
      });
    }

    if (dbMessages.length > 0) {
      const { error: upsertErr } = await sb.from("messages").upsert(dbMessages, { onConflict: "id" });
      if (upsertErr) {
        console.error("[Session API] Messages save error:", upsertErr.message);
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    // Remove rows the client dropped — but never a server-written row the client hasn't seen yet
    const toDelete = [...existing.values()]
      .filter((r) => !seen.has(r.id) && r.server_saved !== true && r.server_saved !== "true")
      .map((r) => r.id);
    if (toDelete.length > 0) {
      const { error: delErr } = await sb.from("messages").delete().in("id", toDelete).eq("session_id", sessionId);
      if (delErr) console.error("[Session API] Stale message cleanup error:", delErr.message);
    }

    // Update session timestamp
    await sb
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  const { sessionId } = await ctx.params;
  const userId = await resolveSupabaseUser(auth.uid);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const sb = createServiceClient();

  // Verify ownership (only the session creator can delete)
  const { data: session } = await sb
    .from("chat_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== userId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Messages cascade-delete via FK constraint
  const { error } = await sb.from("chat_sessions").delete().eq("id", sessionId);

  if (error) {
    console.error("[Session API] Delete error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
