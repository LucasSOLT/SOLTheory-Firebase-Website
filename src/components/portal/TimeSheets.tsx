"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Clock, ChevronLeft, ChevronRight, Loader2, CalendarDays, ChevronDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

/* â”€â”€ helpers â”€â”€ */
function getWeekRange(offset: number) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek + offset * 7);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { start: startOfWeek, end: endOfWeek };
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Get all day labels between two dates */
function getDayLabelsBetween(start: Date, end: Date) {
  const labels: { label: string; date: Date }[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  while (cur <= endDate) {
    labels.push({
      label: cur.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      date: new Date(cur),
    });
    cur.setDate(cur.getDate() + 1);
  }
  return labels;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPLOYEE_COLORS: Record<string, string> = {
  Steve: "#6366f1",   // indigo-500
  Gerard: "#f59e0b",  // amber-500
};

function getColor(name: string) {
  const key = Object.keys(EMPLOYEE_COLORS).find(k => name.toLowerCase().includes(k.toLowerCase()));
  return key ? EMPLOYEE_COLORS[key] : "#94a3b8";
}

/* â”€â”€ custom tooltip â”€â”€ */
function TimesheetTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 p-3 text-xs">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value.toFixed(1)}h</span>
        </div>
      ))}
    </div>
  );
}

/* â•â•â•â•â•â•â• Main Component â•â•â•â•â•â•â• */
export function TimeSheets() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return { from: d, to: new Date() };
  });

  const [timeData, setTimeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active date range based on mode
  const activeStart = useMemo(() => {
    return dateRange?.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : new Date();
  }, [dateRange?.from]);

  const activeEnd = useMemo(() => {
    return dateRange?.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : activeStart;
  }, [dateRange?.to, activeStart]);

  const fetchTimesheets = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    setLoading(true);
    setError(null);

    try {
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      if (!userDoc.exists()) return;
      const qb = userDoc.data()?.quickbooksOAuth;
      if (!qb?.refreshToken) {
        setError("QuickBooks not connected");
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
          startDate: formatDate(activeStart),
          endDate: formatDate(activeEnd),
        }),
      });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }

      setTimeData(json.data?.QueryResponse?.TimeActivity || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [firestore, user?.uid, activeStart, activeEnd]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  /* â”€â”€ Parse into chart-ready data â”€â”€ */
  const { chartData, employees, totalByEmployee } = useMemo(() => {
    const employeeSet = new Set<string>();

    // Group by date

      const dateMap: Record<string, Record<string, number>> = {};

      timeData.forEach((ta: any) => {
        const name = ta.EmployeeRef?.name || ta.VendorRef?.name || "Unknown";
        employeeSet.add(name);
        const dateKey = ta.TxnDate; // YYYY-MM-DD
        const hours = (ta.Hours || 0) + (ta.Minutes || 0) / 60;
        if (!dateMap[dateKey]) dateMap[dateKey] = {};
        dateMap[dateKey][name] = (dateMap[dateKey][name] || 0) + hours;
      });

      const employees = Array.from(employeeSet).sort();
      const dayLabels = getDayLabelsBetween(activeStart, activeEnd);

      const chartData = dayLabels.map(({ label, date }) => {
        const dateKey = formatDate(date);
        const row: any = { day: label };
        employees.forEach(emp => { row[emp] = dateMap[dateKey]?.[emp] || 0; });
        return row;
      });

      const totalByEmployee: Record<string, number> = {};
      employees.forEach(emp => {
        totalByEmployee[emp] = chartData.reduce((sum, d) => sum + (d[emp] || 0), 0);
      });

      return { chartData, employees, totalByEmployee };
  }, [timeData, activeStart, activeEnd]);

  const weekTotal = Object.values(totalByEmployee).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700 leading-none">Time Sheets</h3>
        </div>

        {/* Custom date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#faf6ed] border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Custom dates</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      )}
      {error && (
        <div className="text-xs text-red-500 text-center py-6 border border-dashed border-red-200 rounded-xl bg-red-50/50">
          {error}
        </div>
      )}

      {/* Chart */}
      {!loading && !error && (
        <>
          {employees.length === 0 ? (
            <div className="text-xs text-center text-slate-400 py-8 border border-dashed border-slate-200 rounded-xl">
              No time entries for this period.
            </div>
          ) : (
            <>
              <div className="w-full h-[220px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={chartData.length > 14 ? Math.floor(chartData.length / 10) : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <Tooltip content={<TimesheetTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", fontWeight: 600, color: "#64748b" }}
                    />
                    {employees.map((emp) => (
                      <Bar
                        key={emp}
                        dataKey={emp}
                        name={emp}
                        fill={getColor(emp)}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={chartData.length > 14 ? 12 : 32}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {employees.map(emp => (
                  <div key={emp} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-[#faf6ed]">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: getColor(emp) }}
                    >
                      {emp.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{emp}</p>
                      <p className="text-[10px] text-slate-400">Selected range</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">
                        {Math.floor(totalByEmployee[emp])}h {Math.round((totalByEmployee[emp] % 1) * 60)}m
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Range Total
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {Math.floor(weekTotal)}h {Math.round((weekTotal % 1) * 60)}m
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
