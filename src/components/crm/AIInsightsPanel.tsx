"use client";

import React, { useMemo } from "react";
import type { Customer, CrmTask, Meeting } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  Clock,
  AlertTriangle,
  DollarSign,
  Zap,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Phone,
  Building2,
  ChevronRight,
} from "lucide-react";

/* ─────────────── TYPES ─────────────── */

interface AIInsightsPanelProps {
  customers: Customer[];
  tasks: CrmTask[];
  meetings: Meeting[];
  onNavigateToContact: (contactId: string) => void;
}

/* ─────────────── HELPERS ─────────────── */

const DAY_MS = 1000 * 60 * 60 * 24;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

/** Try to parse a creation timestamp from the customer ID format CUST-{timestamp}-xxx */
function parseCreatedAt(customer: Customer): Date | null {
  if (customer.createdAt) {
    const d = customer.createdAt?.toDate?.() ?? new Date(customer.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  const match = customer.id.match(/^CUST-(\d+)/);
  if (match) {
    const ts = parseInt(match[1], 10);
    if (!isNaN(ts)) return new Date(ts);
  }
  return null;
}

/** Parse lastContactedDate safely */
function parseLastContacted(customer: Customer): Date | null {
  if (!customer.lastContactedDate) return null;
  const d = new Date(customer.lastContactedDate);
  return isNaN(d.getTime()) ? null : d;
}

/* ─────────────── INSIGHT CARD ─────────────── */

function InsightCard({
  icon: Icon,
  title,
  isDarkMode,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  isDarkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
        isDarkMode
          ? "bg-slate-900/80 border-slate-700/60 hover:shadow-slate-900/40"
          : "bg-white border-[#ede8da]/80 hover:shadow-slate-200/60"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            isDarkMode ? "bg-slate-800" : "bg-slate-100"
          }`}
        >
          <Icon
            className={`w-4 h-4 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          />
        </div>
        <h3
          className={`text-sm font-semibold pt-1 ${
            isDarkMode ? "text-white" : "text-slate-800"
          }`}
        >
          {title}
        </h3>
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function ContactChip({
  name,
  onClick,
  isDarkMode,
}: {
  name: string;
  onClick: () => void;
  isDarkMode: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
        isDarkMode
          ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
      }`}
    >
      {name}
      <ChevronRight className="w-3 h-3 opacity-50" />
    </button>
  );
}

function CTAButton({
  label,
  onClick,
  isDarkMode,
}: {
  label: string;
  onClick: () => void;
  isDarkMode: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors mt-3 ${
        isDarkMode
          ? "bg-white text-slate-900 hover:bg-slate-200"
          : "bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      {label}
      <ArrowRight className="w-3 h-3" />
    </button>
  );
}

/* ─────────────── MAIN COMPONENT ─────────────── */

export default function AIInsightsPanel({
  customers,
  tasks,
  meetings,
  onNavigateToContact,
}: AIInsightsPanelProps) {
  const { isDarkMode } = useTheme();

  const insights = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = daysAgo(30);
    const fourteenDaysAgo = daysAgo(14);
    const sevenDaysAgo = daysAgo(7);

    /* 1 ─ Stale Contacts: not contacted in 30+ days */
    const staleContacts = customers.filter((c) => {
      const last = parseLastContacted(c);
      if (!last) {
        // If never contacted, check creation date — if created 30+ days ago, it's stale
        const created = parseCreatedAt(c);
        return created ? created < thirtyDaysAgo : false;
      }
      return last < thirtyDaysAgo;
    });

    /* 2 ─ At-Risk Deals: Warm Lead or Interested with no activity in 14+ days */
    const atRiskDeals = customers.filter((c) => {
      if (c.leadStatus !== "Warm Lead" && c.leadStatus !== "Interested")
        return false;
      const last = parseLastContacted(c);
      if (!last) return true; // No contact date at all → at risk
      return last < fourteenDaysAgo;
    });

    /* 3 ─ Revenue Summary */
    const nonCompleted = customers.filter(
      (c) => c.leadStatus !== "Sale Completed"
    );
    const completedCustomers = customers.filter(
      (c) => c.leadStatus === "Sale Completed"
    );
    const totalPipeline = nonCompleted.reduce(
      (sum, c) => sum + (c.totalRevenue || 0),
      0
    );
    const totalClosed = completedCustomers.reduce(
      (sum, c) => sum + (c.totalRevenue || 0),
      0
    );

    // Month-over-month: compare contacts created this month vs last month
    const thisMonthStr = now.toISOString().slice(0, 7); // "2026-07"
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);

    let thisMonthRevenue = 0;
    let lastMonthRevenue = 0;
    completedCustomers.forEach((c) => {
      const created = parseCreatedAt(c);
      if (!created) return;
      const monthStr = created.toISOString().slice(0, 7);
      if (monthStr === thisMonthStr) thisMonthRevenue += c.totalRevenue || 0;
      if (monthStr === lastMonthStr) lastMonthRevenue += c.totalRevenue || 0;
    });

    const momChange =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : null;

    /* 4 ─ Quick Wins: Interested + recent activity (last 7 days) */
    const quickWins = customers.filter((c) => {
      if (c.leadStatus !== "Interested") return false;
      const last = parseLastContacted(c);
      return last ? last >= sevenDaysAgo : false;
    });

    /* 5 ─ Missing Data Alerts */
    const missingEmail = customers.filter((c) => !c.email || !c.email.trim());
    const missingPhone = customers.filter((c) => !c.phone || !c.phone.trim());
    const missingCompany = customers.filter(
      (c) => !c.company || !c.company.trim()
    );
    const totalMissingFields =
      missingEmail.length + missingPhone.length + missingCompany.length;

    /* 6 ─ Overdue Tasks */
    const todayStr = now.toISOString().split("T")[0];
    const overdueTasks = tasks.filter(
      (t) => !t.completed && t.dueDate && t.dueDate < todayStr
    );

    return {
      staleContacts,
      atRiskDeals,
      totalPipeline,
      totalClosed,
      momChange,
      thisMonthRevenue,
      lastMonthRevenue,
      quickWins,
      missingEmail,
      missingPhone,
      missingCompany,
      totalMissingFields,
      overdueTasks,
    };
  }, [customers, tasks, meetings]);

  const hasNoData = customers.length === 0;

  if (hasNoData) {
    return (
      <div
        className={`rounded-xl border p-10 text-center ${
          isDarkMode
            ? "bg-slate-900/80 border-slate-700/60"
            : "bg-white border-[#ede8da]/80"
        }`}
      >
        <div
          className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
            isDarkMode ? "bg-slate-800" : "bg-slate-100"
          }`}
        >
          <Zap
            className={`w-6 h-6 ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}
          />
        </div>
        <p
          className={`text-sm font-medium ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Add contacts to unlock AI-powered insights
        </p>
        <p
          className={`text-xs mt-1 ${
            isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        >
          Insights are computed automatically from your CRM data
        </p>
      </div>
    );
  }

  // Count total actionable insights
  const actionableCount =
    (insights.staleContacts.length > 0 ? 1 : 0) +
    (insights.atRiskDeals.length > 0 ? 1 : 0) +
    (insights.quickWins.length > 0 ? 1 : 0) +
    (insights.totalMissingFields > 0 ? 1 : 0) +
    (insights.overdueTasks.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isDarkMode ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            <Zap
              className={`w-3.5 h-3.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            />
          </div>
          <div>
            <h2
              className={`text-sm font-semibold ${
                isDarkMode ? "text-white" : "text-slate-800"
              }`}
            >
              Insights
            </h2>
            <p
              className={`text-[10px] ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {actionableCount > 0
                ? `${actionableCount} actionable insight${actionableCount !== 1 ? "s" : ""}`
                : "All clear — no immediate actions needed"}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isDarkMode
              ? "bg-slate-800 text-slate-400"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          Auto-computed
        </span>
      </div>

      {/* Insight Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* ── Revenue Summary ── */}
        <InsightCard icon={DollarSign} title="Revenue Summary" isDarkMode={isDarkMode}>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-lg font-bold tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-800"
                }`}
              >
                ${insights.totalPipeline.toLocaleString()}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                pipeline
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-sm font-semibold ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                ${insights.totalClosed.toLocaleString()}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                closed revenue
              </span>
            </div>
            {insights.momChange !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                {insights.momChange >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span
                  className={`text-[11px] font-medium ${
                    insights.momChange >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {insights.momChange >= 0 ? "+" : ""}
                  {insights.momChange.toFixed(1)}% month-over-month
                </span>
              </div>
            )}
          </div>
        </InsightCard>

        {/* ── Stale Contacts ── */}
        <InsightCard icon={Clock} title="Stale Contacts" isDarkMode={isDarkMode}>
          {insights.staleContacts.length === 0 ? (
            <p
              className={`text-xs ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              All contacts have been reached within the last 30 days
            </p>
          ) : (
            <div className="space-y-2">
              <p
                className={`text-xs ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span className="font-semibold">
                  {insights.staleContacts.length}
                </span>{" "}
                contact{insights.staleContacts.length !== 1 ? "s" : ""} not
                reached in 30+ days
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insights.staleContacts.slice(0, 5).map((c) => (
                  <ContactChip
                    key={c.id}
                    name={`${c.firstName} ${c.lastName}`.trim()}
                    onClick={() => onNavigateToContact(c.id)}
                    isDarkMode={isDarkMode}
                  />
                ))}
                {insights.staleContacts.length > 5 && (
                  <span
                    className={`text-[10px] self-center ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    +{insights.staleContacts.length - 5} more
                  </span>
                )}
              </div>
              <CTAButton
                label="View contacts"
                onClick={() =>
                  onNavigateToContact(insights.staleContacts[0]?.id ?? "")
                }
                isDarkMode={isDarkMode}
              />
            </div>
          )}
        </InsightCard>

        {/* ── At-Risk Deals ── */}
        <InsightCard
          icon={AlertTriangle}
          title="At-Risk Deals"
          isDarkMode={isDarkMode}
        >
          {insights.atRiskDeals.length === 0 ? (
            <p
              className={`text-xs ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              No at-risk deals — all active leads have recent activity
            </p>
          ) : (
            <div className="space-y-2">
              <p
                className={`text-xs ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span className="font-semibold">
                  {insights.atRiskDeals.length}
                </span>{" "}
                warm/interested lead{insights.atRiskDeals.length !== 1 ? "s" : ""}{" "}
                with no activity in 14+ days
              </p>
              <div className="flex flex-wrap gap-1.5">
                {insights.atRiskDeals.slice(0, 5).map((c) => (
                  <ContactChip
                    key={c.id}
                    name={`${c.firstName} ${c.lastName}`.trim()}
                    onClick={() => onNavigateToContact(c.id)}
                    isDarkMode={isDarkMode}
                  />
                ))}
                {insights.atRiskDeals.length > 5 && (
                  <span
                    className={`text-[10px] self-center ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    +{insights.atRiskDeals.length - 5} more
                  </span>
                )}
              </div>
              <CTAButton
                label="Schedule follow-up"
                onClick={() =>
                  onNavigateToContact(insights.atRiskDeals[0]?.id ?? "")
                }
                isDarkMode={isDarkMode}
              />
            </div>
          )}
        </InsightCard>

        {/* ── Quick Wins ── */}
        <InsightCard icon={Zap} title="Quick Wins" isDarkMode={isDarkMode}>
          {insights.quickWins.length === 0 ? (
            <p
              className={`text-xs ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              No hot leads right now — check back after engaging contacts
            </p>
          ) : (
            <div className="space-y-2">
              <p
                className={`text-xs ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span className="font-semibold">
                  {insights.quickWins.length}
                </span>{" "}
                interested contact{insights.quickWins.length !== 1 ? "s" : ""}{" "}
                with recent activity — closest to converting
              </p>
              <div className="space-y-1.5">
                {insights.quickWins.slice(0, 4).map((c, idx) => (
                  <button
                    key={c.id}
                    onClick={() => onNavigateToContact(c.id)}
                    className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-slate-800"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isDarkMode
                          ? "bg-slate-800 text-slate-400"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-xs font-medium block truncate ${
                          isDarkMode ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {c.firstName} {c.lastName}
                      </span>
                      {c.company && (
                        <span
                          className={`text-[10px] block truncate ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {c.company}
                        </span>
                      )}
                    </div>
                    {c.totalRevenue > 0 && (
                      <span
                        className={`text-[10px] font-medium ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        ${c.totalRevenue.toLocaleString()}
                      </span>
                    )}
                    <ChevronRight
                      className={`w-3 h-3 flex-shrink-0 ${
                        isDarkMode ? "text-slate-600" : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {insights.quickWins.length > 4 && (
                <p
                  className={`text-[10px] ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  +{insights.quickWins.length - 4} more quick wins
                </p>
              )}
            </div>
          )}
        </InsightCard>

        {/* ── Missing Data Alerts ── */}
        <InsightCard
          icon={AlertCircle}
          title="Missing Data"
          isDarkMode={isDarkMode}
        >
          {insights.totalMissingFields === 0 ? (
            <p
              className={`text-xs ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              All contacts have complete core data
            </p>
          ) : (
            <div className="space-y-2">
              {insights.missingEmail.length > 0 && (
                <div className="flex items-center gap-2">
                  <Mail
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <span className="font-semibold">
                      {insights.missingEmail.length}
                    </span>{" "}
                    contact{insights.missingEmail.length !== 1 ? "s" : ""}{" "}
                    missing email
                  </span>
                </div>
              )}
              {insights.missingPhone.length > 0 && (
                <div className="flex items-center gap-2">
                  <Phone
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isDarkMode ? "text-slate-400" : "text-slate-400"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <span className="font-semibold">
                      {insights.missingPhone.length}
                    </span>{" "}
                    contact{insights.missingPhone.length !== 1 ? "s" : ""}{" "}
                    missing phone
                  </span>
                </div>
              )}
              {insights.missingCompany.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <span className="font-semibold">
                      {insights.missingCompany.length}
                    </span>{" "}
                    contact{insights.missingCompany.length !== 1 ? "s" : ""}{" "}
                    missing company
                  </span>
                </div>
              )}
            </div>
          )}
        </InsightCard>

        {/* ── Overdue Tasks ── */}
        <InsightCard
          icon={Users}
          title="Overdue Tasks"
          isDarkMode={isDarkMode}
        >
          {insights.overdueTasks.length === 0 ? (
            <p
              className={`text-xs ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              No overdue tasks — you&apos;re on track
            </p>
          ) : (
            <div className="space-y-2">
              <p
                className={`text-xs ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span className="font-semibold text-red-500">
                  {insights.overdueTasks.length}
                </span>{" "}
                task{insights.overdueTasks.length !== 1 ? "s" : ""} past due
                date
              </p>
              <div className="space-y-1">
                {insights.overdueTasks.slice(0, 4).map((t) => {
                  const contactName = t.contactName || "";
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs ${
                        isDarkMode ? "bg-slate-800/60" : "bg-slate-50"
                      }`}
                    >
                      <span
                        className={`truncate ${
                          isDarkMode ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="text-[10px] text-red-500 flex-shrink-0 font-medium">
                        {t.dueDate}
                      </span>
                    </div>
                  );
                })}
              </div>
              {insights.overdueTasks.length > 4 && (
                <p
                  className={`text-[10px] ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  +{insights.overdueTasks.length - 4} more overdue
                </p>
              )}
            </div>
          )}
        </InsightCard>
      </div>
    </div>
  );
}
