"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CRMContact } from "../_hooks/useBIData";

/* ── Constants ─────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  "Cold Lead":       { color: "#94a3b8", label: "Cold Lead" },
  "Warm Lead":       { color: "#f59e0b", label: "Warm Lead" },
  "Interested":      { color: "#3b82f6", label: "Interested" },
  "Sale Completed":  { color: "#22c55e", label: "Sale Completed" },
};

const FALLBACK_COLOR = "#6366f1";

/* ── Component ─────────────────────────────────────────── */

export default function PipelineBreakdownChart({
  contacts,
  dk,
}: {
  contacts: CRMContact[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contacts) {
      const status = c.leadStatus || "Unknown";
      counts.set(status, (counts.get(status) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_CONFIG[name]?.color ?? FALLBACK_COLOR,
      }))
      .sort((a, b) => b.value - a.value);
  }, [contacts]);

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
              {STATUS_CONFIG[d.name]?.label ?? d.name}
            </span>
            <span className={`text-xs font-semibold ml-auto ${dk ? "text-slate-400" : "text-slate-500"}`}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
