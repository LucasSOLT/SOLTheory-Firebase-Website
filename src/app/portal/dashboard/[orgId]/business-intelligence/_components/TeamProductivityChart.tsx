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
import type { TimesheetEntry } from "../_hooks/useBIData";

const TEAM_COLORS = [
  "#6366f1", "#3b82f6", "#8b5cf6", "#ec4899",
  "#06b6d4", "#10b981", "#f59e0b", "#f97316",
];

export default function TeamProductivityChart({
  entries,
  dk,
}: {
  entries: TimesheetEntry[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    const hoursMap = new Map<string, number>();

    for (const e of entries) {
      const name = e.userName?.trim() || e.userEmail?.split("@")[0] || "Unknown Member";
      const hrs = (e.durationMinutes || 0) / 60;
      hoursMap.set(name, (hoursMap.get(name) || 0) + hrs);
    }

    return Array.from(hoursMap.entries())
      .map(([name, hours]) => ({ name, hours: Number(hours.toFixed(1)) }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
  }, [entries]);

  const maxHours = Math.max(...data.map((d) => d.hours), 1);

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        className={`px-3 py-2 shadow-2xl rounded-xl border text-xs pointer-events-none select-none ${
          dk ? "bg-slate-900/90 backdrop-blur-md border-slate-700/80 text-white" : "bg-white/90 backdrop-blur-md border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold mb-0.5">{d.name}</p>
        <p className="text-indigo-500 font-semibold">{d.hours} hrs logged</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        barCategoryGap="20%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}h`}
          domain={[0, Math.ceil(maxHours * 1.15)]}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fontSize: 10, fill: dk ? "#cbd5e1" : "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          wrapperStyle={{ pointerEvents: "none", zIndex: 100 }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="hours"
          radius={[0, 6, 6, 0]}
          barSize={18}
          animationDuration={800}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={TEAM_COLORS[i % TEAM_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
