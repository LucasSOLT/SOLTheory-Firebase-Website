"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Calendar, CalendarDays,
  Grid3X3, Maximize2, Clock, X, Mail, Smartphone, Users,
} from "lucide-react";

/* ════════════════════════════ TYPES ════════════════════════════ */

type CalendarViewMode = "day" | "month" | "year" | "custom";

interface CampaignEvent {
  id: string;
  title: string;
  date: Date;          // day the event falls on
  time: string;        // e.g. "9:30 AM"
  type: "email" | "sms" | "both";
  contacts: string[];  // full names
  description: string;
}

/* ════════════════════════════ MOCK DATA ════════════════════════════ */

const MOCK_EVENTS: CampaignEvent[] = [
  {
    id: "evt-1",
    title: "Summer Product Launch",
    date: new Date(2026, 5, 15, 9, 30),   // June 15, 2026
    time: "9:30 AM",
    type: "both",
    contacts: ["Steve Huff", "Gerard Jardin", "Steven Wright"],
    description: "Announce the new summer product line to VIP contacts. Includes email blast with product imagery and follow-up SMS reminder 2 hours later.",
  },
  {
    id: "evt-2",
    title: "Q3 Newsletter",
    date: new Date(2026, 6, 1, 2, 0),     // July 1, 2026
    time: "2:00 PM",
    type: "email",
    contacts: ["Gerard Jardin", "Steve Huff", "Steven Wright"],
    description: "Quarterly newsletter with company updates, customer success stories, and upcoming webinar invitations.",
  },
];

/* ════════════════════════════ CONSTANTS ════════════════════════════ */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return `${h}:00 ${ampm}`;
});

const VIEW_MODES: { id: CalendarViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "day", label: "Day", icon: Calendar },
  { id: "month", label: "Month", icon: CalendarDays },
  { id: "year", label: "Year", icon: Maximize2 },
  { id: "custom", label: "Custom", icon: Grid3X3 },
];

const STORAGE_KEY = "campaign-calendar-last-view";

/* ════════════════════════════ HELPERS ════════════════════════════ */

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function formatDateRange(s: Date, e: Date): string {
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear())
    return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function eventsOnDay(day: Date) {
  return MOCK_EVENTS.filter((ev) => isSameDay(ev.date, day));
}
function eventsInMonth(y: number, m: number) {
  return MOCK_EVENTS.filter((ev) => ev.date.getFullYear() === y && ev.date.getMonth() === m);
}

function contactSummary(contacts: string[]) {
  if (contacts.length === 0) return "";
  if (contacts.length === 1) return contacts[0];
  return `${contacts[0]} & ${contacts.length - 1} other${contacts.length - 1 > 1 ? "s" : ""}`;
}

function typeLabel(t: CampaignEvent["type"]) {
  if (t === "email") return "Email";
  if (t === "sms") return "SMS";
  return "Email + SMS";
}

function typeColor(t: CampaignEvent["type"]) {
  if (t === "email") return "bg-blue-500";
  if (t === "sms") return "bg-emerald-500";
  return "bg-violet-500";
}

function typeBadgeBg(t: CampaignEvent["type"]) {
  if (t === "email") return "bg-blue-50 text-blue-700 border-blue-200";
  if (t === "sms") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-violet-50 text-violet-700 border-violet-200";
}

/* ════════════════════════════ EVENT BUBBLE ════════════════════════════ */

