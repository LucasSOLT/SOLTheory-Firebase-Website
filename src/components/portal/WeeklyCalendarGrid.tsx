"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useDarkMode } from "@/lib/useDarkMode";
import { getAuthHeaders } from "@/lib/api-auth-client";

/* ─────────────────────────────────────────────────────────────
   WeeklyCalendarGrid
   ────────────────────────────────────────────────────────────
   7-day calendar (Sun–Sat) showing Google Calendar events.
   Top row: Sun Mon Tue Wed  (4 boxes)
   Bottom row: Thu Fri Sat   (3 boxes)
   ───────────────────────────────────────────────────────────── */

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;   // Tailwind bg class e.g. "bg-blue-500"
  allDay: boolean;
}

interface WeeklyCalendarGridProps {
  orgId: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── Extract a dot color from the Tailwind bg class ── */
function dotColorFromBg(bgClass: string): string {
  // bgClass is like "bg-blue-500" → extract "blue-500"
  const match = bgClass.match(/bg-(\w+-\d+)/);
  if (!match) return "bg-blue-500";
  return `bg-${match[1]}`;
}

/* ── Get the current week's Sunday 00:00 ── */
function getWeekStart(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay()); // go back to Sunday
  return d;
}

/* ── Format time from ISO string ── */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "p" : "a";
  const hour = h % 12 || 12;
  return m ? `${hour}:${m.toString().padStart(2, "0")}${ampm}` : `${hour}${ampm}`;
}

/* ── Resolve refresh token from user doc ── */
const TOKEN_KEYS = [
  "gmailOAuth_jarvis",
  "gmailOAuth_email",
  "gmailOAuth_inbound-email",
  "gmailOAuth_morpheus",
  "gmailOAuth",
];

function extractRefreshToken(data: Record<string, any>): string | null {
  for (const key of TOKEN_KEYS) {
    const rt = data?.[key]?.refreshToken;
    if (rt) return rt;
  }
  return null;
}

export default function WeeklyCalendarGrid({ orgId }: WeeklyCalendarGridProps) {
  const isDarkMode = useDarkMode();
  const { user } = useUser();
  const firestore = useFirestore();

  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Listen for refresh token on user doc ── */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
      const data = snap.data();
      if (data) setRefreshToken(extractRefreshToken(data));
    }, () => {});
    return () => unsub();
  }, [firestore, user?.uid]);

  /* ── Fetch events for the current week ── */
  useEffect(() => {
    if (!refreshToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const weekStart = getWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const headers = await getAuthHeaders();
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            refreshToken,
            timeMin: weekStart.toISOString(),
            timeMax: weekEnd.toISOString(),
          }),
        });

        if (!cancelled && res.ok) {
          const json = await res.json();
          setEvents(json.events || []);
        }
      } catch (err) {
        console.warn("[WeeklyCalendar] Failed to fetch events:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [refreshToken]);

  /* ── Group events by day-of-week (0=Sun..6=Sat) ── */
  const weekStartMs = useMemo(() => getWeekStart().getTime(), []);

  // Re-derive on every render to catch day changes, but keep
  // eventsByDay stable via the events array reference.
  const weekStart = useMemo(() => new Date(weekStartMs), [weekStartMs]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalEvent[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];

    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);

    for (const ev of events) {
      const start = new Date(ev.start);
      if (start >= weekStart && start < end) {
        map[start.getDay()].push(ev);
      }
    }
    return map;
  }, [events, weekStart]);

  /* ── Today's day index ── */
  const todayIdx = new Date().getDay();

  /* ── Week date labels ── */
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d.getDate();
    });
  }, [weekStart]);

  /* ── Not connected state ── */
  if (!loading && !refreshToken) {
    return (
      <div className="flex flex-col h-full w-full min-h-0 select-none">
        <Header isDarkMode={isDarkMode} />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <svg className={`w-8 h-8 ${isDarkMode ? "text-slate-600" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className={`text-[10px] font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Connect Google Calendar
          </p>
          <a
            href={`/api/auth/google?uid=${user?.uid || ""}&agentId=jarvis&origin=${orgId}&returnTo=calendar`}
            className="text-[9px] font-bold text-indigo-500 hover:underline"
          >
            Connect now →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 select-none">
      <Header isDarkMode={isDarkMode} />

      {/* Grid container */}
      <div className="flex-1 min-h-0 flex flex-col gap-1.5">
        {/* Top row: Sun Mon Tue Wed */}
        <div className="flex-1 grid grid-cols-4 gap-1.5 min-h-0">
          {[0, 1, 2, 3].map((dayIdx) => (
            <DayBox
              key={dayIdx}
              label={DAY_LABELS[dayIdx]}
              date={weekDates[dayIdx]}
              isToday={dayIdx === todayIdx}
              events={eventsByDay[dayIdx]}
              isDarkMode={isDarkMode}
              loading={loading}
            />
          ))}
        </div>
        {/* Bottom row: Thu Fri Sat */}
        <div className="flex-1 grid grid-cols-3 gap-1.5 min-h-0">
          {[4, 5, 6].map((dayIdx) => (
            <DayBox
              key={dayIdx}
              label={DAY_LABELS[dayIdx]}
              date={weekDates[dayIdx]}
              isToday={dayIdx === todayIdx}
              events={eventsByDay[dayIdx]}
              isDarkMode={isDarkMode}
              loading={loading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Header ── */
function Header({ isDarkMode }: { isDarkMode: boolean }) {
  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex items-center justify-between shrink-0 mb-2">
      <div className="flex items-center gap-1.5">
        <svg className={`w-3.5 h-3.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
          This Week
        </h3>
      </div>
      <span className={`text-[9px] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        {monthYear}
      </span>
    </div>
  );
}

/* ── Day Box ── */
function DayBox({
  label,
  date,
  isToday,
  events,
  isDarkMode,
  loading,
}: {
  label: string;
  date: number;
  isToday: boolean;
  events: CalEvent[];
  isDarkMode: boolean;
  loading: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-1.5 flex flex-col min-h-0 overflow-hidden ${
        isToday
          ? isDarkMode
            ? "border-indigo-500/40 bg-indigo-950/20"
            : "border-indigo-300/60 bg-indigo-50/30"
          : isDarkMode
            ? "border-slate-700/40 bg-slate-800/30"
            : "border-slate-200/60 bg-white/40"
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className={`text-[8px] font-bold uppercase tracking-wider ${
          isToday
            ? isDarkMode ? "text-indigo-400" : "text-indigo-600"
            : isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          {label}
        </span>
        {isToday ? (
          <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold tabular-nums text-white ${
            isDarkMode ? "bg-indigo-500" : "bg-indigo-600"
          }`}>
            {date}
          </span>
        ) : (
          <span className={`text-[9px] font-semibold tabular-nums ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
            {date}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className={`h-2 w-3/4 rounded-full animate-pulse ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />
        ) : events.length === 0 ? null : (
          events.slice(0, 4).map((ev) => (
            <div key={ev.id} className="flex items-start gap-1 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[3px] ${dotColorFromBg(ev.color)}`} />
              <span className={`text-[7px] leading-tight font-medium truncate ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                {!ev.allDay && <span className={`${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{formatTime(ev.start)} </span>}
                {ev.title}
              </span>
            </div>
          ))
        )}
        {!loading && events.length > 4 && (
          <span className={`text-[7px] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
            +{events.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}
