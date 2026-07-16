"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  GripVertical,
  Search as SearchIcon,
  DollarSign,
  CalendarClock,
  Building2,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { useDarkMode } from "@/lib/useDarkMode";
import type { GrantRecord } from "@/hooks/useGrantsData";

/* ─── Extended GrantRecord with optional Firestore fields ─── */
type GrantWithExtras = GrantRecord & {
  closeDate?: string | null;
};

/* ─── Pipeline column config ─── */
interface ColumnConfig {
  key: GrantRecord["status"];
  label: string;
  accentLight: string;
  accentDark: string;
  headerBg: string;
  headerBgDark: string;
  borderAccent: string;
  borderAccentDark: string;
  countBg: string;
  countBgDark: string;
  countText: string;
  countTextDark: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: "unapplied",
    label: "DISCOVERED",
    accentLight: "text-indigo-600",
    accentDark: "text-indigo-400",
    headerBg: "bg-indigo-50",
    headerBgDark: "bg-indigo-950/40",
    borderAccent: "border-indigo-200",
    borderAccentDark: "border-indigo-800",
    countBg: "bg-indigo-100",
    countBgDark: "bg-indigo-900/60",
    countText: "text-indigo-700",
    countTextDark: "text-indigo-300",
  },
  {
    key: "applied",
    label: "APPLIED",
    accentLight: "text-amber-600",
    accentDark: "text-amber-400",
    headerBg: "bg-amber-50",
    headerBgDark: "bg-amber-950/40",
    borderAccent: "border-amber-200",
    borderAccentDark: "border-amber-800",
    countBg: "bg-amber-100",
    countBgDark: "bg-amber-900/60",
    countText: "text-amber-700",
    countTextDark: "text-amber-300",
  },
  {
    key: "approved",
    label: "APPROVED",
    accentLight: "text-emerald-600",
    accentDark: "text-emerald-400",
    headerBg: "bg-emerald-50",
    headerBgDark: "bg-emerald-950/40",
    borderAccent: "border-emerald-200",
    borderAccentDark: "border-emerald-800",
    countBg: "bg-emerald-100",
    countBgDark: "bg-emerald-900/60",
    countText: "text-emerald-700",
    countTextDark: "text-emerald-300",
  },
  {
    key: "denied",
    label: "DENIED",
    accentLight: "text-red-600",
    accentDark: "text-red-400",
    headerBg: "bg-red-50",
    headerBgDark: "bg-red-950/40",
    borderAccent: "border-red-200",
    borderAccentDark: "border-red-800",
    countBg: "bg-red-100",
    countBgDark: "bg-red-900/60",
    countText: "text-red-700",
    countTextDark: "text-red-300",
  },
];

/* ─── Helpers ─── */

