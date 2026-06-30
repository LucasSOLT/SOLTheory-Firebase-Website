"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  ChevronDown,
  Clock,
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { TimesheetEntryModal } from "./TimesheetEntryModal";
import { useDarkMode } from "@/lib/useDarkMode";
import { useTranslation } from "@/lib/i18n";

interface TimesheetUser {
  name: string;
  initials: string;
  color: string;
}

interface TimesheetGridProps {
  users: TimesheetUser[];
  firestore?: any;
  orgDomain?: string;
  userEmail?: string;
}

interface TimesheetEntry {
  id: string;
  userName: string;
  startDate: string;
  durationMinutes: number;
  billableRate: number | null;
}

type ViewMode = "week" | "month" | "custom";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateToString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateHeader(date: Date, totalCols: number): string {
  if (totalCols > 31) return `${date.getDate()}`;
  if (totalCols > 14)
    return `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRangeTitle(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

function getDayOfWeek(date: Date, totalCols: number): string {
  if (totalCols > 31) return "";
  if (totalCols > 14) return date.toLocaleDateString("en-US", { weekday: "narrow" });
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDuration(mins: number): string {
  if (mins === 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Interpolate between two RGB colors */
function lerpColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Get heatmap color from light blue to dark blue based on value relative to min/max */
function getHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(96, 165, 250)"; // blue-400 fallback
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const lightBlue: [number, number, number] = [219, 234, 254]; // #dbeafe
  const medBlue: [number, number, number] = [96, 165, 250];    // #60a5fa
  const darkBlue: [number, number, number] = [30, 64, 175];    // #1e40af

  if (t <= 0.5) {
    return lerpColor(lightBlue, medBlue, t * 2);
  } else {
    return lerpColor(medBlue, darkBlue, (t - 0.5) * 2);
  }
}

export function TimesheetGrid({ users, firestore, orgDomain, userEmail }: TimesheetGridProps) {
  const { t } = useTranslation();
  const isDarkMode = useDarkMode();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(today);
  const [customDays, setCustomDays] = useState<number>(7);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [addTimeOpen, setAddTimeOpen] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date: string; userName: string } | null>(null);

  // Prefill state for entry modal
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);
  const [prefillUser, setPrefillUser] = useState<string | undefined>(undefined);

  // Close context menu on click outside or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  // Listen to timesheet entries from Firestore
  useEffect(() => {
    if (!firestore || !orgDomain) return;
    const q = query(
      collection(firestore, "timesheet_entries"),
      where("orgDomain", "==", orgDomain)
    );
    const unsub = onSnapshot(
      q,
      (snap: any) => {
        const docs: TimesheetEntry[] = [];
        snap.forEach((d: any) => {
          const data = d.data();
          docs.push({
            id: d.id,
            userName: data.userName || "",
            startDate: data.startDate || "",
            durationMinutes: data.durationMinutes || 0,
            billableRate: data.billableRate ?? null,
          });
        });
        setEntries(docs);
      },
      (err: any) => { console.error('[Timesheet] Entries listener error:', err); }
    );
    return () => unsub();
  }, [firestore, orgDomain]);

  // Build a lookup: "userName|YYYY-MM-DD" -> { totalMinutes, totalEarnings }
  const cellData = useMemo(() => {
    const map: Record<string, { minutes: number; earnings: number }> = {};
    entries.forEach((e) => {
      const key = `${e.userName}|${e.startDate}`;
      if (!map[key]) map[key] = { minutes: 0, earnings: 0 };
      map[key].minutes += e.durationMinutes;
      if (e.billableRate && e.billableRate > 0) {
        map[key].earnings += (e.durationMinutes / 60) * e.billableRate;
      }
    });
    return map;
  }, [entries]);

  const { startDate, columnCount } = useMemo(() => {
    switch (viewMode) {
      case "week":
        return { startDate: startOfWeek(anchorDate), columnCount: 7 };
      case "month":
        return { startDate: startOfMonth(anchorDate), columnCount: daysInMonth(anchorDate) };
      case "custom":
        return { startDate: anchorDate, columnCount: Math.max(1, Math.min(100, customDays)) };
    }
  }, [viewMode, anchorDate, customDays]);

  const dates = useMemo(() => {
    return Array.from({ length: columnCount }, (_, i) => addDays(startDate, i));
  }, [startDate, columnCount]);

  const endDate = dates[dates.length - 1];

  const animateTransition = useCallback((fn: () => void) => {
    setIsTransitioning(true);
    setTimeout(() => {
      fn();
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  }, []);

  const goToday = () => animateTransition(() => setAnchorDate(today));
  const goPrev = () =>
    animateTransition(() => {
      if (viewMode === "week") setAnchorDate(addDays(anchorDate, -7));
      else if (viewMode === "month")
        setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1));
      else setAnchorDate(addDays(anchorDate, -customDays));
    });
  const goNext = () =>
    animateTransition(() => {
      if (viewMode === "week") setAnchorDate(addDays(anchorDate, 7));
      else if (viewMode === "month")
        setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1));
      else setAnchorDate(addDays(anchorDate, customDays));
    });
  const goPrevBig = () =>
    animateTransition(() => {
      setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1));
    });
  const goNextBig = () =>
    animateTransition(() => {
      setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1));
    });

  const handleViewChange = (mode: ViewMode) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode(mode);
      if (mode === "week") setAnchorDate(startOfWeek(anchorDate));
      else if (mode === "month") setAnchorDate(startOfMonth(anchorDate));
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  };

  const handleCustomDaysChange = (val: string) => {
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1 && n <= 100) setCustomDays(n);
    else if (val === "") setCustomDays(1);
  };

  // Compute summary data per user for visible date range
  const userSummaries = useMemo(() => {
    return users.map((user) => {
      let totalMins = 0;
      let totalEarnings = 0;
      dates.forEach((date) => {
        const key = `${user.name}|${dateToString(date)}`;
        const cell = cellData[key];
        if (cell) {
          totalMins += cell.minutes;
          totalEarnings += cell.earnings;
        }
      });
      const avgMins = dates.length > 0 ? Math.round(totalMins / dates.length) : 0;
      return { totalMins, totalEarnings, avgMins };
    });
  }, [users, dates, cellData]);

  // Column totals per date
  const dateTotals = useMemo(() => {
    return dates.map((date) => {
      let totalMins = 0;
      let totalEarnings = 0;
      users.forEach((user) => {
        const key = `${user.name}|${dateToString(date)}`;
        const cell = cellData[key];
        if (cell) {
          totalMins += cell.minutes;
          totalEarnings += cell.earnings;
        }
      });
      return { totalMins, totalEarnings };
    });
  }, [dates, users, cellData]);

  const grandTotal = useMemo(() => {
    return userSummaries.reduce((acc, s) => ({ mins: acc.mins + s.totalMins, earnings: acc.earnings + s.totalEarnings }), { mins: 0, earnings: 0 });
  }, [userSummaries]);

  // Heatmap: compute min/max of all cell minutes across the visible range
  const heatmapRange = useMemo(() => {
    const allMinutes: number[] = [];
    users.forEach((user) => {
      dates.forEach((date) => {
        const key = `${user.name}|${dateToString(date)}`;
        const cell = cellData[key];
        if (cell && cell.minutes > 0) {
          allMinutes.push(cell.minutes);
        }
      });
    });
    if (allMinutes.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...allMinutes), max: Math.max(...allMinutes) };
  }, [users, dates, cellData]);

  const nameColWidth = 180;
  const summaryColWidth = 100;

  return (
    <div className={`flex flex-col h-full font-sans overflow-hidden -mx-4 -mb-4 md:-mx-10 md:-mb-10 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-[#f5f1e8] text-slate-900'}`}>
      {/* Page Header */}
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className={`w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {t.timesheetTitle}
              </h1>
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.timesheetSubtitle}</p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Navigation */}
            <div className="flex items-center gap-1.5">
              <button onClick={goPrevBig} className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'}`} title={t.prevMonth}>
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button onClick={goPrev} className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'}`} title={t.prevPeriod}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext} className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'}`} title={t.nextPeriod}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={goNextBig} className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'}`} title={t.nextMonth}>
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button onClick={goToday} className={`h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ml-1 ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800'}`}>
                {t.todayLabel}
              </button>
              <div className={`ml-3 text-sm sm:text-base font-bold tracking-tight hidden sm:block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {formatRangeTitle(startDate, endDate)}
              </div>
            </div>

            {/* Add Time + View Toggles */}
            <div className="flex items-center gap-2">
              {/* Add Time Button */}
              <div className="relative">
                <button
                  onClick={() => setAddTimeOpen(!addTimeOpen)}
                  className={`h-9 px-3.5 rounded-lg border-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${isDarkMode ? 'border-green-500 bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'border-green-600 bg-[#f9fdf4] text-green-700 hover:bg-green-50'}`}
                >
                  {t.addTimeLabel}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {addTimeOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAddTimeOpen(false)} />
                    <div className={`absolute top-full right-0 mt-1 border rounded-xl shadow-xl z-40 py-1 w-56 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                      <button
                        onClick={() => { setAddTimeOpen(false); setEntryModalOpen(true); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {t.singleTimesheetActivity}
                      </button>
                      <button
                        disabled
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium cursor-not-allowed ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}
                      >
                        {t.weeklyTimesheetLabel}
                      </button>
                      <button
                        onClick={() => { setAddTimeOpen(false); setEntryModalOpen(true); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        {t.sttTimesheetEntry}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* View Mode Toggles */}
              <div className={`flex items-center gap-1 border rounded-xl p-1 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-[#fefdfb] border-slate-200'}`}>
                {(["week", "month", "custom"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleViewChange(mode)}
                    className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      viewMode === mode
                        ? isDarkMode ? "bg-slate-600 text-white shadow-sm" : "bg-slate-800 text-white shadow-sm"
                        : isDarkMode ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {mode === "week" ? t.weekLabel : mode === "month" ? t.monthLabel : t.customLabel}
                  </button>
                ))}
                {viewMode === "custom" && (
                  <div className={`flex items-center gap-1.5 ml-1 pl-2 border-l ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={customDays}
                      onChange={(e) => handleCustomDaysChange(e.target.value)}
                      className={`w-12 h-7 rounded-lg border text-center text-xs font-bold outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.daysLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Date Range */}
          <div className={`text-sm font-bold tracking-tight sm:hidden ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            {formatRangeTitle(startDate, endDate)}
          </div>
        </div>
      </div>

      {/* Timesheet Grid */}
      <div className="flex-1 overflow-auto px-4 sm:px-8 pb-8">
        <div
          className={`rounded-2xl border shadow-sm overflow-hidden transition-opacity duration-150 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          } ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#fefdfb] border-slate-200'}`}
        >
          {/* Header Row */}
          <div
            className="grid sticky top-0 z-10"
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className={`px-4 py-3 flex items-center sticky left-0 z-20 border-r ${isDarkMode ? 'bg-[#0c2137] border-[#1a3550]' : 'bg-[#1e3a5f] border-[#2a4d73]'}`}>
              <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">{t.teamMember}</span>
            </div>
            {dates.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div key={i} className={`py-2.5 px-1 flex flex-col items-center justify-center border-r ${isDarkMode ? `border-[#1a3550] ${isToday ? 'bg-[#1d4ed8]' : 'bg-[#0c2137]'}` : `border-[#2a4d73] ${isToday ? 'bg-[#2563eb]' : 'bg-[#1e3a5f]'}`}`}>
                  {columnCount <= 31 && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isWeekend ? "text-blue-300/60" : "text-blue-300/80"}`}>
                      {getDayOfWeek(date, columnCount)}
                    </span>
                  )}
                  <span className={`font-bold leading-tight ${columnCount > 31 ? "text-[9px] text-blue-100" : columnCount > 14 ? "text-[10px] text-blue-100" : "text-[11px] text-white"} ${isWeekend && !isToday ? "opacity-60" : ""}`}>
                    {formatDateHeader(date, columnCount)}
                  </span>
                </div>
              );
            })}
            <div className={`px-2 py-2.5 flex items-center justify-center border-r ${isDarkMode ? 'bg-[#0c2137] border-[#1a3550]' : 'bg-[#1e3a5f] border-[#2a4d73]'}`}>
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">{t.averageLabel}</span>
            </div>
            <div className={`px-2 py-2.5 flex items-center justify-center ${isDarkMode ? 'bg-[#0c2137]' : 'bg-[#1e3a5f]'}`}>
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">{t.totalLabel}</span>
            </div>
          </div>

          {/* User Rows */}
          {users.map((user, rowIdx) => {
            const summary = userSummaries[rowIdx];
            return (
              <div
                key={user.name}
                className={`grid border-t group ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}
                style={{
                  gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
                  transition: "grid-template-columns 300ms ease",
                }}
              >
                <div className={`px-4 py-3 flex items-center gap-3 sticky left-0 z-10 border-r ${isDarkMode ? `border-slate-700 ${rowIdx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/80'}` : `border-slate-100 ${rowIdx % 2 === 0 ? 'bg-[#fefdfb]' : 'bg-[#faf9f5]'}`}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm" style={{ backgroundColor: user.color }}>
                    {user.initials}
                  </div>
                  <span className={`text-[13px] font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{user.name}</span>
                </div>
                {dates.map((date, colIdx) => {
                  const isToday = isSameDay(date, today);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const key = `${user.name}|${dateToString(date)}`;
                  const cell = cellData[key];
                  const hasData = cell && cell.minutes > 0;
                  const cellBgColor = hasData
                    ? getHeatmapColor(cell.minutes, heatmapRange.min, heatmapRange.max)
                    : undefined;
                  const cellDateStr = dateToString(date);
                  return (
                    <div
                      key={colIdx}
                      className={`py-2 px-1 flex flex-col items-center justify-center border-r transition-colors duration-150 cursor-pointer ${
                        isDarkMode ? 'border-slate-700' : 'border-slate-100'
                      } ${
                        !hasData
                          ? isToday
                            ? isDarkMode ? "bg-blue-900/30 hover:bg-blue-900/50" : "bg-blue-50/40 hover:bg-blue-100/40"
                            : isWeekend
                              ? isDarkMode
                                ? rowIdx % 2 === 0 ? "bg-slate-700/40 hover:bg-slate-700/60" : "bg-slate-700/30 hover:bg-slate-700/50"
                                : rowIdx % 2 === 0 ? "bg-[#faf8f3]/60 hover:bg-slate-100/60" : "bg-[#faf8f3]/40 hover:bg-slate-100/40"
                              : isDarkMode
                                ? rowIdx % 2 === 0 ? "bg-slate-800 hover:bg-blue-900/30" : "bg-slate-800/80 hover:bg-blue-900/20"
                                : rowIdx % 2 === 0 ? "bg-[#fefdfb] hover:bg-blue-50/40" : "bg-[#faf9f5] hover:bg-blue-50/30"
                          : ""
                      }`}
                      style={hasData ? { backgroundColor: cellBgColor } : undefined}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, date: cellDateStr, userName: user.name });
                      }}
                      onDoubleClick={() => {
                        setPrefillDate(cellDateStr);
                        setPrefillUser(user.name);
                        setEntryModalOpen(true);
                      }}
                    >
                      {hasData ? (
                        <>
                          <span className={`text-[11px] font-semibold leading-tight ${heatmapRange.max > 0 && cell.minutes > (heatmapRange.min + heatmapRange.max) / 2 ? "text-white" : isDarkMode ? "text-slate-200" : "text-slate-800"}`}>{formatDuration(cell.minutes)}</span>
                          {cell.earnings > 0 && (
                            <span className={`text-[9px] font-semibold leading-tight ${heatmapRange.max > 0 && cell.minutes > (heatmapRange.min + heatmapRange.max) / 2 ? "text-blue-100" : "text-green-600"}`}>{formatMoney(cell.earnings)}</span>
                          )}
                        </>
                      ) : (
                        <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>-</span>
                      )}
                    </div>
                  );
                })}
                {/* Average */}
                <div className={`py-2 px-2 flex flex-col items-center justify-center border-r ${isDarkMode ? `border-slate-700 ${rowIdx % 2 === 0 ? 'bg-slate-700/50' : 'bg-slate-700/30'}` : `border-slate-100 ${rowIdx % 2 === 0 ? 'bg-[#faf8f3]' : 'bg-[#faf8f3]/70'}`}`}>
                  {summary.avgMins > 0 ? (
                    <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{formatDuration(summary.avgMins)}</span>
                  ) : (
                    <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
                  )}
                </div>
                {/* Total */}
                <div className={`py-2 px-2 flex flex-col items-center justify-center ${isDarkMode ? (rowIdx % 2 === 0 ? 'bg-slate-700/50' : 'bg-slate-700/30') : (rowIdx % 2 === 0 ? 'bg-[#faf8f3]' : 'bg-[#faf8f3]/70')}`}>
                  {summary.totalMins > 0 ? (
                    <>
                      <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{formatDuration(summary.totalMins)}</span>
                      {summary.totalEarnings > 0 && (
                        <span className="text-[9px] text-green-600 font-semibold">{formatMoney(summary.totalEarnings)}</span>
                      )}
                    </>
                  ) : (
                    <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Average Summary Row */}
          <div
            className={`grid border-t-2 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className={`px-4 py-3 flex items-center sticky left-0 z-10 border-r ${isDarkMode ? 'bg-slate-700/60 border-slate-600' : 'bg-[#f5f0e8] border-slate-200'}`}>
              <span className={`text-[12px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.averageLabel}</span>
            </div>
            {dateTotals.map((dt, i) => (
              <div key={i} className={`py-3 px-1 flex items-center justify-center border-r ${isDarkMode ? 'bg-slate-700/60 border-slate-600' : 'bg-[#f5f0e8] border-slate-200'}`}>
                {dt.totalMins > 0 && users.length > 0 ? (
                  <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{formatDuration(Math.round(dt.totalMins / users.length))}</span>
                ) : (
                  <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
                )}
              </div>
            ))}
            <div className={`py-3 px-2 flex items-center justify-center border-r ${isDarkMode ? 'bg-slate-700/40 border-slate-600' : 'bg-[#f0eadc] border-slate-200'}`}>
              <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
            </div>
            <div className={`py-3 px-2 flex items-center justify-center ${isDarkMode ? 'bg-slate-700/40' : 'bg-[#f0eadc]'}`}>
              <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
            </div>
          </div>

          {/* Total Summary Row */}
          <div
            className={`grid border-t ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className={`px-4 py-3 flex items-center sticky left-0 z-10 border-r ${isDarkMode ? 'bg-slate-700/80 border-slate-600' : 'bg-[#eee8d9] border-slate-200'}`}>
              <span className={`text-[12px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.totalLabel}</span>
            </div>
            {dateTotals.map((dt, i) => (
              <div key={i} className={`py-2 px-1 flex flex-col items-center justify-center border-r ${isDarkMode ? 'bg-slate-700/80 border-slate-600' : 'bg-[#eee8d9] border-slate-200'}`}>
                {dt.totalMins > 0 ? (
                  <>
                    <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{formatDuration(dt.totalMins)}</span>
                    {dt.totalEarnings > 0 && (
                      <span className="text-[9px] text-green-600 font-semibold">{formatMoney(dt.totalEarnings)}</span>
                    )}
                  </>
                ) : (
                  <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
                )}
              </div>
            ))}
            <div className={`py-3 px-2 flex items-center justify-center border-r ${isDarkMode ? 'bg-slate-600/60 border-slate-600' : 'bg-[#e8e1d0] border-slate-200'}`}>
              <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-</span>
            </div>
            <div className={`py-2 px-2 flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-600/60' : 'bg-[#e8e1d0]'}`}>
              {grandTotal.mins > 0 ? (
                <>
                  <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>{formatDuration(grandTotal.mins)}</span>
                  {grandTotal.earnings > 0 && (
                    <span className="text-[9px] text-green-600 font-semibold">{formatMoney(grandTotal.earnings)}</span>
                  )}
                </>
              ) : (
                <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {firestore && orgDomain && userEmail && (
        <TimesheetEntryModal
          isOpen={entryModalOpen}
          onClose={() => { setEntryModalOpen(false); setPrefillDate(undefined); setPrefillUser(undefined); }}
          firestore={firestore}
          orgDomain={orgDomain}
          userEmail={userEmail}
          users={users}
          onSaved={() => {}}
          prefillDate={prefillDate}
          prefillUser={prefillUser}
        />
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setContextMenu(null)} />
          <div
            className={`fixed z-[70] border rounded-xl shadow-xl py-1 w-56 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.addTimeFor} {contextMenu.userName}</p>
              <p className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{contextMenu.date}</p>
            </div>
            <button
              onClick={() => {
                setPrefillDate(contextMenu.date);
                setPrefillUser(contextMenu.userName);
                setEntryModalOpen(true);
                setContextMenu(null);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {t.singleTimesheetActivity}
            </button>
            <button
              disabled
              className={`w-full text-left px-4 py-2.5 text-sm font-medium cursor-not-allowed ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}
            >
              {t.weeklyTimesheetLabel}
            </button>
            <button
              onClick={() => {
                setPrefillDate(contextMenu.date);
                setPrefillUser(contextMenu.userName);
                setEntryModalOpen(true);
                setContextMenu(null);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {t.sttTimesheetEntry}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
