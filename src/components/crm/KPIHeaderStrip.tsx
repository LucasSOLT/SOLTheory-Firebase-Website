"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { Customer, CrmTask, Meeting } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import { Users, DollarSign, TrendingUp, Target, CheckSquare, Calendar } from "lucide-react";

interface KPIHeaderStripProps {
  customers: Customer[];
  tasks: CrmTask[];
  meetings: Meeting[];
}

/* ── Animated Counter ── */
function AnimatedValue({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <span>{prefix}{formatted}{suffix}</span>;
}

/* ── Single Metric Card ── */
function MetricItem({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  icon: Icon,
  trend,
  isDarkMode,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  isDarkMode: boolean;
}) {
  return (
    <div className={`flex-1 min-w-[140px] px-4 py-3 flex flex-col gap-1.5 group cursor-default transition-colors ${
      isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-white/60'
    }`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{label}</span>
        <Icon className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'} group-hover:text-indigo-400 transition-colors`} />
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          <AnimatedValue value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </span>
        {trend && (
          <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5 mb-0.5">
            <TrendingUp className="w-2.5 h-2.5" />
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

export default function KPIHeaderStrip({ customers, tasks, meetings }: KPIHeaderStripProps) {
  const { isDarkMode } = useTheme();

  const metrics = useMemo(() => {
    const total = customers.length;
    const completed = customers.filter(c => c.leadStatus === "Sale Completed");
    const nonCompleted = customers.filter(c => c.leadStatus !== "Sale Completed");
    const pipelineValue = nonCompleted.reduce((acc, c) => acc + (c.totalRevenue || 0), 0);
    const conversionRate = total > 0 ? (completed.length / total) * 100 : 0;
    const totalCompletedRevenue = completed.reduce((acc, c) => acc + (c.totalRevenue || 0), 0);
    const avgDeal = completed.length > 0 ? totalCompletedRevenue / completed.length : 0;

    // Tasks due today
    const today = new Date().toISOString().split("T")[0];
    const tasksDueToday = tasks.filter(t => !t.completed && t.dueDate?.startsWith(today)).length;

    // Meetings this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const meetingsThisWeek = meetings.filter(m => {
      const d = new Date(m.date);
      return d >= startOfWeek && d < endOfWeek;
    }).length;

    // Trends (contacts added this month)
    const thisMonth = new Date().toISOString().slice(0, 7);
    const newThisMonth = customers.filter(c => {
      const created = c.createdAt?.toDate?.() || c.createdAt;
      if (!created) return false;
      return new Date(created).toISOString().slice(0, 7) === thisMonth;
    }).length;

    return { total, pipelineValue, conversionRate, avgDeal, tasksDueToday, meetingsThisWeek, newThisMonth };
  }, [customers, tasks, meetings]);

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDarkMode ? 'bg-slate-900/80 border-slate-700/60' : 'bg-[#faf8f3] border-[#ede8da]/80'
    }`}>
      <div className={`flex flex-wrap divide-x ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-200/60'}`}>
        <MetricItem
          label="Total Contacts"
          value={metrics.total}
          icon={Users}
          trend={metrics.newThisMonth > 0 ? `+${metrics.newThisMonth} this month` : undefined}
          isDarkMode={isDarkMode}
        />
        <MetricItem
          label="Pipeline Value"
          value={metrics.pipelineValue}
          prefix="$"
          icon={DollarSign}
          isDarkMode={isDarkMode}
        />
        <MetricItem
          label="Conversion Rate"
          value={metrics.conversionRate}
          suffix="%"
          decimals={1}
          icon={Target}
          isDarkMode={isDarkMode}
        />
        <MetricItem
          label="Avg. Deal Size"
          value={metrics.avgDeal}
          prefix="$"
          icon={DollarSign}
          isDarkMode={isDarkMode}
        />
        <MetricItem
          label="Tasks Due Today"
          value={metrics.tasksDueToday}
          icon={CheckSquare}
          isDarkMode={isDarkMode}
        />
        <MetricItem
          label="Meetings This Week"
          value={metrics.meetingsThisWeek}
          icon={Calendar}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
}
