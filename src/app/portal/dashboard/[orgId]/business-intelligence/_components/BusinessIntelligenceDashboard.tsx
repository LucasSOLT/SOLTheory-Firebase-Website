"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Camera,
  DollarSign,
  Target,
  Users,
  Award,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useBIData, DateRange } from "../_hooks/useBIData";
import RevenueForecastChart from "./RevenueForecastChart";
import PipelineBreakdownChart from "./PipelineBreakdownChart";
import RevenueByContactChart from "./RevenueByContactChart";
import GrantPipelineChart from "./GrantPipelineChart";
import GrantWinRateCard from "./GrantWinRateCard";
import GrantScoreDistribution from "./GrantScoreDistribution";
import TeamProductivityChart from "./TeamProductivityChart";
import ServiceBreakdownChart from "./ServiceBreakdownChart";
import BillableRevenueChart from "./BillableRevenueChart";
import InstagramOverviewCard from "./InstagramOverviewCard";
import PostActivityChart from "./PostActivityChart";

/* ── KPI Card ──────────────────────────────────────────── */

function KPICard({
  icon: Icon,
  label,
  value,
  subtext,
  accentColor,
  dk,
}: {
  icon: any;
  label: string;
  value: string;
  subtext?: string;
  accentColor: string;
  dk: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 transition-all hover:scale-[1.02] ${
        dk
          ? "bg-slate-800/60 border-slate-700/60 hover:border-slate-600"
          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
      }`}
    >
      {/* Accent glow */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 blur-2xl"
        style={{ background: accentColor }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${dk ? "text-slate-400" : "text-slate-500"}`}>
            {label}
          </p>
          <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${dk ? "text-white" : "text-slate-900"}`}>
            {value}
          </p>
          {subtext && (
            <p className={`text-xs mt-1 ${dk ? "text-slate-500" : "text-slate-400"}`}>{subtext}</p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  );
}

/* ── Section Card (placeholder for chart containers) ──── */

function SectionCard({
  title,
  icon: Icon,
  children,
  dk,
  emptyMessage,
  isEmpty,
}: {
  title: string;
  icon: any;
  children?: React.ReactNode;
  dk: boolean;
  emptyMessage?: string;
  isEmpty?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 transition-all ${
        dk
          ? "bg-slate-800/40 border-slate-700/50"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-4 h-4 ${dk ? "text-slate-400" : "text-slate-500"}`} />
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${dk ? "text-slate-300" : "text-slate-700"}`}>
          {title}
        </h3>
      </div>
      {isEmpty ? (
        <div className={`flex flex-col items-center justify-center py-12 gap-2 ${dk ? "text-slate-500" : "text-slate-400"}`}>
          <AlertCircle className="w-8 h-8 opacity-40" />
          <p className="text-sm">{emptyMessage || "No data yet"}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/* ── Loading Skeleton ─────────────────────────────────── */

function SkeletonCard({ dk }: { dk: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 animate-pulse ${
        dk ? "bg-slate-800/40 border-slate-700/50" : "bg-white border-slate-200"
      }`}
    >
      <div className={`h-4 w-32 rounded mb-4 ${dk ? "bg-slate-700" : "bg-slate-200"}`} />
      <div className={`h-48 rounded-lg ${dk ? "bg-slate-700/50" : "bg-slate-100"}`} />
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────── */

