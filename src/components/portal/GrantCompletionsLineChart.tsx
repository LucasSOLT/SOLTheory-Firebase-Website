"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from '@/lib/useDarkMode';
import type { GrantRecord } from "@/hooks/useGrantsData";

/**
 * Generates the last 7 day labels for the X-axis.
 */
function getLast7Days(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ key, label });
  }
  return days;
}

interface Props {
  grants: GrantRecord[];
  loading: boolean;
}

export function GrantCompletionsLineChart({ grants = [], loading }: Props) {
  const { t } = useTranslation();
  const isDarkMode = useDarkMode();
  const chartData = useMemo(() => {
    const days = getLast7Days();

    // Bucket grants that are applied, approved, or denied by their relevant timestamp
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d.key] = 0));

    (grants || []).forEach((g) => {
      if (g.status !== "applied" && g.status !== "approved" && g.status !== "denied") return;

      // Pick the most relevant timestamp for when this grant was actioned
      const tsRaw = g.completedAt || g.appliedAt || g.deniedAt || g.dateSuggested;
      if (!tsRaw) return;

      try {
        const d = new Date(tsRaw);
        if (isNaN(d.getTime())) return;
        const key = d.toISOString().slice(0, 10);
        if (counts[key] !== undefined) counts[key]++;
      } catch {
        // skip malformed timestamps
      }
    });

    // Running cumulative total over the 7-day window
    let cumulative = 0;
    return days.map((d) => {
      cumulative += counts[d.key];
      return { name: d.label, count: cumulative };
    });
  }, [grants]);

  const totalActioned = grants.filter(
    (g) => g.status === "applied" || g.status === "approved" || g.status === "denied"
  ).length;

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>
          {t.grantsCompleted7d}
        </span>
        <span className={`text-[8px] font-semibold tabular-nums ${isDarkMode ? 'text-slate-400' : 'text-slate-300'}`}>
          {totalActioned} {t.total}
        </span>
      </div>
      <div className={`flex-1 min-h-0 w-full relative rounded-lg ${isDarkMode ? 'bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]' : ''}`} style={isDarkMode ? { opacity: 1 } : {}}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="completionsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeOpacity={0.6} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 8, fill: isDarkMode ? '#cbd5e1' : '#94a3b8', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 8, fill: isDarkMode ? '#cbd5e1' : '#94a3b8', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
              minTickGap={1}
            />
            <Tooltip
              cursor={{ stroke: isDarkMode ? '#6366f1' : '#818cf8', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className={`px-3 py-2 rounded-xl shadow-2xl border backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white/90 border-slate-200 text-slate-800'}`}>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span className="text-xs font-bold tabular-nums">{payload[0].value}</span>
                      <span className={`text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.completedLabel}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="count" stroke="none" fill="url(#completionsGrad)" />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#818cf8"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#818cf8', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#6366f1', stroke: isDarkMode ? '#0f172a' : '#fff', strokeWidth: 2.5 }}
              name={t.completedLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
