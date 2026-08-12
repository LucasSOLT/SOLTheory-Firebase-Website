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
import type { CRMContact } from "../_hooks/useBIData";

/* ── Component ─────────────────────────────────────────── */

export default function RevenueByContactChart({
  contacts,
  dk,
}: {
  contacts: CRMContact[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    return contacts
      .filter((c) => (c.totalRevenue || 0) > 0)
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 10)
      .map((c) => ({
        name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unknown",
        revenue: c.totalRevenue || 0,
      }));
  }, [contacts]);

  if (data.length === 0) return null;

  // Gradient colors for bars (top -> bottom ranked)
  const barColors = [
    "#22c55e", "#34d399", "#4ade80", "#6ee7b7", "#86efac",
    "#a7f3d0", "#bbf7d0", "#d1fae5", "#dcfce7", "#ecfdf5",
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className={`px-3 py-2 rounded-lg shadow-lg border text-xs ${
          dk ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold">{label}</p>
        <p className="text-green-500">${payload[0].value.toLocaleString()}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32 + 20)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11, fill: dk ? "#cbd5e1" : "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="revenue"
          radius={[0, 6, 6, 0]}
          animationDuration={800}
          animationBegin={100}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={barColors[Math.min(i, barColors.length - 1)]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
