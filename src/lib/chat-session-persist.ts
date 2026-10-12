/**
 * chat-session-persist.ts — Server-side persistence of chat turns (Supabase `messages`)
 *
 * SERVER ONLY. Used by:
 *   - POST /api/chat                    → writes the user's prompt + the AI's final answer
 *                                         itself, so a reply survives the user leaving the page.
 *   - PUT  /api/chat/sessions/[id]      → the client's incremental sync (merge, not wipe).
 *
 * Design (why it looks like this):
 *   - Every message row id is derived from (sessionId, clientMessageId). The browser and the
 *     /api/chat route both know the client id of the assistant placeholder, so they always
 *     address the SAME row → no duplicates no matter which side writes first.
 *   - The server writes with "insert, ignore if it already exists"; the client upserts. So if
 *     the user is still on the page, the client's (possibly post-processed) version wins.
 *   - Rows written by the server carry `metadata.serverSaved = true` until the client
 *     acknowledges them (its upsert replaces the metadata). That flag doubles as the
 *     "unread" signal for the sidebar blue dot and protects the row from the client's
 *     stale-sync deletes.
 *   - NOTE: `messages` has NO `updated_at` column. Writing one makes PostgREST reject the
 *     whole insert — that silently broke the previous background save.
 */

import { createHash } from "crypto";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Keep the serverless function alive until `p` settles, even after the response has been
 * sent / the client disconnected. Uses Next's built-in `after()` (on Vercel it maps to the
 * platform `waitUntil`). Do NOT import `@vercel/functions` — it is not a declared dependency
 * of this project, so the Vercel build cannot resolve it. Outside a Next request scope
 * (unit tests, scripts) `after()` throws; the promise still runs, it just isn't tracked.
 */
