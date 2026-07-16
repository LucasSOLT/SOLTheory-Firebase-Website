"use client";

import { useEffect, useRef } from "react";
import { useFirestore } from "@/firebase";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import type { GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";
import { startAgentWorker, stopAgentWorker, stopAllAgentWorkers } from "@/services/grantAgentWorker";

export interface AgentSlotData {
  id: string;
  name: string;
  config: GrantAgentConfig | null;
  active: boolean;
}

const DEFAULT_NAMES = [
  "Global Grant Scout",
  "Health & Human Services",
  "Community Development",
  "Custom Agent",
];

/**
 * Agent Worker Controller — SESSION-AWARE.
 *
 * Listens to ALL `grant_sessions` documents for the org.
 * For each session with active agents, starts workers keyed as
 * `{sessionId}_agent_{n}` to prevent collisions between sessions.
 *
 * Also still listens to the legacy `grant_agent_config/soltheory`
 * for backwards compatibility during migration.
 *
 * Protected by:
 * - setTimeout chains (stale callbacks die, no ghost intervals)
 * - window-stored handles (survive HMR)
 * - Firestore timing gate (prevents duplicate scans across tabs)
 */
export function AgentWorkerController({
  onSlotsChange,
}: {
  onSlotsChange?: (slots: AgentSlotData[]) => void;
}) {
  const firestore = useFirestore();
  // Maps workerKey → configHash so we only restart when config actually changes
  const startedRef = useRef<Map<string, string>>(new Map());
  const callbackRef = useRef(onSlotsChange);

  useEffect(() => {
    callbackRef.current = onSlotsChange;
  }, [onSlotsChange]);

  // ─── Session-aware worker orchestration ───
  useEffect(() => {
    if (!firestore) return;

    // Kill any orphaned workers from previous HMR / mount cycles
    stopAllAgentWorkers();
    startedRef.current.clear();

    const sessionsQuery = query(
      collection(firestore, "grant_sessions"),
      where("orgId", "==", "soltheory")
    );

    const unsub = onSnapshot(
      sessionsQuery,
      (snap) => {
        // Collect all workerKeys that should currently be active
        const activeWorkerKeys = new Set<string>();

        // Collect first session's slots for the dashboard callback
        let firstSessionSlots: AgentSlotData[] | null = null;

        snap.forEach((docSnap) => {
          const sessionId = docSnap.id;
          const data = docSnap.data();
          const agents = data?.agents as Record<string, {
            name: string;
            active: boolean;
            config: GrantAgentConfig | null;
          }> | undefined;
          const sessionSearchMode = (data?.searchMode as 'federal' | 'philanthropic') || 'federal';

          if (!agents) return;

          // Build slots for each agent in this session
          DEFAULT_NAMES.forEach((defaultName, i) => {
            const agentId = `agent_${i + 1}`;
            const saved = agents[agentId];
            const workerKey = `${sessionId}_${agentId}`;

            if (saved?.active && saved?.config) {
              activeWorkerKeys.add(workerKey);

              // Hash only the config to detect changes
              const configHash = JSON.stringify(saved.config);
              const prevHash = startedRef.current.get(workerKey);

              if (prevHash !== configHash) {
                console.log(`[Controller] Starting worker ${workerKey} (mode: ${sessionSearchMode})`);

                // Reset timing gate for this agent in the session document
                setDoc(
                  doc(firestore, "grant_sessions", sessionId),
                  { lastScanTimes: { [agentId]: null } },
                  { merge: true }
                ).catch(() => {});

                // Start the worker with sessionId and searchMode
                startAgentWorker(firestore, workerKey, saved.config, undefined, sessionId, sessionSearchMode);
                startedRef.current.set(workerKey, configHash);
              }
            }
          });

          // Use first session's slots for the dashboard callback
          if (!firstSessionSlots) {
            firstSessionSlots = DEFAULT_NAMES.map((name, i) => {
              const agentId = `agent_${i + 1}`;
              const saved = agents[agentId];
              return {
                id: agentId,
                name: saved?.name || name,
                config: saved?.config || null,
                active: saved?.active ?? false,
              };
            });
          }
        });

        // Stop any workers that are no longer in any active session
        for (const [workerKey] of startedRef.current) {
          if (!activeWorkerKeys.has(workerKey)) {
            console.log(`[Controller] Stopping orphaned worker ${workerKey}`);
            stopAgentWorker(workerKey);
            startedRef.current.delete(workerKey);
          }
        }

        // Notify dashboard with first session's slots
        if (firstSessionSlots) {
          callbackRef.current?.(firstSessionSlots);
        } else {
          // No sessions — send default empty slots
          callbackRef.current?.(
            DEFAULT_NAMES.map((name, i) => ({
              id: `agent_${i + 1}`,
              name,
              config: null,
              active: false,
            }))
          );
        }
      },
      (err) => {
        console.error("AgentWorkerController snapshot error:", err);
        callbackRef.current?.(
          DEFAULT_NAMES.map((name, i) => ({
            id: `agent_${i + 1}`,
            name,
            config: null,
            active: false,
          }))
        );
      }
    );

    return () => {
      unsub();
      stopAllAgentWorkers();
      startedRef.current.clear();
    };
  }, [firestore]);

  return null;
}
