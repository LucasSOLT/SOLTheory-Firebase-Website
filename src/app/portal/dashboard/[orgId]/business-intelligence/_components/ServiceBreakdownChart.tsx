"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TimesheetEntry } from "../_hooks/useBIData";

const SERVICE_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b",
  "#ec4899", "#06b6d4", "#f97316", "#64748b",
];

export default function ServiceBreakdownChart({
  entries,
  dk,
}: {
  entries: TimesheetEntry[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    const serviceMap = new Map<string, number>();

    for (const e of entries) {
      const service = e.serviceName?.trim() || "General / Other";
      const hrs = (e.durationMinutes || 0) / 60;
      serviceMap.set(service, (serviceMap.get(service) || 0) + hrs);
    }

    return Array.from(serviceMap.entries())
      .map(([name, hours], i) => ({
        name,
        value: Number(hours.toFixed(1)),
        color: SERVICE_COLORS[i % SERVICE_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  const totalHours = useMemo(
    () => Number(data.reduce((sum, d) => sum + d.value, 0).toFixed(1)),
    [data]
  );

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = totalHours > 0 ? ((d.value / totalHours) * 100).toFixed(1) : "0";
    return (
      <div
        className={`px-3 py-2 shadow-2xl rounded-xl border text-xs pointer-events-none select-none ${
          dk ? "bg-slate-900/90 backdrop-blur-md border-slate-700/80 text-white" : "bg-white/90 backdrop-blur-md border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold">{d.name}</p>
        <p>
          {d.value} hrs ({pct}%)
        </p>
      </div>
    );
  };

  return (
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
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={{ pointerEvents: "none", zIndex: 100 }}
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-xl font-bold ${dk ? "text-white" : "text-slate-900"}`}>
            {totalHours}h
          </span>
          <span className={`text-[9px] uppercase tracking-wider ${dk ? "text-slate-400" : "text-slate-500"}`}>
            Logged
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
              {d.value}h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
