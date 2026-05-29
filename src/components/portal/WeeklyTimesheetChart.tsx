"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Clock, Loader2, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

/* ── helpers ── */
function formatDate(d: Date) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getWeeklyTimesheetDates() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const start = new Date(now);
  start.setDate(now.getDate() - day); // Start on Sunday
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 8); // Through Monday of next week (8 days later)
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

const COLORS = ["#4f46e5", "#8b5cf6", "#10b981", "#f59e0b", "#3b82f6", "#06b6d4"];

export function WeeklyTimesheetChart() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timesheetData, setTimesheetData] = useState<any[]>([]);

  // Dynamically calculate the Sunday to Monday range relative to now
  const { start: activeStart, end: activeEnd } = useMemo(() => getWeeklyTimesheetDates(), []);

  const fetchTimesheets = useCallback(async () => {
    if (!firestore || !user?.uid) return;
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
          startDate: formatDate(activeStart),
          endDate: formatDate(activeEnd),
        }),
      });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }

      setTimesheetData(json.data?.QueryResponse?.TimeActivity || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [firestore, user?.uid, activeStart, activeEnd]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  // Aggregate fetched hours by user name
  const chartData = useMemo(() => {
    const agg: Record<string, number> = {};
    timesheetData.forEach((ta: any) => {
      const name = ta.EmployeeRef?.name || ta.VendorRef?.name || "Unknown";
      const hours = (ta.Hours || 0) + (ta.Minutes || 0) / 60;
      agg[name] = (agg[name] || 0) + hours;
    });

    return Object.entries(agg)
      .map(([name, hours]) => ({
        name,
        hours: parseFloat(hours.toFixed(2)),
      }))
      .sort((a, b) => b.hours - a.hours); // Sort highest hours first
  }, [timesheetData]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error === "QuickBooks not connected") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60 min-h-[140px]">
        <Clock className="w-6 h-6 text-slate-400 mb-1.5" />
        <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">QuickBooks Not Connected</h4>
        <p className="text-[9px] text-slate-500 mt-1 max-w-[180px] leading-relaxed">
          Please link your QuickBooks account in settings to display hours worked.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-5 bg-red-50/50 rounded-2xl border border-dashed border-red-200/50 min-h-[140px]">
        <AlertCircle className="w-6 h-6 text-red-400 mb-1.5" />
        <h4 className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Failed to Load Hours</h4>
        <p className="text-[9px] text-red-500 mt-1 max-w-[180px] truncate-2-lines">
          {error}
        </p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60 min-h-[140px]">
        <Clock className="w-6 h-6 text-slate-300 mb-1.5" />
        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">No Weekly Hours Worked</h4>
        <p className="text-[9px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
          No timesheet entries were logged for this week.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
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
              cursor={{ fill: "rgba(99, 102, 241, 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-lg shadow-md border border-slate-800 p-2 text-[10px] font-bold">
                    <p className="text-slate-300">{data.name}</p>
                    <p className="text-indigo-400 text-xs mt-0.5">{data.hours} hours</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={30}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
