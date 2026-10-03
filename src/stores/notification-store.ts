/**
 * notification-store.ts — Zustand store for the in-app notification center
 *
 * Manages two sources of notifications and merges them into one list:
 *  - `persisted`: server-side notifications from `/api/notifications`
 *    (stored at users/{uid}/notifications, survive until the user deletes them)
 *  - `computed`: the live list the dashboard layout derives on the fly from
 *    Firestore listeners (tickets, DMs, tasks, surveys, channels) + localStorage
 *
 * The layout pushes its computed list in via `setComputed`, and both the bell
 * popup and the full Notifications page read the merged result via
 * `useMergedNotifications()`.
 */

import { create } from "zustand";
import { useMemo } from "react";
import { getAuthHeaders } from "@/lib/api-auth-client";

// Redeclared from @/lib/notifications (server-only, imports firebase-admin).
// Keep in sync with that file.
export type NotificationType =
  | "action_board_assigned"
  | "onboarding_assigned"
  | "onboarding_phase_completed"
  | "onboarding_document_completed"
  | "onboarding_blueprint_completed"
  | "timesheet_entry"
  | "grant_found"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  orgId?: string;
  /** Id of the related record (task id, grant id, timesheet entry id, ...) */
  refId?: string;
  actorEmail?: string;
  actorName?: string;
  createdAt: number;
  read: boolean;
}

/** Unified display shape used by the popup and the Notifications page. */
export interface DisplayNotification {
  id: string;
  title: string;
  desc: string;
  /** epoch ms */
  time: number;
  type?: string;
  link?: string;
  read: boolean;
  source: "persisted" | "computed";
  actorName?: string;
  refId?: string;
  /** Computed items carry their own icon element + tailwind bg class */
  icon?: any;
  bg?: string;
}

const DELETED_KEY = "st_deleted_notifications";
const ALL_KEY = "st_all_notifications";

function readLocalArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function callApi(method: "PATCH" | "DELETE", body: Record<string, unknown>) {
  try {
    const headers = await getAuthHeaders();
    await fetch("/api/notifications", { method, headers, body: JSON.stringify(body) });
  } catch (e) {
    console.warn(`[notification-store] ${method} failed (non-fatal):`, e);
  }
}

interface NotificationStore {
  // ── Persisted (server) ──
  persisted: AppNotification[];
  loaded: boolean;
  loading: boolean;
  fetchPersisted: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  clearAll: () => Promise<void>;

  // ── Computed (layout-derived) ──
  computed: any[];
  setComputed: (list: any[]) => void;
  /** Ids of computed items the user has read (mirrors localStorage read_notifications_{uid}) */
  computedReadIds: string[];
  setComputedReadIds: (ids: string[]) => void;
  /** Mark computed items read from outside the layout (persists to localStorage) */
  markComputedRead: (ids: string[], uid?: string | null) => void;
  /** Ids of computed items the user has deleted (mirrors localStorage st_deleted_notifications) */
  dismissedComputedIds: string[];
  dismissComputed: (ids: string[]) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  persisted: [],
  loaded: false,
  loading: false,

