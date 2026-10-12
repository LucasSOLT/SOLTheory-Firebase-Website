/**
 * chat-store.ts — Zustand Chat Session & Scope Store
 *
 * Manages:
 *  - Active scope (user vs org)
 *  - Session list (loaded from Supabase via API routes)
 *  - Active session messages
 *  - Session CRUD operations
 *
 * Replaces the local useState-based session management in the
 * chat page with a centralized store that persists to Supabase.
 */

import { create } from "zustand";
import type { ChatScope, Message, Session, SessionListItem } from "@/types/chat";
import { getAuthHeaders } from "@/lib/api-auth-client";

interface ChatStore {
  // ── Scope ──
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;

  // ── Sessions ──
  sessions: Session[];
  activeSessionId: string | null;
  sessionsLoaded: boolean;
  sessionsLoading: boolean;

  /** Fetch sessions for the current scope from Supabase */
  loadSessions: (orgId: string) => Promise<void>;

  /** Create a new session in Supabase, return its ID */
  createSession: (orgId: string, title?: string) => Promise<string>;

  /** Delete a session from Supabase */
  deleteSession: (sessionId: string) => Promise<void>;

  /** Set the active session and load its messages */
  setActiveSession: (sessionId: string | null) => void;

  /** Load full messages for a session from Supabase */
  loadSessionMessages: (sessionId: string) => Promise<void>;

  // ── Messages (active session) ──
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;

  /** Save current messages to Supabase */
  saveMessages: (sessionId?: string, title?: string) => Promise<void>;

  /** Update a session title locally and in Supabase */
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;

  /** Start a new chat (clear active session without creating one yet) */
  startNewSession: () => void;

  /** Sync local session state (update messages/updatedAt in the sessions array) */
  syncLocalSession: (sessionId: string, messages: Message[], title?: string) => void;

  // ── Per-Session Status (for real-time chat indicators) ──
  // 'idle'     → 💬 default message bubble icon
  // 'thinking' → ⏳ spinning loader (AI is processing)
  // 'unread'   → 🔵 blue dot (AI finished, user hasn't opened yet)
  sessionStatuses: Record<string, 'idle' | 'thinking' | 'unread'>;

  /** Mark a session as thinking (AI is processing a prompt) */
  setSessionThinking: (sessionId: string) => void;

  /** Mark a session as having an unread response (AI finished) */
  setSessionUnread: (sessionId: string) => void;

  /** Mark a session as read/idle (user viewed the response) */
  setSessionRead: (sessionId: string) => void;

  /**
   * Poll the server for an assistant reply (by client message id) that /api/chat saves
   * itself. Used when this tab lost the stream (phone locked, tab backgrounded).
   */
  waitForServerReply: (sessionId: string, messageId: string, timeoutMs: number) => Promise<Message | null>;
}

// ── Sync helpers (module scope: shared by every store consumer) ──

/** A reply bubble that is still being produced in this tab (streaming text or pending image). */
export function isInFlightReply(m: Message): boolean {
  if (m.isSelf) return false;
  if (m.isPendingImage) return true;
  return Array.isArray(m.agentEvents) && m.agentEvents.length > 0 && !m.agentEvents.some((e) => e.type === 'done');
}

/** Last PUT payload per session (skip identical re-sends) + a one-at-a-time queue per session */
const lastSavedPayload = new Map<string, string>();
const pendingPayload = new Map<string, string>();
const inFlightSave = new Set<string>();

/** /api/chat may run up to 60s; allow slack before giving up on a pending reply */
const PENDING_REPLY_WINDOW_MS = 3 * 60 * 1000;
const activeReplyPolls = new Set<string>();

