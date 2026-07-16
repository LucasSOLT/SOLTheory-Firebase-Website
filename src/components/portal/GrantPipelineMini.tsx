"use client";

import { useMemo } from "react";
import { useDarkMode } from "@/lib/useDarkMode";
import type { GrantRecord } from "@/hooks/useGrantsData";
import { TrendingUp, Clock, AlertTriangle } from "lucide-react";

interface Props {
  grants: GrantRecord[];
  loading: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

/**
 * Compact grant pipeline summary for the main dashboard.
 * Shows a horizontal flow: Discovered → Applied → Approved
 * with counts, funding totals, and closing-soon alerts.
 */
export function GrantPipelineMini({ grants = [], loading }: Props) {
  const isDarkMode = useDarkMode();

  const stats = useMemo(() => {
    const discovered = grants.filter((g) => g.status === "unapplied");
    const applied = grants.filter((g) => g.status === "applied");
    const approved = grants.filter((g) => g.status === "approved");
    const denied = grants.filter((g) => g.status === "denied");

    const sumKnown = (arr: GrantRecord[]) =>
      arr.reduce((sum, g) => sum + (g.amount ?? 0), 0);

    // Count closing within 7 days
    const now = Date.now();
    const closingSoon = grants.filter((g) => {
      if (!g.closeDate || g.status === "approved" || g.status === "denied") return false;
      const days = Math.ceil((new Date(g.closeDate).getTime() - now) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    });

    return {
      discovered: discovered.length,
      discoveredFunding: sumKnown(discovered),
      applied: applied.length,
      appliedFunding: sumKnown(applied),
      approved: approved.length,
      approvedFunding: sumKnown(approved),
      denied: denied.length,
      closingSoon: closingSoon.length,
      total: grants.length,
    };
  }, [grants]);

  if (loading) return null;

  const stages = [
    {
      label: "Found",
      count: stats.discovered,
      funding: stats.discoveredFunding,
      color: isDarkMode ? "text-indigo-400" : "text-indigo-600",
      bg: isDarkMode ? "bg-indigo-950/40" : "bg-indigo-50",
      border: isDarkMode ? "border-indigo-800" : "border-indigo-200",
      dotColor: isDarkMode ? "bg-indigo-400" : "bg-indigo-500",
    },
    {
      label: "Applied",
      count: stats.applied,
      funding: stats.appliedFunding,
      color: isDarkMode ? "text-amber-400" : "text-amber-600",
      bg: isDarkMode ? "bg-amber-950/40" : "bg-amber-50",
      border: isDarkMode ? "border-amber-800" : "border-amber-200",
      dotColor: isDarkMode ? "bg-amber-400" : "bg-amber-500",
    },
    {
      label: "Won",
      count: stats.approved,
      funding: stats.approvedFunding,
      color: isDarkMode ? "text-emerald-400" : "text-emerald-600",
      bg: isDarkMode ? "bg-emerald-950/40" : "bg-emerald-50",
      border: isDarkMode ? "border-emerald-800" : "border-emerald-200",
      dotColor: isDarkMode ? "bg-emerald-400" : "bg-emerald-500",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Pipeline flow */}
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`flex-1 ${stage.bg} border ${stage.border} rounded-xl px-2.5 py-2 min-w-0`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${stage.dotColor}`} />
                <span className={`text-[8px] font-bold uppercase tracking-wider ${stage.color}`}>
                  {stage.label}
                </span>
              </div>
              <p className={`text-lg font-extrabold tabular-nums ${stage.color}`}>{stage.count}</p>
              {stage.funding > 0 && (
                <p className={`text-[9px] font-semibold tabular-nums mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {formatCurrency(stage.funding)}
                </p>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className={`shrink-0 text-[10px] ${isDarkMode ? "text-slate-600" : "text-slate-300"}`}>→</div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom alerts row */}
      <div className="flex items-center gap-3">
        {stats.closingSoon > 0 && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${isDarkMode ? "bg-amber-950/40 border-amber-800" : "bg-amber-50 border-amber-200"} border`}>
            <Clock className={`w-3 h-3 ${isDarkMode ? "text-amber-400" : "text-amber-500"}`} />
            <span className={`text-[9px] font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
              {stats.closingSoon} closing soon
            </span>
          </div>
        )}
        {stats.denied > 0 && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${isDarkMode ? "bg-red-950/40 border-red-800" : "bg-red-50 border-red-200"} border`}>
            <AlertTriangle className={`w-3 h-3 ${isDarkMode ? "text-red-400" : "text-red-500"}`} />
            <span className={`text-[9px] font-bold ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
              {stats.denied} denied
            </span>
          </div>
        )}
        {stats.total > 0 && (
          <div className={`flex items-center gap-1.5 ml-auto`}>
            <TrendingUp className={`w-3 h-3 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} />
            <span className={`text-[9px] font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {stats.total} total
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
