"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

// Canonical month order for proper sorting
const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthlyUsersChartProps {
  data: { month: string; users: number }[];
  accentColor?: "emerald" | "indigo" | "violet";
}

// Custom tooltip with backdrop blur and premium styling
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: "14px",
        padding: "14px 18px",
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.08)",
      }}
    >
      <p style={{ color: "#94a3b8", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
        {label}
      </p>
      <p style={{ color: "#ffffff", fontSize: "22px", fontWeight: 800, lineHeight: 1.2 }}>
        {value.toLocaleString()}
        <span style={{ color: "#64748b", fontSize: "12px", fontWeight: 500, marginLeft: "4px" }}>users</span>
      </p>
    </div>
  );
}

// Custom bar shape with rounded top corners that scales properly
function RoundedBar(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const radius = Math.min(8, width / 2, height / 2);
  return (
    <path
      d={`
        M${x},${y + height}
        L${x},${y + radius}
        Q${x},${y} ${x + radius},${y}
        L${x + width - radius},${y}
        Q${x + width},${y} ${x + width},${y + radius}
        L${x + width},${y + height}
        Z
      `}
      fill={fill}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))", transition: "all 0.3s ease" }}
    />
  );
}

export default function MonthlyUsersChart({ data, accentColor = "emerald" }: MonthlyUsersChartProps) {
  // Sort data by chronological month order
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => {
      return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
    });
  }, [data]);

  // Compute statistics
  const stats = useMemo(() => {
    if (sortedData.length === 0) return { total: 0, avg: 0, peak: 0, peakMonth: "", trend: 0 };
    const total = sortedData.reduce((s, d) => s + d.users, 0);
    const avg = Math.round(total / sortedData.length);
    const peak = Math.max(...sortedData.map(d => d.users));
    const peakMonth = sortedData.find(d => d.users === peak)?.month || "";
    // Trend: compare last month to second-to-last
    let trend = 0;
    if (sortedData.length >= 2) {
      const last = sortedData[sortedData.length - 1].users;
      const prev = sortedData[sortedData.length - 2].users;
      trend = prev === 0 ? (last > 0 ? 100 : 0) : Math.round(((last - prev) / prev) * 100);
    }
    return { total, avg, peak, peakMonth, trend };
  }, [sortedData]);

  // Color palettes
  const palettes = {
    emerald: {
      gradient: ["#34d399", "#10b981", "#059669"],
      bar: "#10b981",
      barHover: "#34d399",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
      gradientId: "monthlyBarGradientEmerald",
      light: "#d1fae5",
    },
    indigo: {
      gradient: ["#818cf8", "#6366f1", "#4f46e5"],
      bar: "#6366f1",
      barHover: "#818cf8",
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
      gradientId: "monthlyBarGradientIndigo",
      light: "#e0e7ff",
    },
    violet: {
      gradient: ["#a78bfa", "#8b5cf6", "#7c3aed"],
      bar: "#8b5cf6",
      barHover: "#a78bfa",
      bg: "bg-violet-50",
      text: "text-violet-600",
      badge: "bg-violet-50 text-violet-700 border-violet-100",
      gradientId: "monthlyBarGradientViolet",
      light: "#ede9fe",
    },
  };

  const palette = palettes[accentColor];

  const TrendIcon = stats.trend > 0 ? TrendingUp : stats.trend < 0 ? TrendingDown : Minus;
  const trendColor = stats.trend > 0 ? "text-emerald-500" : stats.trend < 0 ? "text-red-500" : "text-slate-400";

  const isEmpty = sortedData.length === 0;

  return (
    <Card className="w-full bg-white border-0 shadow-sm ring-1 ring-slate-100 flex flex-col min-h-[400px] rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-slate-50 pb-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-slate-900 text-lg font-extrabold flex items-center gap-3">
              <div className={`p-2 ${palette.bg} rounded-xl`}>
                <Users className={`w-5 h-5 ${palette.text}`} />
              </div>
              Monthly Unique Users
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium mt-1.5 ml-[44px]">
              Aggregated platform registrations by month
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${palette.badge}`}>
                <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
                <span className={trendColor}>
                  {stats.trend > 0 ? "+" : ""}{stats.trend}%
                </span>
              </div>
            )}
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-500 tracking-wide">
              LTM
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Stats strip */}
      {!isEmpty && (
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-50">
          <div className="px-6 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
            <p className="text-lg font-black text-slate-900">{stats.total.toLocaleString()}</p>
          </div>
          <div className="px-6 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Avg</p>
            <p className="text-lg font-black text-slate-900">{stats.avg.toLocaleString()}</p>
          </div>
          <div className="px-6 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak</p>
            <p className="text-lg font-black text-slate-900">{stats.peak.toLocaleString()} <span className="text-xs font-semibold text-slate-400">({stats.peakMonth})</span></p>
          </div>
        </div>
      )}

      <CardContent className="flex-grow pt-6 p-6">
        {isEmpty ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-300">
            <Users className="w-12 h-12" />
            <p className="text-sm font-semibold text-slate-400">No user registration data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barSize={sortedData.length <= 6 ? 48 : 32}>
              <defs>
                <linearGradient id={palette.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.gradient[0]} stopOpacity={1} />
                  <stop offset="50%" stopColor={palette.gradient[1]} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={palette.gradient[2]} stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#94a3b8"
                fontSize={12}
                fontWeight={600}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                dx={-4}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: palette.light, opacity: 0.5, radius: 8 }}
              />
              {stats.avg > 0 && (
                <ReferenceLine
                  y={stats.avg}
                  stroke="#cbd5e1"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Avg: ${stats.avg}`,
                    position: "insideTopRight",
                    fill: "#94a3b8",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              )}
              <Bar
                dataKey="users"
                fill={`url(#${palette.gradientId})`}
                shape={<RoundedBar />}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#${palette.gradientId})`}
                    opacity={entry.users === stats.peak ? 1 : 0.82}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
