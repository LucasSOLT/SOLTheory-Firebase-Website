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
  ReferenceLine,
} from "recharts";
import type { CRMContact } from "../_hooks/useBIData";

/* ── Helpers ───────────────────────────────────────────── */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

/** Simple linear regression: returns { slope, intercept } */
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/* ── Component ─────────────────────────────────────────── */

export default function RevenueForecastChart({
  contacts,
  dk,
}: {
  contacts: CRMContact[];
  dk: boolean;
}) {
  const chartData = useMemo(() => {
    // Collect all transactions across all contacts, grouped by month
    const monthMap = new Map<string, number>();

    for (const c of contacts) {
      if (!c.transactions) continue;
      for (const tx of c.transactions) {
        if (!tx.date || !tx.amount) continue;
        const d = new Date(tx.date);
        if (isNaN(d.getTime())) continue;
        const key = monthKey(d);
        monthMap.set(key, (monthMap.get(key) || 0) + tx.amount);
      }
    }

    // If no transactions, fall back to createdAt + totalRevenue as a single data point
    if (monthMap.size === 0) {
      for (const c of contacts) {
        if (!c.totalRevenue) continue;
        const created = c.createdAt?.toDate?.() ?? (c.createdAt ? new Date(c.createdAt) : new Date());
        const key = monthKey(created);
        monthMap.set(key, (monthMap.get(key) || 0) + c.totalRevenue);
      }
    }

    if (monthMap.size === 0) return [];

    // Sort by month key
    const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    // Build cumulative or per-month data
    const dataPoints = sorted.map(([key, amount]) => ({
      month: monthLabel(key),
      rawKey: key,
      revenue: Math.round(amount),
    }));

    // Add 3-month forecast via linear regression
    const regressionPoints = dataPoints.map((d, i) => ({ x: i, y: d.revenue }));
    const { slope, intercept } = linearRegression(regressionPoints);
    const lastIdx = dataPoints.length - 1;

    // Parse last month to generate future months
    const lastKey = sorted[sorted.length - 1][0];
    const [lastY, lastM] = lastKey.split("-").map(Number);
    const forecast: typeof dataPoints = [];

    for (let i = 1; i <= 3; i++) {
      const futureMonth = lastM + i;
      const fy = lastY + Math.floor((futureMonth - 1) / 12);
      const fm = ((futureMonth - 1) % 12) + 1;
      const key = `${fy}-${String(fm).padStart(2, "0")}`;
      const predicted = Math.max(0, Math.round(slope * (lastIdx + i) + intercept));
      forecast.push({
        month: monthLabel(key),
        rawKey: key,
        revenue: 0,
        forecast: predicted,
      } as any);
    }

    // Merge: actual data gets forecast = null, forecast data gets revenue = 0
    return [
      ...dataPoints.map((d) => ({ ...d, forecast: null as number | null })),
      // Bridge point: last actual value also starts the forecast line
      ...forecast.map((f, i) =>
        i === 0
          ? { ...f, forecast: (f as any).forecast, bridgeRevenue: dataPoints[lastIdx]?.revenue }
          : f
      ),
    ];
  }, [contacts]);

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className={`px-3 py-2 rounded-lg shadow-lg border text-xs ${
          dk ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey === "forecast" ? "Forecast" : "Revenue"}: ${p.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#22c55e" }}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="forecast"
          stroke="#8b5cf6"
          strokeWidth={2}
          strokeDasharray="6 3"
          fill="url(#forecastGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#8b5cf6" }}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
