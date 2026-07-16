"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type { GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";
import { DEFAULT_CONFIG } from "@/components/portal/GrantAgentConfigModal";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface GrantSession {
  id: string;
  orgId: string;
  name: string;
  color: SessionColor;
  config: GrantAgentConfig;
  agents: Record<string, { name: string; active: boolean; config: GrantAgentConfig | null }>;
  lastScanTimes: Record<string, Timestamp | null>;
  searchMode: 'federal' | 'philanthropic';
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
  active: boolean;
}

export type SessionColor =
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "teal"
  | "orange"
  | "fuchsia"
  | "slate";

export const SESSION_COLORS: SessionColor[] = [
  "indigo", "emerald", "amber", "rose", "sky",
  "violet", "teal", "orange", "fuchsia", "slate",
];

export const SESSION_COLOR_THEMES: Record<SessionColor, {
  bg: string; ring: string; dot: string; label: string; text: string;
  pillBg: string; pillBorder: string; pillText: string;
}> = {
  indigo:  { bg: "from-indigo-500 to-violet-600",  ring: "ring-indigo-500/30",  dot: "bg-indigo-400",  label: "text-indigo-600",  text: "text-indigo-700",  pillBg: "bg-indigo-50",  pillBorder: "border-indigo-200",  pillText: "text-indigo-700" },
  emerald: { bg: "from-emerald-500 to-teal-600",   ring: "ring-emerald-500/30", dot: "bg-emerald-400", label: "text-emerald-600", text: "text-emerald-700", pillBg: "bg-emerald-50", pillBorder: "border-emerald-200", pillText: "text-emerald-700" },
  amber:   { bg: "from-amber-500 to-orange-600",   ring: "ring-amber-500/30",   dot: "bg-amber-400",   label: "text-amber-600",   text: "text-amber-700",   pillBg: "bg-amber-50",   pillBorder: "border-amber-200",   pillText: "text-amber-700" },
  rose:    { bg: "from-rose-500 to-pink-600",       ring: "ring-rose-500/30",    dot: "bg-rose-400",    label: "text-rose-600",    text: "text-rose-700",    pillBg: "bg-rose-50",    pillBorder: "border-rose-200",    pillText: "text-rose-700" },
  sky:     { bg: "from-sky-500 to-cyan-600",        ring: "ring-sky-500/30",     dot: "bg-sky-400",     label: "text-sky-600",     text: "text-sky-700",     pillBg: "bg-sky-50",     pillBorder: "border-sky-200",     pillText: "text-sky-700" },
  violet:  { bg: "from-violet-500 to-purple-600",   ring: "ring-violet-500/30",  dot: "bg-violet-400",  label: "text-violet-600",  text: "text-violet-700",  pillBg: "bg-violet-50",  pillBorder: "border-violet-200",  pillText: "text-violet-700" },
  teal:    { bg: "from-teal-500 to-emerald-600",    ring: "ring-teal-500/30",    dot: "bg-teal-400",    label: "text-teal-600",    text: "text-teal-700",    pillBg: "bg-teal-50",    pillBorder: "border-teal-200",    pillText: "text-teal-700" },
  orange:  { bg: "from-orange-500 to-red-600",      ring: "ring-orange-500/30",  dot: "bg-orange-400",  label: "text-orange-600",  text: "text-orange-700",  pillBg: "bg-orange-50",  pillBorder: "border-orange-200",  pillText: "text-orange-700" },
  fuchsia: { bg: "from-fuchsia-500 to-pink-600",    ring: "ring-fuchsia-500/30", dot: "bg-fuchsia-400", label: "text-fuchsia-600", text: "text-fuchsia-700", pillBg: "bg-fuchsia-50", pillBorder: "border-fuchsia-200", pillText: "text-fuchsia-700" },
  slate:   { bg: "from-slate-500 to-gray-600",      ring: "ring-slate-500/30",   dot: "bg-slate-400",   label: "text-slate-600",   text: "text-slate-700",   pillBg: "bg-slate-50",   pillBorder: "border-slate-200",   pillText: "text-slate-700" },
};

