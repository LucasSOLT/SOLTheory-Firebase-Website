"use client";

import { Bot } from "lucide-react";
import { GrantAgentBrowserSim } from "./GrantAgentBrowserSim";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from '@/lib/useDarkMode';
import type { AgentSlotData } from "./AgentWorkerController";

const SLOT_COLORS = [
  { bg: "from-indigo-500 to-violet-600", dot: "bg-indigo-400", label: "text-indigo-600" },
  { bg: "from-emerald-500 to-teal-600", dot: "bg-emerald-400", label: "text-emerald-600" },
  { bg: "from-amber-500 to-orange-600", dot: "bg-amber-400", label: "text-amber-600" },
  { bg: "from-rose-500 to-pink-600", dot: "bg-rose-400", label: "text-rose-600" },
];

/**
 * Renders live mini browser-sim previews for all active agents directly
 * inside the dashboard Tile 3 card. This persists regardless of whether
 * the Grant Agent Hub modal is open or closed.
 */
export function ActiveAgentsPreview({
  slots,
  onOpenHub,
}: {
  slots: AgentSlotData[];
  onOpenHub: () => void;
}) {
  const { t } = useTranslation();
  const isDarkMode = useDarkMode();
  const activeSlots = slots.filter((s) => s.active && s.config);

  if (activeSlots.length === 0) {
    return (
      <button
        onClick={onOpenHub}
        className={`flex-1 flex items-center justify-center border border-dashed rounded-xl min-h-[40px] py-1 px-2 transition-colors cursor-pointer ${isDarkMode ? 'border-indigo-700 bg-indigo-900/20 hover:bg-indigo-900/40' : 'border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/40'}`}
      >
        <span className={`text-[8px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-400'}`}>
          {t.configureFilters}
        </span>
      </button>
    );
  }

  return (
    <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
      {slots.map((slot, i) => {
        const colors = SLOT_COLORS[i % SLOT_COLORS.length];
        const isActive = slot.active && slot.config;

        if (!isActive) {
          return (
            <button
              key={slot.id}
              onClick={onOpenHub}
              className={`rounded-xl border border-dashed flex items-center justify-center transition-colors cursor-pointer min-h-[60px] ${isDarkMode ? 'border-slate-600 bg-slate-800/30 hover:bg-slate-800/60' : 'border-slate-200 bg-[#faf6ed]/30 hover:bg-[#faf6ed]/60'}`}
            >
              <span className={`text-[7px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>
                {t.empty}
              </span>
            </button>
          );
        }

        return (
          <button
            key={slot.id}
            onClick={onOpenHub}
            className={`rounded-xl border shadow-sm p-2 flex flex-col min-h-[60px] hover:shadow transition-shadow cursor-pointer text-left overflow-hidden ${isDarkMode ? 'border-slate-700/60 bg-slate-800' : 'border-slate-200/60 bg-[#fefcf6]'}`}
          >
            {/* Mini header */}
            <div className="flex items-center justify-between mb-1 shrink-0">
              <div className="flex items-center gap-1">
                <div
                  className={`w-4 h-4 rounded bg-gradient-to-br ${colors.bg} flex items-center justify-center`}
                >
                  <Bot className="w-2.5 h-2.5 text-white" />
                </div>
                <span className={`text-[7px] font-bold truncate max-w-[60px] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {slot.name.replace("Grant Scout ", "")}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <div className={`w-1 h-1 rounded-full ${colors.dot} animate-pulse`} />
                <span className={`text-[6px] font-bold uppercase ${colors.label}`}>{t.live}</span>
              </div>
            </div>
            {/* Mini browser sim */}
            <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden">
              <GrantAgentBrowserSim
                config={slot.config!}
                colorTheme={{ dot: colors.dot, label: colors.label }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
