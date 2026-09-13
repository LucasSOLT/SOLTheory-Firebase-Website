/**
 * Chat Sessions API — List & Create
 *
 * GET  /api/chat/sessions?scope=user|org&orgId=xxx
 *   Lists sessions for the authenticated user (user scope) or
 *   all sessions visible to org members (org scope).
 *
 * POST /api/chat/sessions
 *   Creates a new session. Body: { scope, orgId, title? }
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

/** Look up the Supabase org UUID from an org slug */
async function resolveOrgId(orgSlug: string) {
  const sb = createServiceClient();
  // Try exact slug match first, then strip domain suffix
  const clean = orgSlug.toLowerCase().replace(/\.(com|org|net)$/, "");
  const { data } = await sb
    .from("organizations")
    .select("id")
    .eq("slug", clean)
    .single();
  return data?.id as string | null;
}

export async function GET(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "user") as "user" | "org";
  const orgSlug = url.searchParams.get("orgId") || "";

  const userId = await resolveSupabaseUser(auth.uid);
  if (!userId) {
    return NextResponse.json({ error: "User not found in database" }, { status: 404 });
  }

  const sb = createServiceClient();

  if (scope === "user") {
    // User-scoped: only this user's private sessions
    const { data: sessions, error } = await sb
      .from("chat_sessions")
      .select("id, session_name, scope, updated_at, created_at")
      .eq("user_id", userId)
      .eq("scope", "user")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Sessions API] List error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get message counts and last preview for each session
    const sessionIds = (sessions || []).map((s) => s.id);
    const { data: msgStats } = sessionIds.length > 0
      ? await sb.rpc("get_session_stats", { session_ids: sessionIds })
      : { data: [] };

    // If RPC doesn't exist yet, fall back to individual counts
    const statsMap = new Map<string, { count: number; preview: string }>();
    if (msgStats && Array.isArray(msgStats)) {
      for (const s of msgStats) {
        statsMap.set(s.session_id, { count: s.msg_count, preview: s.last_preview || "" });
      }
    }

    const result = (sessions || []).map((s) => ({
      id: s.id,
      title: s.session_name || "New Chat",
      updatedAt: new Date(s.updated_at).getTime(),
      scope: s.scope as "user" | "org",
      messageCount: statsMap.get(s.id)?.count || 0,
      lastPreview: statsMap.get(s.id)?.preview || "",
    }));

    return NextResponse.json({ sessions: result });
  } else {
    // Org-scoped: all sessions for this org visible to members
    const orgId = await resolveOrgId(orgSlug);
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Verify user is a member of this org
    const { data: membership } = await sb
      .from("org_members")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const { data: sessions, error } = await sb
      .from("chat_sessions")
      .select("id, session_name, scope, updated_at, user_id, created_at")
      .eq("org_id", orgId)
      .eq("scope", "org")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Sessions API] List org error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (sessions || []).map((s) => ({
      id: s.id,
      title: s.session_name || "New Chat",
      updatedAt: new Date(s.updated_at).getTime(),
      scope: s.scope as "user" | "org",
      messageCount: 0,
      lastPreview: "",
    }));

    return NextResponse.json({ sessions: result });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const scope = body.scope || "user";
  const orgSlug = body.orgId || "";
  const title = body.title || "New Chat";

  const userId = await resolveSupabaseUser(auth.uid);
  if (!userId) {
    return NextResponse.json({ error: "User not found in database" }, { status: 404 });
  }

  const sb = createServiceClient();

  let orgId: string | null = null;
  if (orgSlug) {
    orgId = await resolveOrgId(orgSlug);
  }

  const sessionData: Record<string, unknown> = {
    user_id: userId,
    org_id: orgId,
    session_name: title,
    scope,
    token_count: 0,
  };

  const { data, error } = await sb
    .from("chat_sessions")
    .insert(sessionData)
    .select("id, session_name, scope, updated_at")
    .single();

  if (error) {
    console.error("[Sessions API] Create error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    session: {
      id: data.id,
      title: data.session_name || "New Chat",
      updatedAt: new Date(data.updated_at).getTime(),
      scope: data.scope,
      messageCount: 0,
      lastPreview: "",
    },
  });
}
