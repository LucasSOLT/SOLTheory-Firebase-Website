"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimesheetEntry } from "../_hooks/useBIData";

export default function BillableRevenueChart({
  entries,
  dk,
}: {
  entries: TimesheetEntry[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    const revenueByDate = new Map<string, number>();

    // Sort entries chronologically
    const sorted = [...entries].sort((a, b) => {
      const da = new Date(a.startDate).getTime() || 0;
      const db = new Date(b.startDate).getTime() || 0;
      return da - db;
    });

    for (const e of sorted) {
      if (!e.startDate) continue;
      const dateStr = new Date(e.startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const hrs = (e.durationMinutes || 0) / 60;
      const rate = e.billableRate || 0;
      const rev = hrs * rate;

      revenueByDate.set(dateStr, (revenueByDate.get(dateStr) || 0) + rev);
    }

    return Array.from(revenueByDate.entries()).map(([date, revenue]) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
    }));
  }, [entries]);

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className={`px-3 py-2 shadow-2xl rounded-xl border text-xs pointer-events-none select-none ${
          dk ? "bg-slate-900/90 backdrop-blur-md border-slate-700/80 text-white" : "bg-white/90 backdrop-blur-md border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold mb-0.5">{label}</p>
        <p className="text-emerald-500 font-semibold">
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="billableRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          domain={[0, Math.ceil(maxRevenue * 1.15)]}
        />
        <Tooltip
          content={<CustomTooltip />}
          wrapperStyle={{ pointerEvents: "none", zIndex: 100 }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#billableRevGrad)"
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