export default function BusinessIntelligenceDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const { isDarkMode } = useTheme();
  const dk = isDarkMode;
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const { crmContacts, allCrmContacts, grants, timesheetEntries, instagramPosts, pipelineConfig, isLoading } = useBIData(
    orgId,
    dateRange
  );

  /* ── KPI Aggregations ─────────────────────────────── */

  const totalRevenue = useMemo(
    () => crmContacts.reduce((sum, c) => sum + (c.totalRevenue || 0), 0),
    [crmContacts]
  );

  const grantWinRate = useMemo(() => {
    const submitted = grants.filter(
      (g) => g.status === "submitted" || g.status === "awarded" || g.status === "denied"
    ).length;
    const awarded = grants.filter((g) => g.status === "awarded").length;
    if (submitted === 0) return null;
    return Math.round((awarded / submitted) * 100);
  }, [grants]);

  const totalHoursLogged = useMemo(
    () => Math.round(timesheetEntries.reduce((sum, t) => sum + (t.durationMinutes || 0), 0) / 60),
    [timesheetEntries]
  );

  const publishedPosts = useMemo(
    () => instagramPosts.filter((p) => p.status === "published").length,
    [instagramPosts]
  );

  /* ── Date Range Buttons ────────────────────────────── */

  const ranges: { label: string; value: DateRange }[] = [
    { label: "7D", value: "7d" },
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
    { label: "All", value: "all" },
  ];

  return (
    <div className={`min-h-screen p-4 sm:p-6 lg:p-8 ${dk ? "text-white" : "text-slate-900"}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${dk ? "text-white" : "text-slate-900"}`}>
            Business Intelligence
          </h1>
          <p className={`text-sm mt-1 ${dk ? "text-slate-400" : "text-slate-500"}`}>
            Real-time insights across your entire organization
          </p>
        </div>

        {/* Date Range Selector */}
        <div
          className={`flex gap-1 p-1 rounded-xl border w-fit ${
            dk ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"
          }`}
        >
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                dateRange === r.value
                  ? dk
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : dk
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-5 animate-pulse ${
                  dk ? "bg-slate-800/60 border-slate-700/60" : "bg-white border-slate-200"
                }`}
              >
                <div className={`h-3 w-20 rounded mb-3 ${dk ? "bg-slate-700" : "bg-slate-200"}`} />
                <div className={`h-8 w-28 rounded ${dk ? "bg-slate-700" : "bg-slate-200"}`} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} dk={dk} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              icon={DollarSign}
              label="Total Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              subtext={`${crmContacts.length} contacts`}
              accentColor="#22c55e"
              dk={dk}
            />
            <KPICard
              icon={Target}
              label="Grant Win Rate"
              value={grantWinRate !== null ? `${grantWinRate}%` : "N/A"}
              subtext={`${grants.filter((g) => g.status === "awarded").length} awarded`}
              accentColor="#8b5cf6"
              dk={dk}
            />
            <KPICard
              icon={Clock}
              label="Hours Logged"
              value={totalHoursLogged.toLocaleString()}
              subtext={`${timesheetEntries.length} entries`}
              accentColor="#3b82f6"
              dk={dk}
            />
            <KPICard
              icon={Camera}
              label="Posts Published"
              value={String(publishedPosts)}
              subtext={`${instagramPosts.length} total posts`}
              accentColor="#f59e0b"
              dk={dk}
            />
          </div>

          {/* Chart Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* CRM Charts */}
            <SectionCard
              title="Revenue Forecast"
              icon={TrendingUp}
              dk={dk}
              isEmpty={crmContacts.length === 0}
              emptyMessage="No CRM contacts yet — add contacts to see revenue trends"
            >
              <RevenueForecastChart contacts={crmContacts} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Pipeline Breakdown"
              icon={Users}
              dk={dk}
              isEmpty={allCrmContacts.length === 0}
              emptyMessage="No CRM contacts yet — add contacts to see pipeline data"
            >
              <PipelineBreakdownChart contacts={allCrmContacts} pipelineConfig={pipelineConfig} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Top Revenue Contacts"
              icon={DollarSign}
              dk={dk}
              isEmpty={crmContacts.length === 0}
              emptyMessage="No CRM contacts yet"
            >
              <RevenueByContactChart contacts={crmContacts} dk={dk} />
            </SectionCard>

            {/* Grant Charts */}
            <SectionCard
              title="Grant Pipeline"
              icon={Award}
              dk={dk}
              isEmpty={grants.length === 0}
              emptyMessage="No grant data yet — run your first grant search!"
            >
              <GrantPipelineChart grants={grants} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Grant Win Rate"
              icon={Target}
              dk={dk}
              isEmpty={grants.length === 0}
              emptyMessage="No grant data yet"
            >
              <GrantWinRateCard grants={grants} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Match Score Distribution"
              icon={BarChart3}
              dk={dk}
              isEmpty={grants.length === 0}
              emptyMessage="No grant data yet"
            >
              <GrantScoreDistribution grants={grants} dk={dk} />
            </SectionCard>

            {/* Timesheet Charts */}
            <SectionCard
              title="Team Productivity"
              icon={Users}
              dk={dk}
              isEmpty={timesheetEntries.length === 0}
              emptyMessage="No timesheet entries yet — log hours to see productivity data"
            >
              <TeamProductivityChart entries={timesheetEntries} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Service Breakdown"
              icon={PieChartIcon}
              dk={dk}
              isEmpty={timesheetEntries.length === 0}
              emptyMessage="No timesheet entries yet — log hours to see service breakdown"
            >
              <ServiceBreakdownChart entries={timesheetEntries} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Billable Revenue"
              icon={DollarSign}
              dk={dk}
              isEmpty={timesheetEntries.length === 0}
              emptyMessage="No timesheet entries yet — log hours to see revenue data"
            >
              <BillableRevenueChart entries={timesheetEntries} dk={dk} />
            </SectionCard>

            {/* Instagram Charts */}
            <SectionCard
              title="Instagram Overview"
              icon={Camera}
              dk={dk}
              isEmpty={instagramPosts.length === 0}
              emptyMessage="No Instagram posts yet — connect your account to get started"
            >
              <InstagramOverviewCard posts={instagramPosts} dk={dk} />
            </SectionCard>

            <SectionCard
              title="Post Activity"
              icon={TrendingUp}
              dk={dk}
              isEmpty={instagramPosts.length === 0}
              emptyMessage="No Instagram posts yet"
            >
              <PostActivityChart posts={instagramPosts} dk={dk} />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
