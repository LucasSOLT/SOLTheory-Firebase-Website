"use client";

import { useState, useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { X, Bot, Sparkles, Loader2, Plus } from "lucide-react";
import { GrantAgentConfigModal, type GrantAgentConfig } from "./GrantAgentConfigModal";
import { GrantAgentBrowserSim } from "./GrantAgentBrowserSim";

/* ─── Types ─── */
export interface AgentSlot {
  id: string;
  name: string;
  config: GrantAgentConfig | null;
  active: boolean;
}

const SLOT_COLORS = [
  { bg: "from-indigo-500 to-violet-600", ring: "ring-indigo-500/30", dot: "bg-indigo-400", label: "text-indigo-600", tagBg: "bg-indigo-50", tagBorder: "border-indigo-200" },
  { bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-500/30", dot: "bg-emerald-400", label: "text-emerald-600", tagBg: "bg-emerald-50", tagBorder: "border-emerald-200" },
  { bg: "from-amber-500 to-orange-600", ring: "ring-amber-500/30", dot: "bg-amber-400", label: "text-amber-600", tagBg: "bg-amber-50", tagBorder: "border-amber-200" },
  { bg: "from-rose-500 to-pink-600", ring: "ring-rose-500/30", dot: "bg-rose-400", label: "text-rose-600", tagBg: "bg-rose-50", tagBorder: "border-rose-200" },
];

const DEFAULT_AGENT_NAMES = [
  "Grant Scout Alpha",
  "Grant Scout Beta",
  "Grant Scout Gamma",
  "Grant Scout Delta",
];

/* ─── Hub Component ─── */
export function GrantAgentHub({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AgentSlot[]>(
    DEFAULT_AGENT_NAMES.map((name, i) => ({
      id: `agent_${i + 1}`,
      name,
      config: null,
      active: false,
    }))
  );
  const [configuringSlotIndex, setConfiguringSlotIndex] = useState<number | null>(null);

  // Load saved agent configs from Firestore
  useEffect(() => {
    async function load() {
      if (!firestore) return;
      try {
        const docRef = doc(firestore, "grant_agent_config", "soltheory");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const agents = data.agents as Record<string, { name: string; config: GrantAgentConfig; active: boolean }> | undefined;
          if (agents) {
            setSlots((prev) =>
              prev.map((slot) => {
                const saved = agents[slot.id];
                if (saved) {
                  return {
                    ...slot,
                    name: saved.name || slot.name,
                    config: saved.config || null,
                    active: saved.active ?? false,
                  };
                }
                return slot;
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to load agent hub config:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [firestore]);

  // Save a single agent's config after the modal closes
  async function handleSaveAgent(index: number, config: GrantAgentConfig) {
    const updatedSlots = [...slots];
    updatedSlots[index] = {
      ...updatedSlots[index],
      config,
      active: true,
    };
    setSlots(updatedSlots);
    setConfiguringSlotIndex(null);

    // Persist to Firestore — the AgentWorkerController will detect the
    // change via onSnapshot and start/stop workers automatically
    if (!firestore) return;
    try {
      const docRef = doc(firestore, "grant_agent_config", "soltheory");
      const agentsMap: Record<string, any> = {};
      updatedSlots.forEach((slot) => {
        agentsMap[slot.id] = {
          name: slot.name,
          config: slot.config,
          active: slot.active,
        };
      });
      await setDoc(docRef, { agents: agentsMap, updatedAt: new Date(), updatedBy: user?.uid || null }, { merge: true });
    } catch (err) {
      console.error("Failed to save agent config:", err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
            Grant Search Agents
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-[12px] text-slate-500">
            Configure up to 4 autonomous grant search agents. Each agent scans for opportunities matching its unique filter criteria.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 gap-4">
            {slots.map((slot, index) => {
              const colors = SLOT_COLORS[index];
              const isActive = slot.active && slot.config;

              return (
                <button
                  key={slot.id}
                  onClick={() => setConfiguringSlotIndex(index)}
                  className={`group relative rounded-2xl border-2 p-5 text-left transition-all cursor-pointer ${
                    isActive
                      ? `border-transparent ring-2 ${colors.ring} bg-white shadow-md hover:shadow-lg`
                      : "border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  {isActive ? (
                    <>
                      {/* Active agent card — browser sim */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-sm`}>
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <h4 className="text-[11px] font-bold text-slate-900 leading-tight">{slot.name}</h4>
                            <p className="text-[8px] text-slate-400 font-medium">
                              {slot.config!.locationCity && slot.config!.locationState
                                ? `${slot.config!.locationCity}, ${slot.config!.locationState}`
                                : "Scanning..."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
                          <span className={`text-[8px] font-bold uppercase tracking-wider ${colors.label}`}>Live</span>
                        </div>
                      </div>
                      {/* Browser Simulation Viewport */}
                      <div className="flex-1 min-h-[120px] relative">
                        <GrantAgentBrowserSim config={slot.config!} colorTheme={{ dot: colors.dot, label: colors.label }} />
                      </div>
                      {/* Click to edit hint */}
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/[0.03] transition-colors flex items-center justify-center z-10">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200/60">
                          Click to Edit
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Empty agent slot */}
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center mb-3 group-hover:border-slate-300 transition-colors">
                          <Plus className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-400 mb-0.5">{slot.name}</h4>
                        <p className="text-[10px] text-slate-300">
                          Click to configure &amp; deploy
                        </p>
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-slate-400 font-medium">
              {slots.filter((s) => s.active).length} of {slots.length} agents deployed
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Nested filter config modal */}
      {configuringSlotIndex !== null && (
        <GrantAgentConfigModal
          initialConfig={slots[configuringSlotIndex].config ?? undefined}
          onClose={() => setConfiguringSlotIndex(null)}
          onSave={(config) => handleSaveAgent(configuringSlotIndex, config)}
        />
      )}
    </div>
  );
}
