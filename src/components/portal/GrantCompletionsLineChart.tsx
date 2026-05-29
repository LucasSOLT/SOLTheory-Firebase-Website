"use client";

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

interface GrantSuggestion {
  id: string;
  status: string;
  completedAt?: any;
  appliedAt?: any;
  createdAt?: any;
}

/**
 * Generates the last 6 months as labels for the X-axis.
 */
function getLast6Months(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short" });
    months.push({ key, label });
  }
  return months;
}

export function GrantCompletionsLineChart() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<GrantSuggestion[]>([]);

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    setLoading(true);
    setError(null);

    const grantsRef = collection(firestore, "grant_suggestions");
    const q = query(grantsRef, where("orgId", "==", "soltheory"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched: GrantSuggestion[] = snap.docs.map((d) => ({
          id: d.id,
          status: d.data().status || "unapplied",
          completedAt: d.data().completedAt || null,
          appliedAt: d.data().appliedAt || null,
          createdAt: d.data().createdAt || null,
        }));
        setGrants(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading grant suggestions:", err);
        setError("Failed to load grants");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid]);

  const chartData = useMemo(() => {
    const months = getLast6Months();

    // Bucket grants that are "completed" or "applied" by their completion/applied month
    const counts: Record<string, number> = {};
    months.forEach((m) => (counts[m.key] = 0));

    grants.forEach((g) => {
      if (g.status !== "completed" && g.status !== "applied") return;
      const ts = g.completedAt || g.appliedAt;
      if (!ts) return;
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (counts[key] !== undefined) counts[key]++;
    });

    // Running cumulative total
    let cumulative = 0;
    return months.map((m) => {
      cumulative += counts[m.key];
      return { name: m.label, count: cumulative };
    });
  }, [grants]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-2">
        <AlertCircle className="w-4 h-4 text-red-400 mb-1" />
        <span className="text-[8px] text-red-500 font-semibold">{error}</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
          Grants Completed
        </span>
        <span className="text-[8px] font-semibold text-slate-300 tabular-nums">
          {grants.filter((g) => g.status === "completed" || g.status === "applied").length} total
        </span>
      </div>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 8, fill: "#94a3b8", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 8, fill: "#94a3b8", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
              minTickGap={1}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "none",
                borderRadius: "8px",
                fontSize: "10px",
                color: "#f8fafc",
                padding: "6px 10px",
              }}
              itemStyle={{ color: "#818cf8" }}
              labelStyle={{ color: "#94a3b8", fontWeight: 700, fontSize: "9px" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#818cf8"
              strokeWidth={2}
              dot={{ r: 3, fill: "#818cf8", stroke: "#fff", strokeWidth: 1.5 }}
              activeDot={{ r: 4, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
              name="Completed"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
