"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { Clock, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { useTranslation } from '@/lib/i18n';
import { useDarkMode } from '@/lib/useDarkMode';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

/* ── helpers ── */
function formatDateStr(d: Date) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getWeeklyTimesheetDates() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 8);
  end.setHours(23, 59, 59, 999);

  return { start, end };
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
  // Light blue (blue-100) -> Medium blue (blue-400) -> Dark blue (blue-800)
  const lightBlue: [number, number, number] = [219, 234, 254]; // #dbeafe
  const medBlue: [number, number, number] = [96, 165, 250];    // #60a5fa
  const darkBlue: [number, number, number] = [30, 64, 175];    // #1e40af

  if (t <= 0.5) {
    return lerpColor(lightBlue, medBlue, t * 2);
  } else {
    return lerpColor(medBlue, darkBlue, (t - 0.5) * 2);
  }
}

type TimesheetSource = "insight" | "quickbooks";

export function WeeklyTimesheetChart() {
  const { t } = useTranslation();
  const isDarkMode = useDarkMode();
  const { user } = useUser();
  const firestore = useFirestore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qbData, setQbData] = useState<any[]>([]);
  const [insightEntries, setInsightEntries] = useState<any[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);

  // Source state with localStorage persistence, default to "insight"
  const [source, setSource] = useState<TimesheetSource>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("timesheet_source");
      if (saved === "quickbooks" || saved === "insight") return saved;
    }
    return "insight";
  });

  // Persist source changes
  useEffect(() => {
    localStorage.setItem("timesheet_source", source);
  }, [source]);

  const { start: activeStart, end: activeEnd } = useMemo(() => getWeeklyTimesheetDates(), []);
  const orgDomain = user?.email?.split("@")[1] || "";

  // Close dropdown on outside click
  useEffect(() => {
    if (!sourceOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-source-dropdown]")) setSourceOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sourceOpen]);

  // ── Fetch from INSiGHT Firestore ──
  useEffect(() => {
    if (source !== "insight" || !firestore || !orgDomain) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const q = query(
      collection(firestore, "timesheet_entries"),
      where("orgDomain", "==", orgDomain)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const entries: any[] = [];
        snap.forEach((d) => entries.push(d.data()));
        setInsightEntries(entries);
        setLoading(false);
      },
      (err) => {
        console.error("[Timesheet] INSiGHT listener error:", err);
        setError("FAILED_LOAD_TIMESHEETS");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [source, firestore, orgDomain]);

  // ── Fetch from QuickBooks API ──
  const fetchQuickBooks = useCallback(async () => {
    if (source !== "quickbooks" || !firestore || !user?.uid) return;
    setLoading(true);
    setError(null);

    try {
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      if (!userDoc.exists()) {
        setError("USER_DOC_NOT_FOUND");
        return;
      }

      const qb = userDoc.data()?.quickbooksOAuth;
      if (!qb?.refreshToken) {
        setError("QB_NOT_CONNECTED");
        return;
      }

      const res = await fetch("/api/quickbooks/data", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          realmId: qb.realmId,
          accessToken: qb.accessToken,
          refreshToken: qb.refreshToken,
          endpoint: "timesheets_range",
          startDate: formatDateStr(activeStart),
          endDate: formatDateStr(activeEnd),
        }),
      });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }

      setQbData(json.data?.QueryResponse?.TimeActivity || []);
    } catch (err: any) {
      setError(err.message || "UNEXPECTED_ERROR");
    } finally {
      setLoading(false);
    }
  }, [source, firestore, user?.uid, activeStart, activeEnd]);

  useEffect(() => {
    if (source === "quickbooks") fetchQuickBooks();
  }, [source, fetchQuickBooks]);

  // ── Build chart data from the active source ──
  const chartData = useMemo(() => {
    if (source === "insight") {
      // Aggregate INSiGHT entries by user, filtered to current week
      const startStr = formatDateStr(activeStart);
      const endStr = formatDateStr(activeEnd);
      const agg: Record<string, number> = {};

      insightEntries.forEach((entry: any) => {
        const dateStr = entry.startDate;
        if (!dateStr || dateStr < startStr || dateStr > endStr) return;
        const name = entry.userName || "Unknown";
        const hours = (entry.durationMinutes || 0) / 60;
        agg[name] = (agg[name] || 0) + hours;
      });

      return Object.entries(agg)
        .map(([name, hours]) => ({
          name,
          hours: parseFloat(hours.toFixed(2)),
        }))
        .sort((a, b) => b.hours - a.hours);
    } else {
      // Aggregate QB data by user
      const agg: Record<string, number> = {};
      qbData.forEach((ta: any) => {
        const name = ta.EmployeeRef?.name || ta.VendorRef?.name || "Unknown";
        const hours = (ta.Hours || 0) + (ta.Minutes || 0) / 60;
        agg[name] = (agg[name] || 0) + hours;
      });

      return Object.entries(agg)
        .map(([name, hours]) => ({
          name,
          hours: parseFloat(hours.toFixed(2)),
        }))
        .sort((a, b) => b.hours - a.hours);
    }
  }, [source, insightEntries, qbData, activeStart, activeEnd]);

  // ── Compute heatmap color for each bar ──
  const barColors = useMemo(() => {
    if (chartData.length === 0) return [];
    const hours = chartData.map((d) => d.hours);
    const min = Math.min(...hours);
    const max = Math.max(...hours);
    return chartData.map((d) => getHeatmapColor(d.hours, min, max));
  }, [chartData]);

  // ── Source dropdown component ──
  // Map error keys to translated messages at render time
  const errorMessages: Record<string, string> = {
    FAILED_LOAD_TIMESHEETS: t.failedLoadTimesheets,
    USER_DOC_NOT_FOUND: t.userDocNotFound,
    QB_NOT_CONNECTED: t.qbNotConnected,
    UNEXPECTED_ERROR: t.unexpectedError,
  };
  const translatedError = error ? (errorMessages[error] || error) : null;

  const sourceSelector = (
    <div className="relative" data-source-dropdown>
      <button
        onClick={() => setSourceOpen(!sourceOpen)}
        className={`flex items-center gap-1 text-[9px] font-semibold transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <span>{`${t.source}: `}{source === "insight" ? "INSiGHT" : t.quickbooks}</span>
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${sourceOpen ? "rotate-180" : ""}`} />
      </button>
      {sourceOpen && (
        <div className={`absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg py-1 min-w-[130px] animate-in fade-in slide-in-from-top-1 duration-150 ${isDarkMode ? 'bg-slate-800 border border-slate-600' : 'bg-[#faf8f3] border border-slate-200'}`}>
          <button
            onClick={() => { setSource("insight"); setSourceOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors ${source === "insight" ? (isDarkMode ? "text-blue-400 bg-blue-900/40" : "text-blue-600 bg-blue-50/60") : (isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#f2ece0]")}`}
          >
            {t.insightTimesheet}
          </button>
          <button
            onClick={() => { setSource("quickbooks"); setSourceOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors ${source === "quickbooks" ? (isDarkMode ? "text-blue-400 bg-blue-900/40" : "text-blue-600 bg-blue-50/60") : (isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#f2ece0]")}`}
          >
            {t.quickbooks}
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-6 mt-4 w-full">
          {[40, 70, 45, 90, 65, 30, 50].map((height, i) => (
            <div 
              key={i} 
              className={`w-full rounded-t-sm ${isDarkMode ? 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800' : 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200'}`} 
              style={{ height: `${height}%`, backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} 
            />
          ))}
        </div>
      </div>
    );
  }

  if (error === "QB_NOT_CONNECTED" && source === "quickbooks") {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className={`flex-1 flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed ${isDarkMode ? 'bg-slate-800/50 border-slate-600/60' : 'bg-[#faf6ed]/50 border-slate-200/60'}`}>
          <Clock className={`w-6 h-6 mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
          <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{t.qbNotConnectedTitle}</h4>
          <p className={`text-[9px] mt-1 max-w-[180px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.qbNotConnectedDesc}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className={`flex-1 flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed ${isDarkMode ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50/50 border-red-200/50'}`}>
          <AlertCircle className="w-6 h-6 text-red-400 mb-1.5" />
          <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{t.failedLoadHours}</h4>
          <p className={`text-[9px] mt-1 max-w-[180px] truncate-2-lines ${isDarkMode ? 'text-red-300' : 'text-red-500'}`}>
            {translatedError}
          </p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className={`flex-1 flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed ${isDarkMode ? 'bg-slate-800/50 border-slate-600/60' : 'bg-[#faf6ed]/50 border-slate-200/60'}`}>
          <Clock className={`w-6 h-6 mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`} />
          <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{t.noWeeklyHours}</h4>
          <p className={`text-[9px] mt-1 max-w-[180px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
            {t.noWeeklyHoursDesc}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
    <div className={`w-full h-full flex-1 min-h-0 pt-1 rounded-lg ${isDarkMode ? 'bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeOpacity={0.6} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: isDarkMode ? '#cbd5e1' : '#94a3b8', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: isDarkMode ? '#cbd5e1' : '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              cursor={{ fill: isDarkMode ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className={`px-3 py-2.5 rounded-xl shadow-2xl border backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white/90 border-slate-200'}`}>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{data.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: payload[0].color || '#60a5fa' }} />
                      <span className={`text-sm font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{data.hours}</span>
                      <span className={`text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.hours}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={30}>
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={barColors[index] || "#60a5fa"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
