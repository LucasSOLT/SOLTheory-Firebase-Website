"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock, FileEdit, AlertTriangle, Loader2 } from "lucide-react";
import type { InstagramPost } from "../_hooks/useBIData";

/* ── Status config ─────────────────────────────────────── */

const STATUS_CONFIG = [
  { id: "published",  label: "Published",  icon: CheckCircle2,  color: "#22c55e", bgDk: "rgba(34,197,94,0.1)",  bgLt: "rgba(34,197,94,0.08)" },
  { id: "scheduled",  label: "Scheduled",  icon: Clock,         color: "#3b82f6", bgDk: "rgba(59,130,246,0.1)", bgLt: "rgba(59,130,246,0.08)" },
  { id: "draft",      label: "Drafts",     icon: FileEdit,      color: "#f59e0b", bgDk: "rgba(245,158,11,0.1)", bgLt: "rgba(245,158,11,0.08)" },
  { id: "processing", label: "Processing", icon: Loader2,       color: "#8b5cf6", bgDk: "rgba(139,92,246,0.1)", bgLt: "rgba(139,92,246,0.08)" },
  { id: "failed",     label: "Failed",     icon: AlertTriangle, color: "#ef4444", bgDk: "rgba(239,68,68,0.1)",  bgLt: "rgba(239,68,68,0.08)" },
];

/* ── Component ─────────────────────────────────────────── */

export default function InstagramOverviewCard({
  posts,
  dk,
}: {
  posts: InstagramPost[];
  dk: boolean;
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) {
      const st = p.status?.toLowerCase() || "draft";
      map.set(st, (map.get(st) || 0) + 1);
    }
    return map;
  }, [posts]);

  // Filter to only show statuses that have data (or always show published/scheduled/draft)
  const visibleStatuses = STATUS_CONFIG.filter(
    (s) => (counts.get(s.id) || 0) > 0 || ["published", "scheduled", "draft"].includes(s.id)
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visibleStatuses.map((s) => {
        const Icon = s.icon;
        const count = counts.get(s.id) || 0;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-3 p-3 rounded-xl border ${
              dk ? "bg-slate-800/50 border-slate-700/60" : "bg-white border-slate-200/60"
            }`}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: dk ? s.bgDk : s.bgLt }}
            >
              <Icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div className="min-w-0">
              <div
                className="text-lg font-bold tabular-nums leading-tight"
                style={{ color: s.color }}
              >
                {count}
              </div>
              <div className={`text-[10px] font-medium uppercase tracking-wider ${dk ? "text-slate-500" : "text-slate-400"}`}>
                {s.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
