"use client";

import { useMemo } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { useDarkMode } from "@/lib/useDarkMode";
import type { GrantRecord } from "@/hooks/useGrantsData";

/* ─── Extended GrantRecord with optional Firestore fields ─── */
type GrantWithDeadline = GrantRecord & {
  closeDate?: string | null;
};

interface Props {
  grants: GrantWithDeadline[];
  onGrantClick?: (grantId: string) => void;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function getDaysLeft(closeDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const close = new Date(closeDate);
  close.setHours(0, 0, 0, 0);
  return Math.ceil((close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyStyles(
  daysLeft: number,
  dark: boolean
): { pill: string; text: string; pulse: boolean } {
  if (daysLeft < 3) {
    return {
      pill: dark
        ? "bg-red-950/60 border-red-700"
        : "bg-red-50 border-red-200",
      text: dark ? "text-red-300" : "text-red-700",
      pulse: true,
    };
  }
  if (daysLeft <= 7) {
    return {
      pill: dark
        ? "bg-amber-950/50 border-amber-700"
        : "bg-amber-50 border-amber-200",
      text: dark ? "text-amber-300" : "text-amber-700",
      pulse: false,
    };
  }
  return {
    pill: dark
      ? "bg-slate-800 border-slate-600"
      : "bg-slate-50 border-slate-200",
    text: dark ? "text-slate-300" : "text-slate-600",
    pulse: false,
  };
}

export function GrantDeadlineAlerts({ grants, onGrantClick }: Props) {
  const isDarkMode = useDarkMode();

  const closingSoon = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return grants
      .filter((g) => {
        // Only unapplied or applied grants
        if (g.status !== "unapplied" && g.status !== "applied") return false;
        // Must have a closeDate
        if (!g.closeDate) return false;
        const daysLeft = getDaysLeft(g.closeDate);
        return daysLeft >= 0 && daysLeft <= 14;
      })
      .map((g) => ({
        ...g,
        daysLeft: getDaysLeft(g.closeDate!),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [grants]);

  // Render nothing if no grants closing soon
  if (closingSoon.length === 0) {
    console.log("[GrantUI] GrantDeadlineAlerts: no grants closing within 14 days");
    return null;
  }

  console.log(
    `[GrantUI] GrantDeadlineAlerts: ${closingSoon.length} grants closing soon`
  );

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center gap-3 overflow-x-auto ${
        isDarkMode
          ? "bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700"
          : "bg-gradient-to-r from-[#faf8f3] to-[#faf6ed] border-slate-200"
      }`}
    >
      {/* Clock icon + count */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isDarkMode ? "bg-amber-950/50" : "bg-amber-50"
          }`}
        >
          <Clock
            className={`w-4 h-4 ${
              isDarkMode ? "text-amber-400" : "text-amber-600"
            }`}
          />
        </div>
        <div className="flex flex-col">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
              isDarkMode ? "text-slate-300" : "text-slate-500"
            }`}
          >
            {closingSoon.length} grant{closingSoon.length !== 1 ? "s" : ""}{" "}
            closing soon
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        className={`w-px h-6 shrink-0 ${
          isDarkMode ? "bg-slate-700" : "bg-slate-200"
        }`}
      />

      {/* Grant pills */}
      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        {closingSoon.map((grant) => {
          const urgency = getUrgencyStyles(grant.daysLeft, isDarkMode);
          return (
            <button
              key={grant.id}
              onClick={() => onGrantClick?.(grant.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer
                hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                ${urgency.pill} ${urgency.pulse ? "animate-pulse" : ""}`}
              title={grant.title}
            >
              {grant.daysLeft < 3 && (
                <AlertTriangle
                  className={`w-3 h-3 shrink-0 ${
                    isDarkMode ? "text-red-400" : "text-red-500"
                  }`}
                />
              )}
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${urgency.text}`}
              >
                {truncate(grant.title, 30)}
              </span>
              <span
                className={`text-[9px] font-bold whitespace-nowrap ${
                  isDarkMode ? "text-slate-400" : "text-slate-400"
                }`}
              >
                — {grant.daysLeft === 0
                  ? "today"
                  : grant.daysLeft === 1
                  ? "1 day left"
                  : `${grant.daysLeft} days left`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
