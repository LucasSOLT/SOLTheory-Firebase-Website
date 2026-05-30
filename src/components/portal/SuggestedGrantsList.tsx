"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, ScrollText, ChevronDown, Check, Trash2, ExternalLink } from "lucide-react";
import { useFirestore } from "@/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import type { GrantRecord } from "@/hooks/useGrantsData";

type FilterCategory = "none" | "unapplied" | "applied" | "completed";

const FILTER_OPTIONS: { key: FilterCategory; label: string }[] = [
  { key: "none", label: "All Grants" },
  { key: "unapplied", label: "Un-Applied" },
  { key: "applied", label: "Applied" },
  { key: "completed", label: "Completed" },
];

const STATUS_PILLS: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  approved: {
    label: "Approved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  denied: {
    label: "Denied",
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
  },
  applied: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  unapplied: {
    label: "Un-Applied",
    bg: "bg-slate-50",
    text: "text-slate-500",
    border: "border-slate-200",
  },
};

function getCardBg(status: string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-50/50 border-emerald-100/80";
    case "denied":
      return "bg-red-50/40 border-red-100/70";
    default:
      return "bg-white border-slate-100";
  }
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
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
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterCategory>("none");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        break; // "none" — show all
    }

    // Sort: most recently suggested first
    result.sort((a, b) => {
      const aMs = a.dateSuggested ? new Date(a.dateSuggested).getTime() : 0;
      const bMs = b.dateSuggested ? new Date(b.dateSuggested).getTime() : 0;
      return bMs - aMs;
    });

    return result;
  }, [grants, filter]);

  const activeFilterLabel = FILTER_OPTIONS.find((o) => o.key === filter)?.label ?? "All Grants";

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
          <ScrollText className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Suggested Grants
          </span>
        </div>

        {/* Categorize dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg px-2 py-1 transition-colors cursor-pointer"
          >
            <span>{activeFilterLabel}</span>
            <ChevronDown
              className={`w-2.5 h-2.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-[60] bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[120px] animate-in fade-in slide-in-from-top-1 duration-150">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setFilter(opt.key);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[9px] font-semibold transition-colors cursor-pointer ${
                    filter === opt.key
                      ? "text-indigo-600 bg-indigo-50/60"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{opt.label}</span>
                  {filter === opt.key && <Check className="w-3 h-3 text-indigo-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Count indicator */}
      <div className="mb-1.5 shrink-0">
        <span className="text-[8px] font-semibold text-slate-300 tabular-nums">
          {filteredGrants.length} of {grants.length} grants
        </span>
      </div>

      {/* Scrollable list */}
      {filteredGrants.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200/60">
          <ScrollText className="w-5 h-5 text-slate-300 mb-1.5" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {filter === "none" ? "No Suggested Grants" : `No ${activeFilterLabel} Grants`}
          </span>
          <span className="text-[8px] text-slate-400 mt-0.5 max-w-[180px]">
            {filter === "none"
              ? "Grants suggested by the agent will appear here."
              : "No grants match this filter."}
          </span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
          {filteredGrants.map((grant) => {
            const pill = STATUS_PILLS[grant.status] || STATUS_PILLS.unapplied;
            const cardBg = getCardBg(grant.status);
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
                    <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">
                      {grant.title}
                    </p>
                    {grant.url && (
                      <a
                        href={grant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Open grant page"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[8px] text-slate-400 font-medium truncate mt-0.5">
                    {formatDate(grant.dateSuggested)}
                    {grant.amount != null && (
                      <span className="ml-1.5 text-slate-500 font-semibold">
                        {formatCurrency(grant.amount)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Center: Agency */}
                <div className="hidden sm:block shrink-0 max-w-[100px]">
                  <span className="text-[8px] font-semibold text-slate-400 truncate block">
                    {grant.agency}
                  </span>
                </div>

                {/* Right: Status pill + Delete */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[7px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pill.bg} ${pill.text} ${pill.border}`}
                  >
                    {pill.label}
                  </span>
                  {/* Delete button — visible on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(grant.id);
                    }}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                    title="Remove grant"
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
