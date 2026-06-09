"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { Clock, Loader2, AlertCircle, ChevronDown } from "lucide-react";
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
    if (source !== "insight" || !firestore || !orgDomain) return;
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
        setError("Failed to load INSiGHT timesheets");
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
        setError("User document not found");
        return;
      }

      const qb = userDoc.data()?.quickbooksOAuth;
      if (!qb?.refreshToken) {
        setError("QuickBooks not connected");
        return;
      }

      const res = await fetch("/api/quickbooks/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setError(err.message || "An unexpected error occurred");
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
  const sourceSelector = (
    <div className="relative" data-source-dropdown>
      <button
        onClick={() => setSourceOpen(!sourceOpen)}
        className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
      >
        <span>Source: {source === "insight" ? "INSiGHT" : "QuickBooks"}</span>
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${sourceOpen ? "rotate-180" : ""}`} />
      </button>
      {sourceOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#fefcf6] border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px] animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { setSource("insight"); setSourceOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors ${source === "insight" ? "text-blue-600 bg-blue-50/60" : "text-slate-600 hover:bg-[#faf6ed]"}`}
          >
            INSiGHT Timesheet
          </button>
          <button
            onClick={() => { setSource("quickbooks"); setSourceOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[10px] font-semibold transition-colors ${source === "quickbooks" ? "text-blue-600 bg-blue-50/60" : "text-slate-600 hover:bg-[#faf6ed]"}`}
          >
            QuickBooks
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (error === "QuickBooks not connected" && source === "quickbooks") {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-5 bg-[#faf6ed]/50 rounded-2xl border border-dashed border-slate-200/60">
          <Clock className="w-6 h-6 text-slate-400 mb-1.5" />
          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">QuickBooks Not Connected</h4>
          <p className="text-[9px] text-slate-500 mt-1 max-w-[180px] leading-relaxed">
            Please link your QuickBooks account in settings to display hours worked.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-5 bg-red-50/50 rounded-2xl border border-dashed border-red-200/50">
          <AlertCircle className="w-6 h-6 text-red-400 mb-1.5" />
          <h4 className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Failed to Load Hours</h4>
          <p className="text-[9px] text-red-500 mt-1 max-w-[180px] truncate-2-lines">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full w-full flex flex-col min-h-[140px]">
        <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-5 bg-[#faf6ed]/50 rounded-2xl border border-dashed border-slate-200/60">
          <Clock className="w-6 h-6 text-slate-300 mb-1.5" />
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">No Weekly Hours Worked</h4>
          <p className="text-[9px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
            No timesheet entries were logged for this week.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-end mb-1 shrink-0">{sourceSelector}</div>
      <div className="w-full h-full flex-1 min-h-0 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              cursor={{ fill: "rgba(59, 130, 246, 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-lg shadow-md border border-slate-800 p-2 text-[10px] font-bold">
                    <p className="text-slate-300">{data.name}</p>
                    <p className="text-blue-400 text-xs mt-0.5">{data.hours} hours</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={30}>
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
