"use client";

import { useEffect, useRef } from "react";
import { useFirestore } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";
import { startAgentWorker, stopAgentWorker, stopAllAgentWorkers } from "@/services/grantAgentWorker";

export interface AgentSlotData {
  id: string;
  name: string;
  config: GrantAgentConfig | null;
  active: boolean;
}

const DEFAULT_NAMES = [
  "Global Grant Scout"
];

/**
 * Agent Worker Controller.
 * 
 * Listens to Firestore config changes. When the config hash changes
 * (e.g. interval updated from 1 hour → 1 minute), the worker is
 * stopped and restarted with the new settings immediately.
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
  const startedRef = useRef<Map<string, string>>(new Map());
  const callbackRef = useRef(onSlotsChange);

  useEffect(() => {
    callbackRef.current = onSlotsChange;
  }, [onSlotsChange]);

  useEffect(() => {
    if (!firestore) return;

    // Kill any orphaned workers from previous HMR / mount cycles
    stopAllAgentWorkers();
    startedRef.current.clear();

    const docRef = doc(firestore, "grant_agent_config", "soltheory");

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        const data = snap.exists() ? snap.data() : undefined;
        const agents = data?.agents as Record<string, { name: string; config: GrantAgentConfig; active: boolean }> | undefined;

        const slots: AgentSlotData[] = DEFAULT_NAMES.map((name, i) => {
          const id = `agent_${i + 1}`;
          const saved = agents?.[id];
          return {
            id,
            name: saved?.name || name,
            config: saved?.config || null,
            active: saved?.active ?? false,
          };
        });

        slots.forEach((slot) => {
          // Hash ONLY the config fields that affect the worker
          // (not lastScanTimes or other metadata that would cause loops)
          const configHash = slot.config ? JSON.stringify(slot.config) : "";

          if (slot.active && slot.config) {
            const prevHash = startedRef.current.get(slot.id);
            if (prevHash !== configHash) {
              // Config changed (interval, categories, location, etc.) — restart
              console.log(`[Controller] Config changed for ${slot.id} — restarting worker`);
              startAgentWorker(firestore, slot.id, slot.config);
              startedRef.current.set(slot.id, configHash);
            }
          } else {
            if (startedRef.current.has(slot.id)) {
              stopAgentWorker(slot.id);
              startedRef.current.delete(slot.id);
            }
          }
        });

        callbackRef.current?.(slots);
      },
      (err) => {
        console.error("AgentWorkerController snapshot error:", err);
        const defaultSlots: AgentSlotData[] = DEFAULT_NAMES.map((name, i) => ({
          id: `agent_${i + 1}`,
          name,
          config: null,
          active: false,
        }));
        callbackRef.current?.(defaultSlots);
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