export function keepAlive(p: Promise<unknown>): void {
  try {
    after(p.catch(() => { /* errors are logged by the producer */ }));
  } catch {
    /* not inside a request scope */
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Deterministic, session-bound row id for a client message id.
 * Same inputs → same UUID, so the client sync and the chat route converge on one row.
 * Bound to the session so a client can never address another session's rows.
 */
export function deriveMessageRowId(sessionId: string, clientId: string): string {
  const h = createHash("sha256").update(`${sessionId}:${clientId}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Look up the Supabase user UUID from a Firebase UID */
export async function resolveSupabaseUserId(sb: ServiceClient, firebaseUid: string): Promise<string | null> {
  const { data } = await sb.from("users").select("id").eq("firebase_uid", firebaseUid).single();
  return (data?.id as string) || null;
}

/**
 * Can this Supabase user write into this session?
 * user scope → only the owner. org scope → the owner or a member of the session's org.
 */
export async function canWriteSession(sb: ServiceClient, sessionId: string, supabaseUserId: string): Promise<boolean> {
  const { data: session } = await sb
    .from("chat_sessions")
    .select("id, user_id, scope, org_id")
    .eq("id", sessionId)
    .single();
  if (!session) return false;
  if (session.user_id === supabaseUserId) return true;
  if (session.scope === "org" && session.org_id) {
    const { data: membership } = await sb
      .from("org_members")
      .select("id")
      .eq("user_id", supabaseUserId)
      .eq("org_id", session.org_id)
      .single();
    return !!membership;
  }
  return false;
}

/** Split the API content the client sends back into the display text + hidden context. */
const USER_COMMENT_MARKER = "\n\n[USER COMMENT]: ";
export function splitUserApiContent(content: unknown): { text: string; hiddenContext?: string; imageUrl?: string } {
  let raw = "";
  let imageUrl: string | undefined;
  if (typeof content === "string") {
    raw = content;
  } else if (Array.isArray(content)) {
    raw = content
      .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("\n");
    const img = content.find((p: any) => p && p.type === "image_url" && typeof p.image_url?.url === "string");
    if (img) imageUrl = img.image_url.url;
  }
  const idx = raw.lastIndexOf(USER_COMMENT_MARKER);
  if (idx >= 0) {
    return { text: raw.slice(idx + USER_COMMENT_MARKER.length), hiddenContext: raw.slice(0, idx), imageUrl };
  }
  return { text: raw, imageUrl };
}

export interface ChatTurnPersistOptions {
  sessionId: unknown;
  firebaseUid: string | null | undefined;
  /** Full `messages` array sent to /api/chat */
  apiMessages: any[];
  /** Client ids of the user messages added this turn (in order, they are the trailing user messages) */
  userMessageIds: unknown;
  /** Client id of the assistant placeholder bubble */
  assistantMessageId: unknown;
}

export interface ChatTurnPersister {
  /** True when this request carries everything needed to persist the turn */
  readonly enabled: boolean;
  /**
   * Persist the AI's final answer. Never throws. The returned promise is also
   * registered with waitUntil so the write survives the client disconnecting.
   */
  saveAssistant: (text: string, extra?: { citations?: unknown[] }) => Promise<void>;
}

const NOOP_PERSISTER: ChatTurnPersister = { enabled: false, saveAssistant: async () => {} };

/**
 * Create a persister for one /api/chat turn. Immediately (in the background) verifies the
 * caller may write to the session and inserts the user's prompt row(s) if the client hasn't
 * already. `saveAssistant` writes the final answer once it is known.
 */
export function createChatTurnPersister(opts: ChatTurnPersistOptions): ChatTurnPersister {
  const { sessionId, firebaseUid, apiMessages, assistantMessageId } = opts;
  if (!isUuid(sessionId) || !firebaseUid || typeof assistantMessageId !== "string" || !assistantMessageId) {
    return NOOP_PERSISTER;
  }
  const userIds = Array.isArray(opts.userMessageIds)
    ? (opts.userMessageIds as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, 10)
    : [];
  const startedAt = Date.now();
  let sb: ServiceClient;
  try {
    sb = createServiceClient();
  } catch (e: any) {
    console.warn("[ChatPersist] Supabase not configured:", e?.message);
    return NOOP_PERSISTER;
  }

  // Fallback title from this turn's prompt (same rule as the client's fallback: first words).
  const promptMsgs = Array.isArray(apiMessages) ? apiMessages : [];
  const idPrompt = userIds.length > 0 && promptMsgs.length >= userIds.length
    ? promptMsgs[promptMsgs.length - userIds.length]
    : null;
  const promptMsg = idPrompt?.role === "user"
    ? idPrompt
    : [...promptMsgs].reverse().find((m: any) => m?.role === "user");
  const fallbackTitle = deriveFallbackTitle(splitUserApiContent(promptMsg?.content).text);

  // 1) Access check + user prompt rows (kicked off right away)
  const ready: Promise<boolean> = (async () => {
    try {
      const supabaseUserId = await resolveSupabaseUserId(sb, firebaseUid);
      if (!supabaseUserId) return false;
      const allowed = await canWriteSession(sb, sessionId, supabaseUserId);
      if (!allowed) {
        console.warn(`[ChatPersist] User ${firebaseUid} may not write session ${sessionId}`);
        return false;
      }
      // Pair the trailing user messages with the client ids for this turn
      const msgs = Array.isArray(apiMessages) ? apiMessages : [];
      const tail = userIds.length > 0 ? msgs.slice(-userIds.length) : [];
      if (userIds.length > 0 && tail.length === userIds.length && tail.every((m: any) => m?.role === "user")) {
        const rows = tail.map((m: any, i: number) => {
          const parsed = splitUserApiContent(m.content);
          const metadata: Record<string, unknown> = { clientId: userIds[i], serverSaved: true };
          if (parsed.hiddenContext) metadata.hiddenContext = parsed.hiddenContext;
          if (parsed.imageUrl) metadata.imageUrl = parsed.imageUrl;
          return {
            id: deriveMessageRowId(sessionId, userIds[i]),
            session_id: sessionId,
            role: "user",
            content: parsed.text || "",
            metadata,
            created_at: new Date(startedAt + i).toISOString(),
          };
        });
        const { error } = await sb.from("messages").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
        if (error) console.error("[ChatPersist] User message save failed:", error.message);
      }
      // The browser generates the AI title only after the answer arrives — if the user leaves,
      // the session would stay "New Chat" (and hidden in the sidebar after a reload). Replace
      // only that placeholder, never a real title; the browser's AI title still wins later.
      if (fallbackTitle) {
        const { error: titleErr } = await sb
          .from("chat_sessions")
          .update({ session_name: fallbackTitle })
          .eq("id", sessionId)
          .eq("session_name", "New Chat");
        if (titleErr) console.warn("[ChatPersist] Fallback title failed:", titleErr.message);
      }
      return true;
    } catch (e: any) {
      console.error("[ChatPersist] Setup failed:", e?.message || e);
      return false;
    }
  })();
  keepAlive(ready);

  let saved = false;
  const saveAssistant = (text: string, extra?: { citations?: unknown[] }): Promise<void> => {
    if (saved || !text || !text.trim()) return Promise.resolve();
    saved = true;
    const p = (async () => {
      try {
        if (!(await ready)) return;
        const metadata: Record<string, unknown> = { clientId: assistantMessageId, serverSaved: true };
        if (extra?.citations && Array.isArray(extra.citations) && extra.citations.length > 0) {
          metadata.citations = extra.citations;
        }
        const createdAt = Math.max(Date.now(), startedAt + userIds.length + 1);
        const { error } = await sb.from("messages").upsert(
          [{
            id: deriveMessageRowId(sessionId, assistantMessageId),
            session_id: sessionId,
            role: "assistant",
            content: text,
            metadata,
            created_at: new Date(createdAt).toISOString(),
          }],
          { onConflict: "id", ignoreDuplicates: true }
        );
        if (error) {
          console.error("[ChatPersist] Assistant message save failed:", error.message);
          return;
        }
        await sb.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
        console.log(`[ChatPersist] Saved assistant reply (${text.length} chars) to session ${sessionId}`);
      } catch (e: any) {
        console.error("[ChatPersist] Assistant save threw:", e?.message || e);
      }
    })();
    keepAlive(p);
    return p;
  };

  return { enabled: true, saveAssistant };
}

/** "Research EVERYTHING you can about X…" → "Research EVERYTHING you can about X" (≤ 6 words, ≤ 60 chars) */
export function deriveFallbackTitle(prompt: string): string {
  const words = (prompt || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, 6);
  return words.join(" ").replace(/["']/g, "").substring(0, 60).trim();
}

/** A ReadableStream controller wrapper that never throws once the client has gone away. */
export interface SafeStreamController {
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
  readonly clientGone: boolean;
}

/**
 * Build an SSE body whose producer keeps running after the client disconnects.
 *
 * Plain `new ReadableStream({ async start(controller) {...} })` breaks when the user leaves:
 * the response is cancelled, the next `controller.enqueue` throws, and on Vercel the
 * function may be frozen once the response ends. Here the producer's writes become no-ops
 * after cancellation and the producer promise is registered with `keepAlive` (Next `after()`),
 * so the generation finishes and can persist its result.
 */
export function createBackgroundSSEStream(source: {
  start: (controller: SafeStreamController) => Promise<void>;
}): ReadableStream<Uint8Array> {
  let gone = false;
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(raw) {
      const safe: SafeStreamController = {
        enqueue(chunk) {
          if (gone || closed) return;
          try { raw.enqueue(chunk); } catch { gone = true; }
        },
        close() {
          if (closed) return;
          closed = true;
          if (gone) return;
          try { raw.close(); } catch { /* already closed */ }
        },
        get clientGone() { return gone; },
      };
      const work = (async () => {
        try {
          await source.start(safe);
        } catch (err: any) {
          console.error("[SSE] Background stream producer failed:", err?.message || err);
        } finally {
          safe.close();
        }
      })();
      keepAlive(work);
    },
    cancel() {
      gone = true;
      console.log("[SSE] Client disconnected — continuing generation in the background");
    },
  });
}
