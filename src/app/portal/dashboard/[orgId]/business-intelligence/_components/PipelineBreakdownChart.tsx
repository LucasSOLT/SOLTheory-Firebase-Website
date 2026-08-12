"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CRMContact, BIPipelineConfig } from "../_hooks/useBIData";

/* ── Default stages (fallback if no pipeline config saved) ── */

const DEFAULT_STAGES = [
  { id: "cold_lead", name: "Cold Lead", color: "#3B82F6" },
  { id: "warm_lead", name: "Warm Lead", color: "#F97316" },
  { id: "interested", name: "Interested", color: "#8B5CF6" },
  { id: "sale_completed", name: "Sale Completed", color: "#10B981" },
];

const UNTAGGED_COLOR = "#94A3B8";

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
  const data = useMemo(() => {
    // Use configured pipeline stages or fall back to defaults
    const stages = (pipelineConfig?.stages || DEFAULT_STAGES)
      .filter((s) => s.id !== "un_tagged"); // Exclude the permanent un-tagged stage — we handle it separately

    // Build a set of all valid stage names/ids for matching
    const stageNameSet = new Set(stages.flatMap((s) => [s.name, s.id]));
    const stageColorMap = new Map<string, string>();
    for (const s of stages) {
      stageColorMap.set(s.name, s.color);
      stageColorMap.set(s.id, s.color);
    }

    // Count contacts per stage + un-tagged
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

    // Build chart data in pipeline order
    const result: { name: string; value: number; color: string }[] = [];

    // Un-Tagged first
    if (untaggedCount > 0) {
      result.push({ name: "Un-Tagged", value: untaggedCount, color: UNTAGGED_COLOR });
    }

    // Then each stage in order
    for (const stage of stages) {
      const count = counts.get(stage.name) || counts.get(stage.id) || 0;
      if (count > 0) {
        result.push({ name: stage.name, value: count, color: stage.color });
      }
    }

    return result;
  }, [contacts, pipelineConfig]);

  const total = contacts.length;
  const pipelineName = pipelineConfig?.name || "Sales Pipeline";

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
      {/* Pipeline name badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
            dk ? "bg-slate-700/60 text-slate-400" : "bg-slate-100 text-slate-500"
          }`}
        >
          {pipelineName}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="relative w-[160px] h-[160px] sm:w-[180px] sm:h-[180px] shrink-0">
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
            <span className={`text-2xl font-bold ${dk ? "text-white" : "text-slate-900"}`}>
              {total}
            </span>
            <span className={`text-[10px] uppercase tracking-wider ${dk ? "text-slate-400" : "text-slate-500"}`}>
              Contacts
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className={`text-xs truncate ${dk ? "text-slate-300" : "text-slate-600"}`}>
                {d.name}
              </span>
              <span className={`text-xs font-semibold ml-auto ${dk ? "text-slate-400" : "text-slate-500"}`}>
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
