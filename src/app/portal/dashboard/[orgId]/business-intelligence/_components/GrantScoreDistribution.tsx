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

/* ── Bucket config ─────────────────────────────────────── */

const BUCKETS = [
  { label: "0–20",  min: 0,  max: 20,  color: "#ef4444" },
  { label: "21–40", min: 21, max: 40,  color: "#f97316" },
  { label: "41–60", min: 41, max: 60,  color: "#f59e0b" },
  { label: "61–80", min: 61, max: 80,  color: "#3b82f6" },
  { label: "81–100",min: 81, max: 100, color: "#22c55e" },
];

/* ── Component ─────────────────────────────────────────── */

export default function GrantScoreDistribution({
  grants,
  dk,
}: {
  grants: GrantSuggestion[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    return BUCKETS.map((bucket) => {
      const count = grants.filter((g) => {
        const score = g.matchScore ?? 0;
        return score >= bucket.min && score <= bucket.max;
      }).length;
      return { name: bucket.label, count, color: bucket.color };
    });
  }, [grants]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        className={`px-3 py-2 shadow-2xl rounded-xl border text-xs pointer-events-none select-none ${
          dk ? "bg-slate-900/90 backdrop-blur-md border-slate-700/80 text-white" : "bg-white/90 backdrop-blur-md border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold mb-0.5">Score {d.name}</p>
        <p className="tabular-nums">
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
          stroke={dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          label={{
            value: "Match Score",
            position: "insideBottom",
            offset: -2,
            style: { fontSize: 9, fill: dk ? "#64748b" : "#94a3b8", fontWeight: 600 },
          }}
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
          radius={[6, 6, 0, 0]}
          barSize={28}
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
