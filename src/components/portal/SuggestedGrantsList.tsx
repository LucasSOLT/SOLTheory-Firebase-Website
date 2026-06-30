"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, ScrollText, ChevronDown, Check, Trash2, ExternalLink } from "lucide-react";
import { useFirestore } from "@/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from '@/lib/useDarkMode';
import type { GrantRecord } from "@/hooks/useGrantsData";

type FilterCategory = "none" | "unapplied" | "applied" | "completed";

const FILTER_KEYS: FilterCategory[] = ["none", "unapplied", "applied", "completed"];

function getStatusPillStyles(dark: boolean): Record<
  string,
  { bg: string; text: string; border: string }
> {
  return {
    approved: {
      bg: dark ? "bg-emerald-950/50" : "bg-emerald-50",
      text: dark ? "text-emerald-400" : "text-emerald-700",
      border: dark ? "border-emerald-800" : "border-emerald-200",
    },
    denied: {
      bg: dark ? "bg-red-950/50" : "bg-red-50",
      text: dark ? "text-red-400" : "text-red-600",
      border: dark ? "border-red-800" : "border-red-200",
    },
    applied: {
      bg: dark ? "bg-amber-950/50" : "bg-amber-50",
      text: dark ? "text-amber-400" : "text-amber-700",
      border: dark ? "border-amber-800" : "border-amber-200",
    },
    unapplied: {
      bg: dark ? "bg-slate-800" : "bg-[#faf6ed]",
      text: dark ? "text-slate-300" : "text-slate-500",
      border: dark ? "border-slate-600" : "border-slate-200",
    },
  };
}

function getCardBg(status: string, dark: boolean): string {
  if (dark) {
    switch (status) {
      case "approved":
        return "bg-emerald-950/30 border-emerald-800/60";
      case "denied":
        return "bg-red-950/30 border-red-800/50";
      default:
        return "bg-slate-800/60 border-slate-700";
    }
  }
  switch (status) {
    case "approved":
      return "bg-emerald-50/50 border-emerald-100/80";
    case "denied":
      return "bg-red-50/40 border-red-100/70";
    default:
      return "bg-[#faf8f3] border-slate-100";
  }
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "â€”";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ts: string | null): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

interface Props {
  grants: GrantRecord[];
  loading: boolean;
}