function formatCurrency(amount: number | null): string {
  if (amount == null) return "Not specified";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyCompact(amount: number | null): string {
  if (amount == null) return "—";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function getDeadlineText(closeDate: string | null | undefined): string | null {
  if (!closeDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const close = new Date(closeDate);
  close.setHours(0, 0, 0, 0);
  const days = Math.ceil(
    (close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return "Closed";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/* ─── Confetti animation (CSS-only) ─── */

const CONFETTI_KEYFRAMES = `
@keyframes confetti-fall {
  0% { transform: translateY(-10px) rotate(0deg) scale(1); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translateY(120px) rotate(720deg) scale(0.3); opacity: 0; }
}
@keyframes confetti-spread {
  0% { transform: translateX(0); }
  100% { transform: translateX(var(--spread)); }
}
`;

function ConfettiOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  const particles = useMemo(() => {
    const colors = [
      "#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f59e0b",
      "#8b5cf6", "#a78bfa", "#ec4899", "#f472b6",
    ];
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: `${10 + Math.random() * 80}%`,
      delay: `${Math.random() * 0.5}s`,
      duration: `${0.8 + Math.random() * 0.7}s`,
      spread: `${(Math.random() - 0.5) * 60}px`,
      size: `${4 + Math.random() * 4}px`,
    }));
  }, []);

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden rounded-2xl">
      <style>{CONFETTI_KEYFRAMES}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: p.left,
            top: "-8px",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            // @ts-ignore
            "--spread": p.spread,
            animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards, confetti-spread ${p.duration} ${p.delay} ease-out forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Props ─── */
interface Props {
  grants: GrantWithExtras[];
  onUpdateStatus: (grantId: string, newStatus: string) => void;
}

/* ─── Main Component ─── */

export function GrantPipeline({ grants, onUpdateStatus }: Props) {
  const isDarkMode = useDarkMode();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [confettiColumn, setConfettiColumn] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  // Bucket grants by status
  const buckets = useMemo(() => {
    const map: Record<string, GrantWithExtras[]> = {
      unapplied: [],
      applied: [],
      approved: [],
      denied: [],
    };
    for (const grant of grants) {
      const bucket = map[grant.status];
      if (bucket) bucket.push(grant);
      else map.unapplied.push(grant);
    }
    return map;
  }, [grants]);

  // Column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [key, list] of Object.entries(buckets)) {
      totals[key] = list.reduce((sum, g) => sum + (g.amount ?? 0), 0);
    }
    return totals;
  }, [buckets]);

  /* ─── Drag Handlers ─── */
  const handleDragStart = useCallback(
    (e: React.DragEvent, grantId: string) => {
      console.log("[GrantUI] Pipeline drag start:", grantId);
      setDraggedId(grantId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", grantId);
      // Make the drag image slightly transparent
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedId(null);
    setDragOverColumn(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent, columnKey: string) => {
      e.preventDefault();
      if (!dragCounterRef.current[columnKey]) {
        dragCounterRef.current[columnKey] = 0;
      }
      dragCounterRef.current[columnKey]++;
      setDragOverColumn(columnKey);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, columnKey: string) => {
      e.preventDefault();
      if (dragCounterRef.current[columnKey]) {
        dragCounterRef.current[columnKey]--;
      }
      if (dragCounterRef.current[columnKey] <= 0) {
        dragCounterRef.current[columnKey] = 0;
        if (dragOverColumn === columnKey) {
          setDragOverColumn(null);
        }
      }
    },
    [dragOverColumn]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, columnKey: string) => {
      e.preventDefault();
      const grantId = e.dataTransfer.getData("text/plain");
      setDragOverColumn(null);
      setDraggedId(null);
      dragCounterRef.current = {};

      if (!grantId) return;

      // Find the grant's current status
      const grant = grants.find((g) => g.id === grantId);
      if (!grant || grant.status === columnKey) return;

      console.log(
        `[GrantUI] Pipeline drop: ${grantId} → ${columnKey}`
      );

      // Trigger confetti for APPROVED
      if (columnKey === "approved") {
        setConfettiColumn("approved");
      }

      onUpdateStatus(grantId, columnKey);
    },
    [grants, onUpdateStatus]
  );

  const clearConfetti = useCallback(() => setConfettiColumn(null), []);

  return (
    <div className="w-full">
      {/* Pipeline header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles
          className={`w-4 h-4 ${
            isDarkMode ? "text-indigo-400" : "text-indigo-500"
          }`}
        />
        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${
            isDarkMode ? "text-slate-300" : "text-slate-400"
          }`}
        >
          Grant Pipeline
        </span>
        <span
          className={`text-[9px] font-medium ${
            isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        >
          · {grants.length} total
        </span>
      </div>

      {/* Columns grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const items = buckets[col.key] || [];
          const total = columnTotals[col.key] || 0;
          const isDropTarget = dragOverColumn === col.key;
          const isApproved = col.key === "approved";

          return (
            <div
              key={col.key}
              className={`relative rounded-2xl border transition-all ${
                isDarkMode
                  ? `bg-slate-900/60 ${col.borderAccentDark}`
                  : `bg-[#faf8f3] ${col.borderAccent}`
              } ${
                isApproved
                  ? isDarkMode
                    ? "shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                  : "shadow-sm"
              } ${
                isDropTarget
                  ? isDarkMode
                    ? "ring-2 ring-indigo-500/40 scale-[1.01]"
                    : "ring-2 ring-indigo-400/30 scale-[1.01]"
                  : ""
              }`}
              onDragEnter={(e) => handleDragEnter(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Confetti overlay */}
              {confettiColumn === col.key && (
                <ConfettiOverlay onDone={clearConfetti} />
              )}

              {/* Column header */}
              <div
                className={`px-3 py-2.5 rounded-t-2xl border-b ${
                  isDarkMode
                    ? `${col.headerBgDark} ${col.borderAccentDark}`
                    : `${col.headerBg} ${col.borderAccent}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDarkMode ? col.accentDark : col.accentLight
                      }`}
                    >
                      {col.label}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        isDarkMode
                          ? `${col.countBgDark} ${col.countTextDark}`
                          : `${col.countBg} ${col.countText}`
                      }`}
                    >
                      {items.length}
                    </span>
                  </div>
                </div>
                {/* Total funding */}
                {total > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign
                      className={`w-3 h-3 ${
                        isDarkMode ? "text-slate-500" : "text-slate-400"
                      }`}
                    />
                    <span
                      className={`text-[9px] font-semibold ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {formatCurrencyCompact(total)}
                    </span>
                  </div>
                )}
              </div>

              {/* Card list */}
              <div
                className={`p-2 space-y-1.5 overflow-y-auto ${
                  col.key === "unapplied" ? "max-h-[400px]" : "max-h-[300px]"
                }`}
              >
                {items.length === 0 ? (
                  <div
                    className={`text-center py-6 px-2 rounded-xl border border-dashed ${
                      isDarkMode
                        ? "border-slate-700 text-slate-600"
                        : "border-slate-200 text-slate-300"
                    }`}
                  >
                    <span className="text-[9px] font-medium">
                      {isDropTarget ? "Drop here" : "No grants"}
                    </span>
                  </div>
                ) : (
                  items.map((grant) => {
                    const deadline = getDeadlineText(grant.closeDate);
                    const isDragging = draggedId === grant.id;

                    return (
                      <div
                        key={grant.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, grant.id)}
                        onDragEnd={handleDragEnd}
                        className={`group rounded-lg border px-2.5 py-2 transition-all cursor-grab active:cursor-grabbing ${
                          isDarkMode
                            ? "bg-slate-800/70 border-slate-700 hover:border-slate-600 hover:bg-slate-800"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                        } ${isDragging ? "opacity-40 scale-95" : ""}`}
                      >
                        {/* Drag handle + title */}
                        <div className="flex items-start gap-1.5">
                          <GripVertical
                            className={`w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                              isDarkMode
                                ? "text-slate-600"
                                : "text-slate-300"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-[10px] font-bold leading-tight truncate ${
                                isDarkMode
                                  ? "text-slate-100"
                                  : "text-slate-800"
                              }`}
                              title={grant.title}
                            >
                              {truncate(grant.title, 45)}
                            </p>
                          </div>
                        </div>

                        {/* Metadata row */}
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {/* Agency */}
                          <div className="flex items-center gap-0.5 min-w-0">
                            <Building2
                              className={`w-2.5 h-2.5 shrink-0 ${
                                isDarkMode
                                  ? "text-slate-500"
                                  : "text-slate-400"
                              }`}
                            />
                            <span
                              className={`text-[8px] font-medium truncate max-w-[80px] ${
                                isDarkMode
                                  ? "text-slate-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {truncate(grant.agency, 20)}
                            </span>
                          </div>

                          {/* Amount */}
                          <span
                            className={`text-[8px] font-semibold ${
                              grant.amount != null
                                ? isDarkMode
                                  ? "text-slate-300"
                                  : "text-slate-600"
                                : isDarkMode
                                ? "text-slate-600"
                                : "text-slate-300"
                            }`}
                          >
                            {formatCurrency(grant.amount)}
                          </span>

                          {/* Deadline */}
                          {deadline && (
                            <div className="flex items-center gap-0.5">
                              <CalendarClock
                                className={`w-2.5 h-2.5 ${
                                  isDarkMode
                                    ? "text-slate-500"
                                    : "text-slate-400"
                                }`}
                              />
                              <span
                                className={`text-[8px] font-medium whitespace-nowrap ${
                                  deadline === "Closed" || deadline === "Due today"
                                    ? isDarkMode
                                      ? "text-red-400"
                                      : "text-red-500"
                                    : isDarkMode
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              >
                                {deadline}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