const MAX_SESSIONS = 10;

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useGrantSessions(orgId: string = "soltheory") {
  const firestore = useFirestore();
  const { user } = useUser();
  const [sessions, setSessions] = useState<GrantSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);

  // Real-time listener on grant_sessions collection
  useEffect(() => {
    if (!firestore) return;

    const q = query(
      collection(firestore, "grant_sessions"),
      where("orgId", "==", orgId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const loaded: GrantSession[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          orgId: data.orgId || orgId,
          name: data.name || "Untitled Session",
          color: data.color || "indigo",
          config: { ...DEFAULT_CONFIG, ...data.config },
          agents: data.agents || {},
          lastScanTimes: data.lastScanTimes || {},
          searchMode: data.searchMode || 'federal',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          updatedBy: data.updatedBy || null,
          active: data.active ?? true,
        });
      });

      // Sort by createdAt ascending (client-side to avoid composite index)
      loaded.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      setSessions(loaded);

      // Auto-select first session if none selected
      if (!activeSessionId && loaded.length > 0) {
        setActiveSessionId(loaded[0].id);
      }

      setLoading(false);
    }, (err) => {
      // Firestore permission or index errors — degrade gracefully
      console.warn("[useGrantSessions] Snapshot error (possibly missing permissions):", err.message);
      setSessions([]);
      setLoading(false);
    });

    return () => unsub();
  }, [firestore, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Migration: check if we need to migrate from old grant_agent_config
  // Uses localStorage to prevent re-triggering after user intentionally deletes all sessions
  useEffect(() => {
    if (!firestore || loading || migrated) return;

    // If sessions exist, migration is clearly done
    if (sessions.length > 0) {
      setMigrated(true);
      return;
    }

    // Check localStorage — if migration already ran for this org, don't re-create sessions
    const migrationKey = `grant_sessions_migrated_${orgId}`;
    if (typeof window !== "undefined" && localStorage.getItem(migrationKey) === "true") {
      setMigrated(true);
      return;
    }

    // No sessions found and no migration flag — attempt migration from old format
    async function migrate() {
      try {
        const oldDocRef = doc(firestore!, "grant_agent_config", orgId);
        const oldSnap = await getDoc(oldDocRef);

        if (oldSnap.exists()) {
          const oldData = oldSnap.data();
          const oldAgents = oldData.agents as Record<string, any> | undefined;

          if (oldAgents && Object.keys(oldAgents).length > 0) {
            // Find the first agent with a config to use as the session config
            const firstAgentWithConfig = Object.values(oldAgents).find((a: any) => a.config);
            const sessionConfig = firstAgentWithConfig?.config
              ? { ...DEFAULT_CONFIG, ...firstAgentWithConfig.config }
              : DEFAULT_CONFIG;

            // Create the default session
            const sessionId = `session_${Date.now()}`;
            const sessionRef = doc(firestore!, "grant_sessions", sessionId);

            // Build agents map for the session (including per-agent config)
            const sessionAgents: Record<string, { name: string; active: boolean; config: any }> = {};
            for (const [agentId, agentData] of Object.entries(oldAgents)) {
              const agent = agentData as { name: string; active: boolean; config?: any };
              sessionAgents[agentId] = {
                name: agent.name || agentId,
                active: agent.active ?? false,
                config: agent.config || null,
              };
            }

            await setDoc(sessionRef, {
              orgId,
              name: "Default Session",
              color: "indigo",
              config: sessionConfig,
              agents: sessionAgents,
              lastScanTimes: oldData.lastScanTimes || {},
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              updatedBy: user?.uid || null,
              active: true,
            });

            // Update existing grant_suggestions to add sessionId
            const grantsQuery = query(
              collection(firestore!, "grant_suggestions"),
              where("orgId", "==", orgId)
            );
            const grantsSnap = await getDocs(grantsQuery);

            if (!grantsSnap.empty) {
              const batch = writeBatch(firestore!);
              let count = 0;
              grantsSnap.forEach((grantDoc) => {
                if (!grantDoc.data().sessionId) {
                  batch.update(grantDoc.ref, { sessionId });
                  count++;
                }
              });
              if (count > 0) {
                await batch.commit();
                console.log(`[useGrantSessions] Migrated ${count} grant_suggestions with sessionId`);
              }
            }

            setActiveSessionId(sessionId);
            console.log("[useGrantSessions] Migrated old config to session:", sessionId);
          }
        }

        // If no old config either, auto-create a default session (first time only)
        if (!oldSnap.exists() || !oldSnap.data()?.agents) {
          const sessionId = `session_${Date.now()}`;
          const sessionRef = doc(firestore!, "grant_sessions", sessionId);
          await setDoc(sessionRef, {
            orgId,
            name: "Default Session",
            color: "indigo",
            config: DEFAULT_CONFIG,
            agents: {},
            lastScanTimes: {},
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            updatedBy: user?.uid || null,
            active: true,
          });
          setActiveSessionId(sessionId);
          console.log("[useGrantSessions] Created default session:", sessionId);
        }

        // Mark migration as done so it never re-triggers
        if (typeof window !== "undefined") {
          localStorage.setItem(migrationKey, "true");
        }
        setMigrated(true);
      } catch (err) {
        console.error("[useGrantSessions] Migration failed:", err);
        setMigrated(true);
      }
    }

    migrate();
  }, [firestore, loading, migrated, sessions.length, orgId, user?.uid]);

  // Active session
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  // Create a new session
  const createSession = useCallback(
    async (name: string, config: GrantAgentConfig, color?: SessionColor, searchMode?: 'federal' | 'philanthropic'): Promise<string | null> => {
      if (!firestore) return null;
      if (sessions.length >= MAX_SESSIONS) {
        console.warn("[useGrantSessions] Max sessions reached");
        return null;
      }

      try {
        const sessionId = `session_${Date.now()}`;
        const sessionRef = doc(firestore, "grant_sessions", sessionId);
        const chosenColor = color || SESSION_COLORS[sessions.length % SESSION_COLORS.length];

        await setDoc(sessionRef, {
          orgId,
          name,
          color: chosenColor,
          config,
          agents: {
            agent_1: { name: "Primary Scout", active: true },
          },
          lastScanTimes: {},
          searchMode: searchMode || 'federal',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy: user?.uid || null,
          active: true,
        });

        setActiveSessionId(sessionId);
        console.log("[useGrantSessions] Created session:", sessionId, "mode:", searchMode || 'federal');
        return sessionId;
      } catch (err) {
        console.error("[useGrantSessions] Failed to create session:", err);
        return null;
      }
    },
    [firestore, sessions.length, orgId, user?.uid]
  );

  // Update a session
  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<Omit<GrantSession, "id" | "orgId" | "createdAt">>) => {
      if (!firestore) return;
      try {
        const sessionRef = doc(firestore, "grant_sessions", sessionId);
        await setDoc(
          sessionRef,
          {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: user?.uid || null,
          },
          { merge: true }
        );
        console.log("[useGrantSessions] Updated session:", sessionId);
      } catch (err) {
        console.error("[useGrantSessions] Failed to update session:", err);
      }
    },
    [firestore, user?.uid]
  );

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: string, purgeGrants: boolean = false) => {
      if (!firestore) return;
      try {
        // Optionally delete all grants associated with this session
        if (purgeGrants) {
          const grantsQuery = query(
            collection(firestore, "grant_suggestions"),
            where("sessionId", "==", sessionId)
          );
          const grantsSnap = await getDocs(grantsQuery);
          const batch = writeBatch(firestore);
          grantsSnap.forEach((grantDoc) => {
            batch.delete(grantDoc.ref);
          });
          await batch.commit();
          console.log(`[useGrantSessions] Purged ${grantsSnap.size} grants for session ${sessionId}`);
        }

        // Delete the session document
        await deleteDoc(doc(firestore, "grant_sessions", sessionId));

        // Switch to another session if the deleted one was active
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
        }

        console.log("[useGrantSessions] Deleted session:", sessionId);
      } catch (err) {
        console.error("[useGrantSessions] Failed to delete session:", err);
      }
    },
    [firestore, activeSessionId, sessions]
  );

  // Rename a session
  const renameSession = useCallback(
    async (sessionId: string, newName: string) => {
      await updateSession(sessionId, { name: newName });
    },
    [updateSession]
  );

  // Update agents for a specific session
  const updateSessionAgents = useCallback(
    async (
      sessionId: string,
      agents: Record<string, { name: string; active: boolean; config: GrantAgentConfig | null }>
    ) => {
      if (!firestore) return;
      try {
        await setDoc(
          doc(firestore, "grant_sessions", sessionId),
          { agents, updatedAt: Timestamp.now() },
          { merge: true }
        );
      } catch (err) {
        console.error("[useGrantSessions] Failed to update agents:", err);
      }
    },
    [firestore]
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    loading: loading && !migrated,
    createSession,
    updateSession,
    updateSessionAgents,
    deleteSession,
    renameSession,
    canCreateMore: sessions.length < MAX_SESSIONS,
  };
}
