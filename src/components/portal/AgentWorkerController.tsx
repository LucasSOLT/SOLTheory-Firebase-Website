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
  "Grant Scout Alpha",
  "Grant Scout Beta",
  "Grant Scout Gamma",
  "Grant Scout Delta",
];

/**
 * Persistent invisible controller that manages agent worker lifecycles.
 * Lives at the dashboard page level so workers survive modal open/close.
 * Uses Firestore onSnapshot to react to config changes in real-time.
 */
export function AgentWorkerController({
  onSlotsChange,
}: {
  onSlotsChange?: (slots: AgentSlotData[]) => void;
}) {
  const firestore = useFirestore();
  const startedRef = useRef<Set<string>>(new Set());
  const callbackRef = useRef(onSlotsChange);

  // Keep callback ref current without re-subscribing
  useEffect(() => {
    callbackRef.current = onSlotsChange;
  }, [onSlotsChange]);

  useEffect(() => {
    if (!firestore) return;

    const docRef = doc(firestore, "grant_agent_config", "soltheory");

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        // Build default slots even if document doesn't exist yet
        const agents = snap.exists()
          ? (snap.data().agents as Record<string, { name: string; config: GrantAgentConfig; active: boolean }> | undefined)
          : undefined;

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

        // Start/stop workers based on active state
        slots.forEach((slot) => {
          if (slot.active && slot.config) {
            if (!startedRef.current.has(slot.id)) {
              startAgentWorker(firestore, slot.id, slot.config);
              startedRef.current.add(slot.id);
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
        // Still send default empty slots so the UI doesn't break
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
  }, [firestore]); // Only depend on firestore — callbackRef handles the rest

  return null;
}
