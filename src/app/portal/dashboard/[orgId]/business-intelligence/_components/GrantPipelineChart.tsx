"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { GrantSuggestion } from "../_hooks/useBIData";

/* ── Stage Definitions & Color Palette ─────────────────── */

const STAGE_CONFIG: { id: string; name: string; color: string }[] = [
  { id: "unreviewed", name: "Unreviewed", color: "#94a3b8" },
  { id: "bookmarked", name: "Bookmarked", color: "#3b82f6" },
  { id: "drafting",   name: "Drafting",   color: "#f59e0b" },
  { id: "submitted",  name: "Submitted",  color: "#8b5cf6" },
  { id: "awarded",    name: "Awarded",    color: "#22c55e" },
  { id: "denied",     name: "Denied",     color: "#ef4444" },
];

/* ── Component ─────────────────────────────────────────── */

export default function GrantPipelineChart({
  grants,
  dk,
}: {
  grants: GrantSuggestion[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of grants) {
      const st = g.status?.toLowerCase() || "unreviewed";
      counts.set(st, (counts.get(st) || 0) + 1);
    }

    return STAGE_CONFIG.map((stage) => ({
      name: stage.name,
      id: stage.id,
      count: counts.get(stage.id) || 0,
      color: stage.color,
    }));
  }, [grants]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        className={`px-3 py-2 rounded-lg shadow-lg border text-xs pointer-events-none select-none ${
          dk ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
          {d.name}
        </p>
        <p className="tabular-nums font-medium">
          {d.count} grant{d.count !== 1 ? "s" : ""}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          domain={[0, Math.ceil(maxCount * 1.15)]}
        />
        <Tooltip
          content={<CustomTooltip />}
          wrapperStyle={{ pointerEvents: "none", zIndex: 100 }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          barSize={24}
          animationDuration={800}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