  fetchPersisted: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/notifications?limit=100", { headers });
      if (res.ok) {
        const data = await res.json();
        const list: AppNotification[] = Array.isArray(data?.notifications) ? data.notifications : [];
        set({ persisted: list });
      }
    } catch (e) {
      console.warn("[notification-store] fetch failed (non-fatal):", e);
    } finally {
      set({ loading: false, loaded: true });
    }
  },

  markRead: async (ids) => {
    const targets = ids.filter((id) => get().persisted.some((n) => n.id === id && !n.read));
    if (targets.length === 0) return;
    set((s) => ({ persisted: s.persisted.map((n) => (targets.includes(n.id) ? { ...n, read: true } : n)) }));
    await callApi("PATCH", { ids: targets });
  },

  markAllRead: async () => {
    const unread = get().persisted.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    await get().markRead(unread);
  },

  remove: async (ids) => {
    if (ids.length === 0) return;
    set((s) => ({ persisted: s.persisted.filter((n) => !ids.includes(n.id)) }));
    await callApi("DELETE", { ids });
  },

  clearAll: async () => {
    set({ persisted: [] });
    await callApi("DELETE", { all: true });
  },

  computed: [],
  setComputed: (list) => set({ computed: Array.isArray(list) ? list : [] }),

  computedReadIds: [],
  setComputedReadIds: (ids) => set({ computedReadIds: Array.isArray(ids) ? ids : [] }),

  markComputedRead: (ids, uid) => {
    const current = get().computedReadIds;
    const next = Array.from(new Set([...current, ...ids]));
    if (next.length === current.length) return;
    set({ computedReadIds: next });
    if (uid && typeof window !== "undefined") {
      try {
        const stored = readLocalArray(`read_notifications_${uid}`);
        localStorage.setItem(`read_notifications_${uid}`, JSON.stringify(Array.from(new Set([...stored, ...next]))));
      } catch {}
    }
  },

  dismissedComputedIds: readLocalArray(DELETED_KEY),

  dismissComputed: (ids) => {
    if (ids.length === 0) return;
    const next = Array.from(new Set([...get().dismissedComputedIds, ...readLocalArray(DELETED_KEY), ...ids]));
    set({ dismissedComputedIds: next });
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DELETED_KEY, JSON.stringify(next));
      const raw = localStorage.getItem(ALL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw).filter((p: any) => !ids.includes(p.id));
        localStorage.setItem(ALL_KEY, JSON.stringify(parsed));
      }
    } catch {}
  },
}));

/** Extract the Action Board task id from a computed `task-{taskId}-{createdAt}` id. */
function computedTaskId(id: string): string | null {
  if (!id.startsWith("task-") || id.startsWith("task-overdue-")) return null;
  return id.slice(5).replace(/-\d+$/, "") || null;
}

/**
 * Merge persisted + computed notifications into one display list, newest first.
 * - Persisted items are mapped into the layout's display shape.
 * - A computed "New task assigned/request" item is skipped when a persisted
 *   `action_board_assigned` notification exists for the same task (refId).
 * - Computed items the user deleted are filtered out.
 */
export function mergeNotifications(
  persisted: AppNotification[],
  computed: any[],
  computedReadIds: string[] = [],
  dismissedComputedIds: string[] = [],
): DisplayNotification[] {
  const persistedTaskRefs = new Set(
    persisted.filter((n) => n.type === "action_board_assigned" && n.refId).map((n) => n.refId as string),
  );
  const readSet = new Set(computedReadIds);
  const dismissedSet = new Set(dismissedComputedIds);

  const fromPersisted: DisplayNotification[] = persisted.map((n) => ({
    id: n.id,
    title: n.title,
    desc: n.body,
    time: typeof n.createdAt === "number" ? n.createdAt : Number(n.createdAt) || 0,
    type: n.type,
    link: n.link,
    read: !!n.read,
    source: "persisted",
    actorName: n.actorName,
    refId: n.refId,
  }));

  const persistedIds = new Set(fromPersisted.map((n) => n.id));
  const fromComputed: DisplayNotification[] = [];
  for (const c of computed) {
    if (!c || typeof c.id !== "string") continue;
    if (persistedIds.has(c.id) || dismissedSet.has(c.id)) continue;
    const taskId = computedTaskId(c.id);
    if (taskId && persistedTaskRefs.has(taskId)) continue;
    fromComputed.push({
      id: c.id,
      title: c.title,
      desc: c.desc,
      time: typeof c.time === "number" ? c.time : Number(c.time) || 0,
      type: c.type,
      link: c.link,
      read: readSet.has(c.id),
      source: "computed",
      icon: c.icon,
      bg: c.bg,
    });
  }

  return [...fromPersisted, ...fromComputed].sort((a, b) => b.time - a.time);
}

/** Hook returning the memoized merged list (safe for zustand v4 — no new-array selectors). */
export function useMergedNotifications(): DisplayNotification[] {
  const persisted = useNotificationStore((s) => s.persisted);
  const computed = useNotificationStore((s) => s.computed);
  const computedReadIds = useNotificationStore((s) => s.computedReadIds);
  const dismissedComputedIds = useNotificationStore((s) => s.dismissedComputedIds);
  return useMemo(
    () => mergeNotifications(persisted, computed, computedReadIds, dismissedComputedIds),
    [persisted, computed, computedReadIds, dismissedComputedIds],
  );
}
