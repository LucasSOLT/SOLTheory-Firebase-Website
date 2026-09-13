/**
 * Chat Session Detail API — Get, Update, Delete
 *
 * GET    /api/chat/sessions/[sessionId]        — Load session with all messages
 * PUT    /api/chat/sessions/[sessionId]        — Update session title + save messages
 * DELETE /api/chat/sessions/[sessionId]        — Delete session (messages cascade)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";

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
  const clientMessages = (messages || []).map((m) => {
    const meta = (m.metadata || {}) as Record<string, unknown>;
    return {
      id: m.id,
      text: m.content,
      isSelf: m.role === "user",
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

  // Update session title if provided
  if (body.title !== undefined) {
    await sb
      .from("chat_sessions")
      .update({ session_name: body.title, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  // Save messages if provided — full replacement strategy
  if (body.messages && Array.isArray(body.messages)) {
    // Delete existing messages, then insert new ones (simple and idempotent)
    await sb.from("messages").delete().eq("session_id", sessionId);

    if (body.messages.length > 0) {
      const dbMessages = body.messages.map((m: Record<string, unknown>, idx: number) => {
        const metadata: Record<string, unknown> = {};
        if (m.hiddenContext) metadata.hiddenContext = m.hiddenContext;
        if (m.imageUrl) metadata.imageUrl = m.imageUrl;
        if (m.citations) metadata.citations = m.citations;

        return {
          session_id: sessionId,
          role: m.isSelf ? "user" : "assistant",
          content: (m.text as string) || "",
          metadata: Object.keys(metadata).length > 0 ? metadata : {},
          // Preserve ordering via created_at offset
          created_at: new Date(Date.now() + idx).toISOString(),
        };
      });

      const { error: insertErr } = await sb.from("messages").insert(dbMessages);
      if (insertErr) {
        console.error("[Session API] Messages save error:", insertErr.message);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
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
