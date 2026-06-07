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

export function TimesheetGrid({ users, firestore, orgDomain, userEmail }: TimesheetGridProps) {
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
      () => {}
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

  const nameColWidth = 180;
  const summaryColWidth = 100;

  return (
    <div className="flex flex-col h-full bg-[#faf6ed] text-slate-900 font-sans overflow-hidden">
      {/* Page Header */}
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-5 h-5 text-slate-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Timesheets
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">Track team hours and attendance</p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Navigation */}
            <div className="flex items-center gap-1.5">
              <button onClick={goPrevBig} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors" title="Previous month">
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button onClick={goPrev} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors" title="Previous period">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors" title="Next period">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={goNextBig} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors" title="Next month">
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button onClick={goToday} className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors ml-1">
                Today
              </button>
              <div className="ml-3 text-sm sm:text-base font-bold text-slate-800 tracking-tight hidden sm:block">
                {formatRangeTitle(startDate, endDate)}
              </div>
            </div>

            {/* Add Time + View Toggles */}
            <div className="flex items-center gap-2">
              {/* Add Time Button */}
              <div className="relative">
                <button
                  onClick={() => setAddTimeOpen(!addTimeOpen)}
                  className="h-9 px-3.5 rounded-lg border-2 border-green-600 bg-[#f9fdf4] text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors flex items-center gap-1.5"
                >
                  Add time
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {addTimeOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAddTimeOpen(false)} />
                    <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 w-56 overflow-hidden">
                      <button
                        onClick={() => { setAddTimeOpen(false); setEntryModalOpen(true); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Single Timesheet Activity
                      </button>
                      <button
                        disabled
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 font-medium cursor-not-allowed"
                      >
                        Weekly Timesheet
                      </button>
                      <button
                        onClick={() => { setAddTimeOpen(false); setEntryModalOpen(true); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        STT Timesheet Entry
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* View Mode Toggles */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                {(["week", "month", "custom"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleViewChange(mode)}
                    className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      viewMode === mode
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {mode === "week" ? "Week" : mode === "month" ? "Month" : "Custom"}
                  </button>
                ))}
                {viewMode === "custom" && (
                  <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={customDays}
                      onChange={(e) => handleCustomDaysChange(e.target.value)}
                      className="w-12 h-7 rounded-lg border border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                    />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">days</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Date Range */}
          <div className="text-sm font-bold text-slate-800 tracking-tight sm:hidden">
            {formatRangeTitle(startDate, endDate)}
          </div>
        </div>
      </div>

      {/* Timesheet Grid */}
      <div className="flex-1 overflow-auto px-4 sm:px-8 pb-8">
        <div
          className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-opacity duration-150 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Header Row */}
          <div
            className="grid sticky top-0 z-10"
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className="bg-[#1e3a5f] px-4 py-3 flex items-center sticky left-0 z-20 border-r border-[#2a4d73]">
              <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">Team Member</span>
            </div>
            {dates.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div key={i} className={`py-2.5 px-1 flex flex-col items-center justify-center border-r border-[#2a4d73] ${isToday ? "bg-[#2563eb]" : "bg-[#1e3a5f]"}`}>
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
            <div className="bg-[#1e3a5f] px-2 py-2.5 flex items-center justify-center border-r border-[#2a4d73]">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">Average</span>
            </div>
            <div className="bg-[#1e3a5f] px-2 py-2.5 flex items-center justify-center">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">Total</span>
            </div>
          </div>

          {/* User Rows */}
          {users.map((user, rowIdx) => {
            const summary = userSummaries[rowIdx];
            return (
              <div
                key={user.name}
                className="grid border-t border-slate-100 group"
                style={{
                  gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
                  transition: "grid-template-columns 300ms ease",
                }}
              >
                <div className={`px-4 py-3 flex items-center gap-3 sticky left-0 z-10 border-r border-slate-100 ${rowIdx % 2 === 0 ? "bg-white" : "bg-[#faf9f5]"}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm" style={{ backgroundColor: user.color }}>
                    {user.initials}
                  </div>
                  <span className="text-[13px] font-semibold text-slate-800 truncate">{user.name}</span>
                </div>
                {dates.map((date, colIdx) => {
                  const isToday = isSameDay(date, today);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const key = `${user.name}|${dateToString(date)}`;
                  const cell = cellData[key];
                  const hasData = cell && cell.minutes > 0;
                  return (
                    <div
                      key={colIdx}
                      className={`py-2 px-1 flex flex-col items-center justify-center border-r border-slate-100 transition-colors duration-150 cursor-pointer ${
                        hasData
                          ? "bg-blue-50/80 hover:bg-blue-100/80"
                          : isToday
                            ? "bg-blue-50/40 hover:bg-blue-100/40"
                            : isWeekend
                              ? rowIdx % 2 === 0
                                ? "bg-slate-50/60 hover:bg-slate-100/60"
                                : "bg-slate-50/40 hover:bg-slate-100/40"
                              : rowIdx % 2 === 0
                                ? "bg-white hover:bg-blue-50/40"
                                : "bg-[#faf9f5] hover:bg-blue-50/30"
                      }`}
                    >
                      {hasData ? (
                        <>
                          <span className="text-[11px] font-semibold text-slate-700 leading-tight">{formatDuration(cell.minutes)}</span>
                          {cell.earnings > 0 && (
                            <span className="text-[9px] font-semibold text-green-600 leading-tight">{formatMoney(cell.earnings)}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-300 font-medium">-</span>
                      )}
                    </div>
                  );
                })}
                {/* Average */}
                <div className={`py-2 px-2 flex flex-col items-center justify-center border-r border-slate-100 ${rowIdx % 2 === 0 ? "bg-slate-50" : "bg-slate-50/70"}`}>
                  {summary.avgMins > 0 ? (
                    <span className="text-[11px] text-slate-600 font-semibold">{formatDuration(summary.avgMins)}</span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-semibold">-</span>
                  )}
                </div>
                {/* Total */}
                <div className={`py-2 px-2 flex flex-col items-center justify-center ${rowIdx % 2 === 0 ? "bg-slate-50" : "bg-slate-50/70"}`}>
                  {summary.totalMins > 0 ? (
                    <>
                      <span className="text-[11px] text-slate-700 font-bold">{formatDuration(summary.totalMins)}</span>
                      {summary.totalEarnings > 0 && (
                        <span className="text-[9px] text-green-600 font-semibold">{formatMoney(summary.totalEarnings)}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-bold">-</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Average Summary Row */}
          <div
            className="grid border-t-2 border-slate-200"
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className="px-4 py-3 flex items-center sticky left-0 z-10 bg-[#f5f0e8] border-r border-slate-200">
              <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Average</span>
            </div>
            {dateTotals.map((dt, i) => (
              <div key={i} className="py-3 px-1 flex items-center justify-center bg-[#f5f0e8] border-r border-slate-200">
                {dt.totalMins > 0 && users.length > 0 ? (
                  <span className="text-[11px] text-slate-500 font-semibold">{formatDuration(Math.round(dt.totalMins / users.length))}</span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-semibold">-</span>
                )}
              </div>
            ))}
            <div className="py-3 px-2 flex items-center justify-center bg-[#f0eadc] border-r border-slate-200">
              <span className="text-[11px] text-slate-400 font-bold">-</span>
            </div>
            <div className="py-3 px-2 flex items-center justify-center bg-[#f0eadc]">
              <span className="text-[11px] text-slate-400 font-bold">-</span>
            </div>
          </div>

          {/* Total Summary Row */}
          <div
            className="grid border-t border-slate-200"
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className="px-4 py-3 flex items-center sticky left-0 z-10 bg-[#eee8d9] border-r border-slate-200">
              <span className="text-[12px] font-bold text-slate-600 uppercase tracking-wide">Total</span>
            </div>
            {dateTotals.map((dt, i) => (
              <div key={i} className="py-2 px-1 flex flex-col items-center justify-center bg-[#eee8d9] border-r border-slate-200">
                {dt.totalMins > 0 ? (
                  <>
                    <span className="text-[11px] text-slate-600 font-bold">{formatDuration(dt.totalMins)}</span>
                    {dt.totalEarnings > 0 && (
                      <span className="text-[9px] text-green-600 font-semibold">{formatMoney(dt.totalEarnings)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 font-bold">-</span>
                )}
              </div>
            ))}
            <div className="py-3 px-2 flex items-center justify-center bg-[#e8e1d0] border-r border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold">-</span>
            </div>
            <div className="py-2 px-2 flex flex-col items-center justify-center bg-[#e8e1d0]">
              {grandTotal.mins > 0 ? (
                <>
                  <span className="text-[11px] text-slate-700 font-bold">{formatDuration(grandTotal.mins)}</span>
                  {grandTotal.earnings > 0 && (
                    <span className="text-[9px] text-green-600 font-semibold">{formatMoney(grandTotal.earnings)}</span>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-slate-500 font-bold">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {firestore && orgDomain && userEmail && (
        <TimesheetEntryModal
          isOpen={entryModalOpen}
          onClose={() => setEntryModalOpen(false)}
          firestore={firestore}
          orgDomain={orgDomain}
          userEmail={userEmail}
          users={users}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