export function SuggestedGrantsList({ grants = [], loading }: Props) {
  const { t } = useTranslation();
  const firestore = useFirestore();
  const isDarkMode = useDarkMode();
  const [filter, setFilter] = useState<FilterCategory>("none");

  const filterLabelMap: Record<FilterCategory, string> = {
    none: t.allGrants,
    unapplied: t.unApplied,
    applied: t.applied,
    completed: t.completed,
  };

  const statusLabelMap: Record<string, string> = {
    approved: t.approved,
    denied: t.denied,
    applied: t.pending,
    unapplied: t.unApplied,
  };
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);

  // Block mouse-wheel scrolling on the grants list — user must drag the scrollbar thumb
  useEffect(() => {
    const el = scrollListRef.current;
    if (!el) return;
    const blockWheel = (e: WheelEvent) => {
      if (el.scrollHeight > el.clientHeight) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', blockWheel, { passive: false });
    return () => el.removeEventListener('wheel', blockWheel);
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  // Delete a single grant
  async function handleDelete(grantId: string) {
    if (!firestore) return;
    setDeletingIds((prev) => new Set(prev).add(grantId));
    try {
      await deleteDoc(doc(firestore, "grant_suggestions", grantId));
    } catch (err) {
      console.error("Failed to delete grant:", err);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(grantId);
        return next;
      });
    }
  }

  // Apply filter + sort using standard .filter() and .sort()
  const filteredGrants = useMemo(() => {
    let result = [...grants];

    // Filter by category
    switch (filter) {
      case "unapplied":
        result = result.filter((g) => g.status === "unapplied");
        break;
      case "applied":
        result = result.filter((g) => g.status === "applied");
        break;
      case "completed":
        result = result.filter((g) => g.status === "approved" || g.status === "denied");
        break;
      default:
        break; // "none" â€” show all
    }

    // Sort: most recently suggested first
    result.sort((a, b) => {
      const aMs = a.dateSuggested ? new Date(a.dateSuggested).getTime() : 0;
      const bMs = b.dateSuggested ? new Date(b.dateSuggested).getTime() : 0;
      return bMs - aMs;
    });

    return result;
  }, [grants, filter]);

  const activeFilterLabel = filterLabelMap[filter] ?? t.allGrants;

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <ScrollText className={`w-3.5 h-3.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>
            {t.suggestedGrants}
          </span>
        </div>

        {/* Categorize dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider border rounded-lg px-2 py-1 transition-colors cursor-pointer ${isDarkMode ? 'text-slate-300 bg-slate-800 hover:bg-slate-700 border-slate-600' : 'text-slate-500 bg-[#faf6ed] hover:bg-slate-100 border-slate-200/80'}`}
          >
            <span>{activeFilterLabel}</span>
            <ChevronDown
              className={`w-2.5 h-2.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className={`absolute right-0 top-full mt-1 z-[60] border rounded-xl shadow-lg py-1 min-w-[120px] animate-in fade-in slide-in-from-top-1 duration-150 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-[#faf8f3] border-slate-200'}`}>
              {FILTER_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setFilter(key);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[9px] font-semibold transition-colors cursor-pointer ${
                    filter === key
                      ? isDarkMode ? "text-indigo-400 bg-indigo-950/40" : "text-indigo-600 bg-indigo-50/60"
                      : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#f2ece0]"
                  }`}
                >
                  <span>{filterLabelMap[key]}</span>
                  {filter === key && <Check className={`w-3 h-3 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Count indicator */}
      <div className="mb-1.5 shrink-0">
        <span className={`text-[8px] font-semibold tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>
          {filteredGrants.length} {t.of} {grants.length} {t.grants}
        </span>
      </div>

      {/* Scrollable list */}
      {filteredGrants.length === 0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed ${isDarkMode ? 'bg-slate-800/50 border-slate-600/60' : 'bg-[#faf6ed]/50 border-slate-200/60'}`}>
          <ScrollText className={`w-5 h-5 mb-1.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>
            {filter === "none" ? t.noSuggestedGrants : `${activeFilterLabel} — ${t.noGrantsMatchFilter}`}
          </span>
          <span className={`text-[8px] mt-0.5 max-w-[180px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {filter === "none"
              ? t.grantsSuggestedWillAppear
              : t.noGrantsMatchFilter}
          </span>
        </div>
      ) : (
        <div
          ref={scrollListRef}
          className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5"
        >
          {filteredGrants.map((grant) => {
            const statusPills = getStatusPillStyles(isDarkMode);
            const pillStyle = statusPills[grant.status] || statusPills.unapplied;
            const pillLabel = statusLabelMap[grant.status] || t.unApplied;
            const cardBg = getCardBg(grant.status, isDarkMode);
            const isDeleting = deletingIds.has(grant.id);
            return (
              <div
                key={grant.id}
                className={`group ${cardBg} border shadow-sm rounded-lg px-3 py-2 flex items-center justify-between gap-2 hover:shadow transition-all ${
                  isDeleting ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {/* Left: Title + date */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className={`text-[10px] font-bold truncate leading-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      {grant.title}
                    </p>
                    {grant.url && (
                      <a
                        href={grant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`shrink-0 transition-colors opacity-0 group-hover:opacity-100 ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-400 hover:text-indigo-600'}`}
                        title={t.openGrantPage}
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <p className={`text-[8px] font-medium truncate mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    {formatDate(grant.dateSuggested)}
                    {grant.amount != null && (
                      <span className={`ml-1.5 font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                        {formatCurrency(grant.amount)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Center: Agency */}
                <div className="hidden sm:block shrink-0 max-w-[100px]">
                  <span className={`text-[8px] font-semibold truncate block ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    {grant.agency}
                  </span>
                </div>

                {/* Right: Status pill + Delete */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[7px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pillStyle.bg} ${pillStyle.text} ${pillStyle.border}`}
                  >
                    {pillLabel}
                  </span>
                  {/* Delete button â€” visible on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(grant.id);
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-950/50' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                    title={t.removeGrant}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-2.5 h-2.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
