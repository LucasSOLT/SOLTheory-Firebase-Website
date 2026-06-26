"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
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
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} vertical={false} />
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
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "none",
                borderRadius: "8px",
                fontSize: "10px",
                color: "#f8fafc",
                padding: "6px 10px",
              }}
              itemStyle={{ color: "#818cf8" }}
              labelStyle={{ color: "#94a3b8", fontWeight: 700, fontSize: "9px" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#818cf8"
              strokeWidth={2}
              dot={{ r: 3, fill: '#818cf8', stroke: isDarkMode ? '#1e293b' : '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 4, fill: '#6366f1', stroke: isDarkMode ? '#1e293b' : '#fff', strokeWidth: 2 }}
              name={t.completedLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
