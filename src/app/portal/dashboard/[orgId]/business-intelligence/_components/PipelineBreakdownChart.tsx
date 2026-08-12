"use client";

import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown } from "lucide-react";
import type { CRMContact, BIPipelineConfig } from "../_hooks/useBIData";
import { PIPELINE_PRESETS } from "@/components/crm/PipelineSetup";

/* ── Default sales stages (ultimate fallback) ── */

const DEFAULT_SALES_STAGES = [
  { id: "cold_lead", name: "Cold Lead", color: "#3B82F6" },
  { id: "warm_lead", name: "Warm Lead", color: "#F97316" },
  { id: "interested", name: "Interested", color: "#8B5CF6" },
  { id: "sale_completed", name: "Sale Completed", color: "#10B981" },
];

const UNTAGGED_COLOR = "#94A3B8";

/* ── Local storage key for persisted selection ── */
const LS_KEY = "bi-pipeline-selection";

/* ── Component ─────────────────────────────────────────── */

export default function PipelineBreakdownChart({
  contacts,
  pipelineConfig,
  dk,
}: {
  contacts: CRMContact[];
  pipelineConfig: BIPipelineConfig | null;
  dk: boolean;
}) {
  /* ── Build the list of available pipelines ── */
  const pipelineOptions = useMemo(() => {
    const options: { id: string; name: string; stages: { id: string; name: string; color: string }[] }[] = [];

    // Add all presets
    for (const preset of PIPELINE_PRESETS) {
      options.push({
        id: preset.id,
        name: preset.name,
        stages: preset.stages.filter((s) => s.id !== "un_tagged"),
      });
    }

    // Add custom pipeline if one is saved and it's not a preset
    if (pipelineConfig && pipelineConfig.id === "custom") {
      options.push({
        id: "custom",
        name: pipelineConfig.name,
        stages: pipelineConfig.stages.filter((s) => s.id !== "un_tagged"),
      });
    }

    return options;
  }, [pipelineConfig]);

  /* ── Persisted selection ── */
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LS_KEY) || "sales";
    }
    return "sales";
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, selectedPipelineId);
    }
  }, [selectedPipelineId]);

  // Resolve the selected pipeline's stages
  const activePipeline = pipelineOptions.find((p) => p.id === selectedPipelineId) || pipelineOptions[0];
  const activeStages = activePipeline?.stages || DEFAULT_SALES_STAGES;

  /* ── Compute chart data ── */
  const data = useMemo(() => {
    const stageNameSet = new Set(activeStages.flatMap((s) => [s.name, s.id]));
    const stageColorMap = new Map<string, string>();
    for (const s of activeStages) {
      stageColorMap.set(s.name, s.color);
      stageColorMap.set(s.id, s.color);
    }

    const counts = new Map<string, number>();
    let untaggedCount = 0;

    for (const c of contacts) {
      const status = c.leadStatus;
      if (!status || !stageNameSet.has(status)) {
        untaggedCount++;
      } else {
        counts.set(status, (counts.get(status) || 0) + 1);
      }
    }

    const result: { name: string; value: number; color: string }[] = [];

    // Un-Tagged first (only if there are some)
    if (untaggedCount > 0) {
      result.push({ name: "Un-Tagged", value: untaggedCount, color: UNTAGGED_COLOR });
    }

    // Then each stage in pipeline order
    for (const stage of activeStages) {
      const count = counts.get(stage.name) || counts.get(stage.id) || 0;
      if (count > 0) {
        result.push({ name: stage.name, value: count, color: stage.color });
      }
    }

    return result;
  }, [contacts, activeStages]);

  const total = contacts.length;

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    return (
      <div
        className={`px-3 py-2 rounded-lg shadow-lg border text-xs ${
          dk ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold">{d.name}</p>
        <p>
          {d.value} contact{d.value !== 1 ? "s" : ""} ({pct}%)
        </p>
      </div>
    );
  };

  return (
    <div>
      {/* Pipeline selector dropdown */}
      <div className="relative mb-3">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            dk
              ? "bg-slate-700/60 text-slate-300 border-slate-600 hover:border-slate-500"
              : "bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          {activePipeline?.name || "Sales Pipeline"}
          <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div
              className={`absolute top-full left-0 mt-1 w-52 rounded-lg shadow-xl border z-50 py-1 ${
                dk ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
              }`}
            >
              {pipelineOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPipelineId(p.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                    p.id === selectedPipelineId
                      ? dk
                        ? "bg-indigo-600/20 text-indigo-400"
                        : "bg-indigo-50 text-indigo-700"
                      : dk
                      ? "text-slate-300 hover:bg-slate-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {/* Stage color dots preview */}
                  <div className="flex -space-x-0.5">
                    {p.stages.slice(0, 4).map((s, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full ring-1"
                        style={{ backgroundColor: s.color, ringColor: dk ? "#1e293b" : "#fff" }}
                      />
                    ))}
                  </div>
                  <span className="truncate">{p.name}</span>
                  {p.id === "custom" && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${dk ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                      Custom
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="relative w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                animationDuration={800}
                animationBegin={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-xl font-bold ${dk ? "text-white" : "text-slate-900"}`}>
              {total}
            </span>
            <span className={`text-[9px] uppercase tracking-wider ${dk ? "text-slate-400" : "text-slate-500"}`}>
              Contacts
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className={`text-[11px] truncate ${dk ? "text-slate-300" : "text-slate-600"}`}>
                {d.name}
              </span>
              <span className={`text-[11px] font-semibold ml-auto tabular-nums ${dk ? "text-slate-400" : "text-slate-500"}`}>
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