function EventBubble({ event, compact, onOpen }: { event: CampaignEvent; compact?: boolean; onOpen: (e: CampaignEvent) => void }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const dotColor = typeColor(event.type);

  return (
    <div ref={ref} className="relative">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => { e.stopPropagation(); onOpen(event); }}
        className={`w-full text-left rounded-md transition-all cursor-pointer group
          ${compact
            ? "px-1.5 py-0.5 flex items-center gap-1.5"
            : "px-2.5 py-1.5 flex items-center gap-2 hover:shadow-sm"
          }
          bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300
        `}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className={`truncate font-medium text-slate-700 ${compact ? "text-[10px]" : "text-xs"}`}>
          {compact ? event.title.slice(0, 14) + (event.title.length > 14 ? "…" : "") : event.title}
        </span>
        {!compact && (
          <span className="text-[10px] text-slate-400 ml-auto shrink-0">{event.time}</span>
        )}
      </button>

      {/* ── Hover Tooltip ── */}
      {showTooltip && (
        <div className="absolute z-[200] bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 pointer-events-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-4 space-y-3">
            {/* Title + type badge */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-800 leading-tight">{event.title}</h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${typeBadgeBg(event.type)}`}>
                {typeLabel(event.type)}
              </span>
            </div>
            {/* Time */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at <strong className="text-slate-700">{event.time}</strong></span>
            </div>
            {/* Channel */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {event.type === "sms" ? <Smartphone className="w-3 h-3 text-slate-400" /> : event.type === "email" ? <Mail className="w-3 h-3 text-slate-400" /> : <><Mail className="w-3 h-3 text-slate-400" /><span className="text-slate-300">/</span><Smartphone className="w-3 h-3 text-slate-400" /></>}
              <span>Delivery: <strong className="text-slate-700">{typeLabel(event.type)}</strong></span>
            </div>
            {/* Contacts */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="text-slate-700 font-medium">{contactSummary(event.contacts)}</span>
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-3 h-3 bg-white border-b border-r border-slate-200 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CAMPAIGN CALENDAR COMPONENT
   ══════════════════════════════════════════════════════════════════════ */

export default function CampaignCalendar() {
  const today = useMemo(() => new Date(), []);

  /* ─── Persisted view mode ─── */
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && ["day", "month", "year", "custom"].includes(saved)) return saved as CalendarViewMode;
    }
    return "year";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Custom range
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ start: Date; end: Date } | null>(null);

  // Event detail modal
  const [openEvent, setOpenEvent] = useState<CampaignEvent | null>(null);

  /* ─── Navigation ─── */
  const navigateBack = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "day") d.setDate(d.getDate() - 1);
      else if (viewMode === "month") d.setMonth(d.getMonth() - 1);
      else if (viewMode === "year") d.setFullYear(d.getFullYear() - 1);
      return d;
    });
  }, [viewMode]);

  const navigateForward = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "day") d.setDate(d.getDate() + 1);
      else if (viewMode === "month") d.setMonth(d.getMonth() + 1);
      else if (viewMode === "year") d.setFullYear(d.getFullYear() + 1);
      return d;
    });
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }, []);

  /* ─── Header title ─── */
  const headerTitle = useMemo(() => {
    switch (viewMode) {
      case "day":
        return `${WEEKDAYS[currentDate.getDay()]}, ${MONTHS[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
      case "month":
        return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      case "year":
        return `${currentDate.getFullYear()}`;
      case "custom":
        return appliedRange ? formatDateRange(appliedRange.start, appliedRange.end) : "Select a Date Range";
    }
  }, [viewMode, currentDate, appliedRange]);

  const currentHour = today.getHours();

  /* ══════════════════════ DAY VIEW ══════════════════════ */
  function renderDayView() {
    const dayEvents = eventsOnDay(currentDate);

    return (
      <div className="relative">
        {HOURS.map((label, i) => {
          // Events that start at this hour
          const hourEvents = dayEvents.filter((ev) => ev.date.getHours() === i);
          const isCurrentHourToday = i === currentHour && isSameDay(currentDate, today);

          return (
            <div key={i} className="flex group">
              <div className="w-20 shrink-0 pr-3 pt-0 text-right">
                <span className="text-[11px] font-medium text-slate-400 -translate-y-2 block">{label}</span>
              </div>
              <div
                className={`flex-1 h-16 border-t border-slate-100 relative transition-colors px-2
                  ${isCurrentHourToday ? "bg-indigo-50/50" : "hover:bg-slate-50/70"}`}
              >
                {isCurrentHourToday && (
                  <div className="absolute left-0 right-0 top-0 z-10">
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shadow-sm shadow-red-500/30" />
                      <div className="flex-1 h-[2px] bg-red-500/70" />
                    </div>
                  </div>
                )}
                {/* Event bubbles */}
                <div className="flex flex-col gap-1 py-1">
                  {hourEvents.map((ev) => (
                    <EventBubble key={ev.id} event={ev} onOpen={setOpenEvent} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ══════════════════════ MONTH VIEW ══════════════════════ */
  function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const trailingDays: React.ReactNode[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      trailingDays.push(
        <div key={`prev-${i}`} className="min-h-[110px] p-2 bg-slate-50/50 border-b border-r border-slate-100">
          <span className="text-sm font-medium text-slate-300">{prevMonthDays - i}</span>
        </div>
      );
    }

    const currentDays: React.ReactNode[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = isSameDay(date, today);
      const isSelected = selectedDate && isSameDay(date, selectedDate);
      const dayEvts = eventsOnDay(date);

      currentDays.push(
        <div
          key={d}
          onClick={() => { setSelectedDate(date); setCurrentDate(date); setViewMode("day"); }}
          className={`min-h-[110px] p-2 border-b border-r border-slate-100 cursor-pointer transition-all duration-150
            ${isToday ? "bg-indigo-50/60 ring-1 ring-inset ring-indigo-200" : ""}
            ${isSelected && !isToday ? "bg-violet-50/60 ring-1 ring-inset ring-violet-200" : ""}
            ${!isToday && !isSelected ? "hover:bg-slate-50/80" : ""}
          `}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-semibold inline-flex items-center justify-center
              ${isToday ? "bg-indigo-600 text-white w-7 h-7 rounded-full shadow-sm shadow-indigo-600/20"
                : isSelected ? "bg-violet-600 text-white w-7 h-7 rounded-full shadow-sm"
                : "text-slate-700"}`}
            >{d}</span>
          </div>
          <div className="space-y-1">
            {dayEvts.map((ev) => (
              <EventBubble key={ev.id} event={ev} compact onOpen={setOpenEvent} />
            ))}
          </div>
        </div>
      );
    }

    const totalCells = trailingDays.length + currentDays.length;
    const remaining = (7 - (totalCells % 7)) % 7;
    const leadingDays: React.ReactNode[] = [];
    for (let d = 1; d <= remaining; d++) {
      leadingDays.push(
        <div key={`next-${d}`} className="min-h-[110px] p-2 bg-slate-50/50 border-b border-r border-slate-100">
          <span className="text-sm font-medium text-slate-300">{d}</span>
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
          {WEEKDAYS.map((wd, i) => (
            <div key={i} className="py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-100 last:border-r-0">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {trailingDays}
          {currentDays}
          {leadingDays}
        </div>
      </div>
    );
  }

  /* ══════════════════════ YEAR VIEW ══════════════════════ */
  function renderYearView() {
    const year = currentDate.getFullYear();

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 p-2">
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const daysInMonth = getDaysInMonth(year, monthIdx);
          const firstDay = getFirstDayOfMonth(year, monthIdx);
          const monthEvts = eventsInMonth(year, monthIdx);

          const cells: React.ReactNode[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="aspect-square" />);

          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, monthIdx, d);
            const isToday = isSameDay(date, today);
            const dayEvts = eventsOnDay(date);
            const hasEvent = dayEvts.length > 0;

            cells.push(
              <button
                key={d}
                onClick={() => { setCurrentDate(new Date(year, monthIdx, d)); setViewMode("month"); }}
                className={`aspect-square flex items-center justify-center rounded-full text-[11px] font-medium transition-all cursor-pointer relative
                  ${isToday ? "bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/20"
                    : hasEvent ? "text-slate-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {d}
                {hasEvent && !isToday && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayEvts.slice(0, 2).map((ev, idx) => (
                      <span key={idx} className={`w-1 h-1 rounded-full ${typeColor(ev.type)}`} />
                    ))}
                  </span>
                )}
                {hasEvent && isToday && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayEvts.slice(0, 2).map((ev, idx) => (
                      <span key={idx} className="w-1 h-1 rounded-full bg-white/80" />
                    ))}
                  </span>
                )}
              </button>
            );
          }

          return (
            <div key={monthIdx} className="bg-white rounded-xl border border-slate-100 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              {/* Month label */}
              <button
                onClick={() => { setCurrentDate(new Date(year, monthIdx, 1)); setViewMode("month"); }}
                className="text-sm font-bold text-slate-700 mb-2.5 hover:text-indigo-600 transition-colors cursor-pointer block"
              >
                {MONTHS_SHORT[monthIdx]}
              </button>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {WEEKDAYS_SHORT.map((wd, i) => (
                  <div key={i} className="aspect-square flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase">{wd}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">{cells}</div>
              {/* Event summary under month */}
              {monthEvts.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                  {monthEvts.slice(0, 2).map((ev) => (
                    <EventBubble key={ev.id} event={ev} compact onOpen={setOpenEvent} />
                  ))}
                  {monthEvts.length > 2 && (
                    <div className="text-[10px] text-slate-400 font-medium pl-1">+{monthEvts.length - 2} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ══════════════════════ CUSTOM RANGE VIEW ══════════════════════ */
  function renderCustomView() {
    if (!appliedRange) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-5">
            <Grid3X3 className="w-7 h-7 text-indigo-500" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1.5">Custom Date Range</h3>
          <p className="text-sm text-slate-400 mb-6 text-center max-w-sm">
            Select a start and end date above, then click &ldquo;Apply&rdquo; to view your custom range.
          </p>
        </div>
      );
    }

    // Collect months spanning the range
    const months: { year: number; month: number }[] = [];
    const cursor = new Date(appliedRange.start.getFullYear(), appliedRange.start.getMonth(), 1);
    const endDate = new Date(appliedRange.end.getFullYear(), appliedRange.end.getMonth(), 1);
    while (cursor <= endDate) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (months.length === 1) return renderMonthView();

    return (
      <div className={`grid gap-5 p-2 ${months.length <= 2 ? "grid-cols-2" : months.length <= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3 lg:grid-cols-4"}`}>
        {months.map(({ year, month }) => {
          const daysInMonth = getDaysInMonth(year, month);
          const firstDay = getFirstDayOfMonth(year, month);
          const monthEvts = eventsInMonth(year, month);
          const cells: React.ReactNode[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="aspect-square" />);
          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = isSameDay(date, today);
            const dayEvts = eventsOnDay(date);
            const hasEvent = dayEvts.length > 0;
            cells.push(
              <button key={d}
                onClick={() => { setCurrentDate(date); setViewMode("month"); }}
                className={`aspect-square flex items-center justify-center rounded-full text-[11px] font-medium transition-all cursor-pointer relative
                  ${isToday ? "bg-indigo-600 text-white font-bold shadow-sm" : hasEvent ? "text-slate-700 font-bold" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {d}
                {hasEvent && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dayEvts.slice(0, 2).map((ev, idx) => <span key={idx} className={`w-1 h-1 rounded-full ${isToday ? "bg-white/80" : typeColor(ev.type)}`} />)}
                </span>}
              </button>
            );
          }
          return (
            <div key={`${year}-${month}`} className="bg-white rounded-xl border border-slate-100 p-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              <button onClick={() => { setCurrentDate(new Date(year, month, 1)); setViewMode("month"); }} className="text-sm font-bold text-slate-700 mb-2.5 hover:text-indigo-600 transition-colors cursor-pointer block">
                {MONTHS_SHORT[month]} {year}
              </button>
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {WEEKDAYS_SHORT.map((wd, i) => <div key={i} className="aspect-square flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase">{wd}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">{cells}</div>
              {monthEvts.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                  {monthEvts.slice(0, 2).map((ev) => <EventBubble key={ev.id} event={ev} compact onOpen={setOpenEvent} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* ─── Page Title ─── */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-500/20">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          Campaign Manager
        </h1>
        <p className="text-sm text-slate-400 mt-1 ml-[42px]">
          Plan and schedule your email campaigns on the calendar.
        </p>
      </div>

      {/* ─── Calendar Card ─── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button onClick={goToToday} className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm">
              Today
            </button>
            {viewMode !== "custom" && (
              <div className="flex items-center gap-1">
                <button onClick={navigateBack} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={navigateForward} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{headerTitle}</h2>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === "custom" && (
              <div className="flex items-center gap-2 mr-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" />
                <span className="text-xs text-slate-400 font-medium">to</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" />
                <button
                  onClick={() => {
                    if (customStart && customEnd) {
                      const s = new Date(customStart + "T00:00:00");
                      const e = new Date(customEnd + "T00:00:00");
                      if (s <= e) { setAppliedRange({ start: s, end: e }); setCurrentDate(s); }
                    }
                  }}
                  disabled={!customStart || !customEnd}
                  className="h-8 px-3.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
                >Apply</button>
              </div>
            )}

            {/* View mode pills */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
              {VIEW_MODES.map((mode) => {
                const isActive = viewMode === mode.id;
                return (
                  <button key={mode.id}
                    onClick={() => { setViewMode(mode.id); if (mode.id !== "custom") setAppliedRange(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer
                      ${isActive ? "bg-white text-slate-800 shadow-sm shadow-slate-200/60" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    <mode.icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-600" : ""}`} />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Calendar body ── */}
        <div className={viewMode === "day" ? "max-h-[600px] overflow-y-auto" : ""}>
          {viewMode === "day" && renderDayView()}
          {viewMode === "month" && renderMonthView()}
          {viewMode === "year" && renderYearView()}
          {viewMode === "custom" && renderCustomView()}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-[11px] font-medium text-slate-500">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-[11px] font-medium text-slate-500">Email</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-medium text-slate-500">SMS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-[11px] font-medium text-slate-500">Email + SMS</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="w-3 h-3" />
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* ══════ EVENT DETAIL MODAL ══════ */}
      {openEvent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpenEvent(null)}>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-bold text-slate-800">Campaign Event</h2>
              <button onClick={() => setOpenEvent(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Blank body — placeholder for future detail UI */}
            <div className="px-6 py-16 flex items-center justify-center">
              <p className="text-sm text-slate-400">Campaign event details coming soon.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
