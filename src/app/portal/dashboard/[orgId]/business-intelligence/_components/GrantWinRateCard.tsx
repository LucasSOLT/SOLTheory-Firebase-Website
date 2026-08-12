"use client";

import { useMemo } from "react";
import { Trophy, Send, DollarSign, TrendingUp } from "lucide-react";
import type { GrantSuggestion } from "../_hooks/useBIData";

/* ── Component ─────────────────────────────────────────── */

export default function GrantWinRateCard({
  grants,
  dk,
}: {
  grants: GrantSuggestion[];
  dk: boolean;
}) {
  const stats = useMemo(() => {
    const submitted = grants.filter(
      (g) => ["submitted", "awarded", "denied"].includes(g.status?.toLowerCase())
    );
    const awarded = grants.filter((g) => g.status?.toLowerCase() === "awarded");
    const denied = grants.filter((g) => g.status?.toLowerCase() === "denied");
    const decided = awarded.length + denied.length;
    const winRate = decided > 0 ? (awarded.length / decided) * 100 : 0;

    const potentialFunding = awarded.reduce((sum, g) => {
      const avg =
        ((g.awardAmountMin || 0) + (g.awardAmountMax || g.awardAmountMin || 0)) / 2;
      return sum + avg;
    }, 0);

    return {
      winRate,
      submittedCount: submitted.length,
      awardedCount: awarded.length,
      potentialFunding,
    };
  }, [grants]);

  const metrics = [
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      icon: Trophy,
      color: "#22c55e",
      bgColor: dk ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)",
    },
    {
      label: "Submitted",
      value: stats.submittedCount.toString(),
      icon: Send,
      color: "#8b5cf6",
      bgColor: dk ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.08)",
    },
    {
      label: "Awarded",
      value: stats.awardedCount.toString(),
      icon: TrendingUp,
      color: "#3b82f6",
      bgColor: dk ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)",
    },
    {
      label: "Awarded Funding",
      value: `$${stats.potentialFunding >= 1000 ? `${(stats.potentialFunding / 1000).toFixed(1)}k` : stats.potentialFunding.toLocaleString()}`,
      icon: DollarSign,
      color: "#f59e0b",
      bgColor: dk ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.08)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className={`flex items-center gap-3 p-3 rounded-xl border ${
              dk ? "bg-slate-800/50 border-slate-700/60" : "bg-white border-slate-200/60"
            }`}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: m.bgColor }}
            >
              <Icon className="w-4 h-4" style={{ color: m.color }} />
            </div>
            <div className="min-w-0">
              <div
                className="text-lg font-bold tabular-nums leading-tight"
                style={{ color: m.color }}
              >
                {m.value}
              </div>
              <div className={`text-[10px] font-medium uppercase tracking-wider ${dk ? "text-slate-500" : "text-slate-400"}`}>
                {m.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
