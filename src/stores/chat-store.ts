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

      set({ sessions, sessionsLoaded: true, sessionsLoading: false, activeSessionId: restoredSessionId, messages: [] });

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
        return {
          sessions: updated,
          ...(needsClear ? { activeSessionId: null, messages: [] } : {}),
        };
      });
    } catch (err) {
      console.error("[ChatStore] Delete session error:", err);
    }
  },

  setActiveSession: (sessionId: string | null) => {
    const { scope } = get();
    if (!sessionId) {
      set({ activeSessionId: null, messages: [] });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`chat_active_${scope}`);
      }
      return;
    }

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    set({ activeSessionId: sessionId });

    // Persist active session
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`chat_active_${scope}`, sessionId);
    }

    // If session already has messages loaded, use them; otherwise fetch
    if (session.messages.length > 0) {
      set({ messages: session.messages });
    } else {
      get().loadSessionMessages(sessionId);
    }
  },

  loadSessionMessages: async (sessionId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { headers });

      if (!res.ok) {
        console.error("[ChatStore] Failed to load messages:", res.status);
        return;
      }

      const data = await res.json();
      const msgs: Message[] = data.session?.messages || [];

      // Update session in the list and set active messages
      set((state) => ({
        messages: msgs,
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, messages: msgs } : s
        ),
      }));
    } catch (err) {
      console.error("[ChatStore] Load messages error:", err);
    }
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

    try {
      const headers = await getAuthHeaders();
      // Strip non-serializable fields from messages
      const cleanMessages = messages.map((m) => {
        const clean: Record<string, unknown> = { id: m.id, text: m.text, isSelf: m.isSelf };
        if (m.hiddenContext !== undefined) clean.hiddenContext = m.hiddenContext;
        if (m.imageUrl !== undefined) clean.imageUrl = m.imageUrl;
        if (m.citations !== undefined) clean.citations = m.citations;
        return clean;
      });

      const body: Record<string, unknown> = { messages: cleanMessages };
      if (title) body.title = title;

      fetch(`/api/chat/sessions/${targetId}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(console.error);
    } catch (err) {
      console.error("[ChatStore] Save messages error:", err);
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
}));
