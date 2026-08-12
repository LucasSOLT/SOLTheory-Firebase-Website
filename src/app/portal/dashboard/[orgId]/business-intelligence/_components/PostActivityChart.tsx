"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Timestamp } from "firebase/firestore";
import type { InstagramPost } from "../_hooks/useBIData";

/* ── Helpers ───────────────────────────────────────────── */

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v?.seconds) return new Date(v.seconds * 1000);
  return null;
}

/* ── Component ─────────────────────────────────────────── */

export default function PostActivityChart({
  posts,
  dk,
}: {
  posts: InstagramPost[];
  dk: boolean;
}) {
  const data = useMemo(() => {
    const weekMap = new Map<string, { published: number; scheduled: number; draft: number }>();

    for (const p of posts) {
      const d = toDate(p.scheduledTime) || toDate(p.createdAt);
      if (!d) continue;

      // Group by week (start of week label)
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      if (!weekMap.has(label)) {
        weekMap.set(label, { published: 0, scheduled: 0, draft: 0 });
      }
      const entry = weekMap.get(label)!;
      const status = p.status?.toLowerCase() || "draft";

      if (status === "published") entry.published++;
      else if (status === "scheduled" || status === "processing") entry.scheduled++;
      else entry.draft++;
    }

    return Array.from(weekMap.entries())
      .map(([week, counts]) => ({ week, ...counts }))
      .slice(-12); // Last 12 weeks max
  }, [posts]);

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className={`px-3 py-2 rounded-lg shadow-lg border text-xs pointer-events-none select-none ${
          dk ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <p className="font-semibold mb-1">Week of {label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="capitalize">{p.dataKey}</span>
            <span className="font-semibold ml-auto tabular-nums">{p.value}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          vertical={false}
        />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: dk ? "#94a3b8" : "#64748b" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          wrapperStyle={{ pointerEvents: "none", zIndex: 100 }}
          isAnimationActive={false}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
        />
        <Bar dataKey="published" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={20} />
        <Bar dataKey="scheduled" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={20} />
        <Bar dataKey="draft" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
