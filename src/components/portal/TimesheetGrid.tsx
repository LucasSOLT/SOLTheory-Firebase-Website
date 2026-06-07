"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
} from "lucide-react";

interface TimesheetUser {
  name: string;
  initials: string;
  color: string;
}

interface TimesheetGridProps {
  users: TimesheetUser[];
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

function formatDateHeader(date: Date, totalCols: number): string {
  if (totalCols > 31) return `${date.getDate()}`;
  if (totalCols > 14)
    return `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRangeTitle(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

function getDayOfWeek(date: Date, totalCols: number): string {
  if (totalCols > 31) return "";
  if (totalCols > 14) return date.toLocaleDateString("en-US", { weekday: "narrow" });
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function TimesheetGrid({ users }: TimesheetGridProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(today);
  const [customDays, setCustomDays] = useState<number>(7);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { startDate, columnCount } = useMemo(() => {
    switch (viewMode) {
      case "week":
        return { startDate: startOfWeek(anchorDate), columnCount: 7 };
      case "month":
        return {
          startDate: startOfMonth(anchorDate),
          columnCount: daysInMonth(anchorDate),
        };
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

  // Column width calculation
  const nameColWidth = 180;
  const summaryColWidth = 90;

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
            <p className="text-sm text-slate-500 font-medium">
              Track team hours and attendance
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrevBig}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                title="Previous month"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goPrev}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goNext}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={goNextBig}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                title="Next month"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors ml-1"
              >
                Today
              </button>

              {/* Date Range Display */}
              <div className="ml-3 text-sm sm:text-base font-bold text-slate-800 tracking-tight hidden sm:block">
                {formatRangeTitle(startDate, endDate)}
              </div>
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
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    days
                  </span>
                </div>
              )}
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
            {/* Name Header */}
            <div className="bg-[#1e3a5f] px-4 py-3 flex items-center sticky left-0 z-20 border-r border-[#2a4d73]">
              <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                Team Member
              </span>
            </div>
            {/* Date Headers */}
            {dates.map((date, i) => {
              const isToday = isSameDay(date, today);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div
                  key={i}
                  className={`py-2.5 px-1 flex flex-col items-center justify-center border-r border-[#2a4d73] ${
                    isToday ? "bg-[#2563eb]" : "bg-[#1e3a5f]"
                  }`}
                >
                  {columnCount <= 31 && (
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${
                        isWeekend ? "text-blue-300/60" : "text-blue-300/80"
                      }`}
                    >
                      {getDayOfWeek(date, columnCount)}
                    </span>
                  )}
                  <span
                    className={`font-bold leading-tight ${
                      columnCount > 31
                        ? "text-[9px] text-blue-100"
                        : columnCount > 14
                          ? "text-[10px] text-blue-100"
                          : "text-[11px] text-white"
                    } ${isWeekend && !isToday ? "opacity-60" : ""}`}
                  >
                    {formatDateHeader(date, columnCount)}
                  </span>
                </div>
              );
            })}
            {/* Summary Headers */}
            <div className="bg-[#1e3a5f] px-2 py-2.5 flex items-center justify-center border-r border-[#2a4d73]">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                Average
              </span>
            </div>
            <div className="bg-[#1e3a5f] px-2 py-2.5 flex items-center justify-center">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                Total
              </span>
            </div>
          </div>

          {/* User Rows */}
          {users.map((user, rowIdx) => (
            <div
              key={user.name}
              className="grid border-t border-slate-100 group"
              style={{
                gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
                transition: "grid-template-columns 300ms ease",
              }}
            >
              {/* User Name Cell */}
              <div
                className={`px-4 py-3 flex items-center gap-3 sticky left-0 z-10 border-r border-slate-100 ${
                  rowIdx % 2 === 0 ? "bg-white" : "bg-[#faf9f5]"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: user.color }}
                >
                  {user.initials}
                </div>
                <span className="text-[13px] font-semibold text-slate-800 truncate">
                  {user.name}
                </span>
              </div>
              {/* Date Cells */}
              {dates.map((date, colIdx) => {
                const isToday = isSameDay(date, today);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={colIdx}
                    className={`py-3 px-1 flex items-center justify-center border-r border-slate-100 transition-colors duration-150 cursor-pointer ${
                      isToday
                        ? "bg-blue-50/60 hover:bg-blue-100/60"
                        : isWeekend
                          ? rowIdx % 2 === 0
                            ? "bg-slate-50/60 hover:bg-slate-100/60"
                            : "bg-slate-50/40 hover:bg-slate-100/40"
                          : rowIdx % 2 === 0
                            ? "bg-white hover:bg-blue-50/40"
                            : "bg-[#faf9f5] hover:bg-blue-50/30"
                    }`}
                  >
                    <span className="text-[11px] text-slate-300 font-medium">-</span>
                  </div>
                );
              })}
              {/* Average Cell */}
              <div
                className={`py-3 px-2 flex items-center justify-center border-r border-slate-100 ${
                  rowIdx % 2 === 0 ? "bg-slate-50" : "bg-slate-50/70"
                }`}
              >
                <span className="text-[11px] text-slate-400 font-semibold">-</span>
              </div>
              {/* Total Cell */}
              <div
                className={`py-3 px-2 flex items-center justify-center ${
                  rowIdx % 2 === 0 ? "bg-slate-50" : "bg-slate-50/70"
                }`}
              >
                <span className="text-[11px] text-slate-400 font-bold">-</span>
              </div>
            </div>
          ))}

          {/* Average Summary Row */}
          <div
            className="grid border-t-2 border-slate-200"
            style={{
              gridTemplateColumns: `${nameColWidth}px repeat(${columnCount}, 1fr) ${summaryColWidth}px ${summaryColWidth}px`,
              transition: "grid-template-columns 300ms ease",
            }}
          >
            <div className="px-4 py-3 flex items-center sticky left-0 z-10 bg-[#f5f0e8] border-r border-slate-200">
              <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                Average
              </span>
            </div>
            {dates.map((_, i) => (
              <div
                key={i}
                className="py-3 px-1 flex items-center justify-center bg-[#f5f0e8] border-r border-slate-200"
              >
                <span className="text-[11px] text-slate-400 font-semibold">-</span>
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
              <span className="text-[12px] font-bold text-slate-600 uppercase tracking-wide">
                Total
              </span>
            </div>
            {dates.map((_, i) => (
              <div
                key={i}
                className="py-3 px-1 flex items-center justify-center bg-[#eee8d9] border-r border-slate-200"
              >
                <span className="text-[11px] text-slate-400 font-bold">-</span>
              </div>
            ))}
            <div className="py-3 px-2 flex items-center justify-center bg-[#e8e1d0] border-r border-slate-200">
              <span className="text-[11px] text-slate-500 font-bold">-</span>
            </div>
            <div className="py-3 px-2 flex items-center justify-center bg-[#e8e1d0]">
              <span className="text-[11px] text-slate-500 font-bold">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