async function fetchSessionDetail(sessionId: string): Promise<{ messages: Message[]; title: string | null } | null> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/chat/sessions/${sessionId}`, { headers });
  if (!res.ok) {
    console.error("[ChatStore] Failed to load messages:", res.status);
    return null;
  }
  const data = await res.json();
  return { messages: data.session?.messages || [], title: data.session?.title || null };
}

async function fetchSessionMessages(sessionId: string): Promise<Message[] | null> {
  return (await fetchSessionDetail(sessionId))?.messages ?? null;
}

/** Apply a server title only over the local "New Chat" placeholder (never over a real title). */
function withServerTitle(s: Session, serverTitle: string | null): Session {
  if (serverTitle && serverTitle !== "New Chat" && (!s.title || s.title === "New Chat")) {
    return { ...s, title: serverTitle };
  }
  return s;
}

/**
 * The user came back while the server was still answering their last prompt: show the
 * spinner in the sidebar and poll until the reply lands, then show it (or a blue dot if the
 * user is looking at another chat). Stops if the user sends something new in that chat.
 */
function pollForPendingReply(
  sessionId: string,
  lastUserMsgId: string,
  sentAt: number,
  get: () => ChatStore,
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
) {
  if (activeReplyPolls.has(sessionId)) return;
  activeReplyPolls.add(sessionId);
  set((state) => ({ sessionStatuses: { ...state.sessionStatuses, [sessionId]: 'thinking' as const } }));

  const stillWaiting = () => {
    const s = get().sessions.find((x) => x.id === sessionId);
    const last = s?.messages[s.messages.length - 1];
    return !!s && last?.id === lastUserMsgId; // nothing new happened locally in that chat
  };

  (async () => {
    let finished = false;
    let abandoned = false;
    try {
      while (Date.now() - sentAt < PENDING_REPLY_WINDOW_MS) {
        await new Promise((r) => setTimeout(r, 4000));
        if (!stillWaiting()) { abandoned = true; return; }
        const detail = await fetchSessionDetail(sessionId).catch(() => null);
        if (!detail) continue;
        const msgs = detail.messages;
        const idx = msgs.findIndex((m) => m.id === lastUserMsgId);
        if (idx >= 0 && msgs.slice(idx + 1).some((m) => !m.isSelf)) {
          if (!stillWaiting()) { abandoned = true; return; }
          set((state) => ({
            ...(state.activeSessionId === sessionId ? { messages: msgs } : {}),
            sessions: state.sessions.map((s) => (s.id === sessionId ? withServerTitle({ ...s, messages: msgs }, detail.title) : s)),
          }));
          finished = true;
          return;
        }
      }
    } finally {
      activeReplyPolls.delete(sessionId);
      // If the user started a new turn in this chat, its own request owns the status now
      const { activeSessionId, sessionStatuses } = get();
      if (!abandoned && sessionStatuses[sessionId] === 'thinking') {
        set((state) => ({
          sessionStatuses: {
            ...state.sessionStatuses,
            [sessionId]: finished && activeSessionId !== sessionId ? 'unread' as const : 'idle' as const,
          },
        }));
      }
    }
  })();
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // ── Scope ──
  scope: (typeof window !== "undefined"
    ? (localStorage.getItem("chat_scope") as ChatScope) || "user"
    : "user"),

  setScope: (scope) => {
    set({ scope, sessions: [], activeSessionId: null, messages: [], sessionsLoaded: false });
    if (typeof window !== "undefined") {
      localStorage.setItem("chat_scope", scope);
    }
  },

  // ── Sessions ──
  sessions: [],
  activeSessionId: null,
  sessionsLoaded: false,
  sessionsLoading: false,

  loadSessions: async (orgId: string) => {
    const { scope, sessionsLoading } = get();
    if (sessionsLoading) return;
    set({ sessionsLoading: true });

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ scope, orgId });
      const res = await fetch(`/api/chat/sessions?${params}`, { headers });

      if (!res.ok) {
        console.error("[ChatStore] Failed to load sessions:", res.status);
        set({ sessionsLoaded: true, sessionsLoading: false });
        return;
      }

      const data = await res.json();
      const sessions: Session[] = (data.sessions || []).map((s: SessionListItem) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        scope: s.scope,
        messages: [], // Messages are loaded on-demand
        messageCount: s.messageCount,
        lastPreview: s.lastPreview,
      }));

      // Restore last active session from sessionStorage
      let restoredSessionId: string | null = null;
      if (typeof window !== "undefined") {
        const saved = sessionStorage.getItem(`chat_active_${scope}`);
        if (saved && sessions.some((s) => s.id === saved)) {
          restoredSessionId = saved;
        }
      }

      // Replies the server saved while the user was away → blue dot (unless we reopen that chat now)
      const unreadStatuses: Record<string, 'unread'> = {};
      for (const s of (data.sessions || []) as SessionListItem[]) {
        if (s.hasUnread && s.id !== restoredSessionId) unreadStatuses[s.id] = 'unread';
      }

      set((state) => ({
        sessions,
        sessionsLoaded: true,
        sessionsLoading: false,
        activeSessionId: restoredSessionId,
        messages: [],
        sessionStatuses: { ...unreadStatuses, ...state.sessionStatuses },
      }));

      // If we restored a session, load its messages
      if (restoredSessionId) {
        get().loadSessionMessages(restoredSessionId);
      }
    } catch (err) {
      console.error("[ChatStore] Load sessions error:", err);
      set({ sessionsLoaded: true, sessionsLoading: false });
    }
  },

  createSession: async (orgId: string, title?: string) => {
    const { scope } = get();
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ scope, orgId, title: title || "New Chat" }),
      });

      if (!res.ok) {
        console.error("[ChatStore] Failed to create session:", res.status);
        throw new Error("Failed to create session");
      }

      const data = await res.json();
      const newSession: Session = {
        id: data.session.id,
        title: data.session.title,
        updatedAt: data.session.updatedAt,
        scope: data.session.scope,
        messages: [],
      };

      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newSession.id,
        messages: [],
      }));

      // Persist active session
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`chat_active_${scope}`, newSession.id);
      }

      return newSession.id;
    } catch (err) {
      console.error("[ChatStore] Create session error:", err);
      throw err;
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      const headers = await getAuthHeaders();
      fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
        headers,
      }).catch(console.error);

      set((state) => {
        const updated = state.sessions.filter((s) => s.id !== sessionId);
        const needsClear = state.activeSessionId === sessionId;
        const { [sessionId]: _, ...remainingStatuses } = state.sessionStatuses;
        return {
          sessions: updated,
          sessionStatuses: remainingStatuses,
          ...(needsClear ? { activeSessionId: null, messages: [] } : {}),
        };
      });
    } catch (err) {
      console.error("[ChatStore] Delete session error:", err);
    }
  },

  setActiveSession: (sessionId: string | null) => {
    const { scope, sessionStatuses } = get();
    if (!sessionId) {
      set({ activeSessionId: null, messages: [] });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`chat_active_${scope}`);
      }
      return;
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    // Auto-read: clear unread indicator when user selects this session
    const currentStatus = sessionStatuses[sessionId];
    const updatedStatuses = currentStatus === 'unread'
      ? { ...sessionStatuses, [sessionId]: 'idle' as const }
      : sessionStatuses;

    set({ activeSessionId: sessionId, sessionStatuses: updatedStatuses });

    // Persist active session
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`chat_active_${scope}`, sessionId);
    }

    // If session already has messages loaded, use them; otherwise fetch
    if (session.messages.length > 0) {
      set({ messages: session.messages });
      // The cached copy may hold a reply bubble that never finished in this tab (e.g. the user
      // switched chats mid-answer). If no request is running for it any more, the server has
      // the authoritative copy — reload it.
      if (currentStatus !== 'thinking' && session.messages.some(isInFlightReply)) {
        get().loadSessionMessages(sessionId);
      }
    } else {
      get().loadSessionMessages(sessionId);
    }
  },

  loadSessionMessages: async (sessionId: string) => {
    try {
      const detail = await fetchSessionDetail(sessionId);
      if (!detail) return;
      const msgs = detail.messages;

      // Update session in the list and set active messages
      set((state) => ({
        ...(state.activeSessionId === sessionId ? { messages: msgs } : {}),
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? withServerTitle({ ...s, messages: msgs }, detail.title) : s
        ),
      }));

      // A reply may still be generating on the server (the user left and came back quickly)
      const last = msgs[msgs.length - 1];
      if (last?.isSelf && typeof last.createdAt === "number" && Date.now() - last.createdAt < PENDING_REPLY_WINDOW_MS) {
        pollForPendingReply(sessionId, last.id, last.createdAt, get, set);
      }
    } catch (err) {
      console.error("[ChatStore] Load messages error:", err);
    }
  },

  waitForServerReply: async (sessionId: string, messageId: string, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const msgs = await fetchSessionMessages(sessionId);
        const found = msgs?.find((m) => m.id === messageId && !m.isSelf && (m.text || "").trim());
        if (found) return found;
      } catch { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
    return null;
  },

  // ── Messages ──
  messages: [],

  setMessages: (msgsOrFn) => {
    set((state) => ({
      messages: typeof msgsOrFn === "function" ? msgsOrFn(state.messages) : msgsOrFn,
    }));
  },

  saveMessages: async (sessionId?: string, title?: string) => {
    const { activeSessionId, messages } = get();
    const targetId = sessionId || activeSessionId;
    if (!targetId) return;

    // Only save if there are user messages
    const hasUserMessages = messages.some((m) => m.isSelf);
    if (!hasUserMessages) return;

    // Strip non-serializable fields from messages. A reply that is still streaming is NOT
    // synced: the server saves it when it is complete (even if this tab closes), and syncing
    // the empty/partial bubble is what used to leave a blank answer under the prompt.
    const cleanMessages = messages.filter((m) => !isInFlightReply(m)).map((m) => {
      const clean: Record<string, unknown> = { id: m.id, text: m.text, isSelf: m.isSelf };
      if (m.hiddenContext !== undefined) clean.hiddenContext = m.hiddenContext;
      if (m.imageUrl !== undefined) clean.imageUrl = m.imageUrl;
      if (m.citations !== undefined) clean.citations = m.citations;
      return clean;
    });

    const body: Record<string, unknown> = { messages: cleanMessages };
    if (title) body.title = title;
    const payload = JSON.stringify(body);

    // Skip if identical to the last payload sent for this session (this effect fires on every
    // streamed token batch)
    if (lastSavedPayload.get(targetId) === payload) return;
    lastSavedPayload.set(targetId, payload);

    // One request in flight per session; if more changes arrive meanwhile, send only the latest
    pendingPayload.set(targetId, payload);
    if (inFlightSave.has(targetId)) return;
    inFlightSave.add(targetId);
    try {
      while (pendingPayload.has(targetId)) {
        const next = pendingPayload.get(targetId)!;
        pendingPayload.delete(targetId);
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`/api/chat/sessions/${targetId}`, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: next,
          });
          if (!res.ok) {
            console.error("[ChatStore] Save messages failed:", res.status);
            if (lastSavedPayload.get(targetId) === next) lastSavedPayload.delete(targetId); // allow retry
          }
        } catch (err) {
          console.error("[ChatStore] Save messages error:", err);
          if (lastSavedPayload.get(targetId) === next) lastSavedPayload.delete(targetId);
        }
      }
    } finally {
      inFlightSave.delete(targetId);
    }
  },

  updateSessionTitle: async (sessionId: string, title: string) => {
    // Update locally first
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, title } : s
      ),
    }));

    // Then persist to Supabase (fire and forget)
    try {
      const headers = await getAuthHeaders();
      fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(console.error);
    } catch (err) {
      console.error("[ChatStore] Update title error:", err);
    }
  },

  startNewSession: () => {
    set({ activeSessionId: null, messages: [] });
    const { scope } = get();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`chat_active_${scope}`);
    }
  },

  syncLocalSession: (sessionId: string, messages: Message[], title?: string) => {
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages,
          updatedAt: Date.now(),
          ...(title && title !== "New Chat" ? { title } : {}),
        };
      }),
    }));
  },

  // ── Per-Session Status (real-time chat indicators) ──
  sessionStatuses: {},

  setSessionThinking: (sessionId: string) => {
    set((state) => ({
      sessionStatuses: { ...state.sessionStatuses, [sessionId]: 'thinking' as const },
    }));
  },

  setSessionUnread: (sessionId: string) => {
    // Only transition to unread if the session is currently thinking.
    // If user is already viewing this session (it's the active one), go straight to idle.
    const { activeSessionId, sessionStatuses } = get();
    if (sessionStatuses[sessionId] !== 'thinking') return;
    if (activeSessionId === sessionId) {
      // User is looking at this chat — no need for unread indicator
      set((state) => ({
        sessionStatuses: { ...state.sessionStatuses, [sessionId]: 'idle' as const },
      }));
    } else {
      set((state) => ({
        sessionStatuses: { ...state.sessionStatuses, [sessionId]: 'unread' as const },
      }));
    }
  },

  setSessionRead: (sessionId: string) => {
    const { sessionStatuses } = get();
    if (sessionStatuses[sessionId] === 'unread') {
      set((state) => ({
        sessionStatuses: { ...state.sessionStatuses, [sessionId]: 'idle' as const },
      }));
    }
  },
}));
