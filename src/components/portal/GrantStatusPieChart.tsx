"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";
import type { GrantRecord } from "@/hooks/useGrantsData";

const STATUS_CONFIG = [
  { key: "received",  label: "Received",       color: "#22c55e" }, // green-500
  { key: "denied",    label: "Denied",          color: "#f87171" }, // red-400
  { key: "unapplied", label: "Un-Applied",     color: "#9ca3af" }, // gray-400
  { key: "applied",   label: "Review Pending",  color: "#facc15" }, // yellow-400
];

interface Props {
  grants: GrantRecord[];
  loading: boolean;
}

export function GrantStatusPieChart({ grants = [], loading }: Props) {
  const { chartData, total } = useMemo(() => {
    const buckets: Record<string, number> = {
      received: 0,
      denied: 0,
      unapplied: 0,
      applied: 0,
    };

    (grants || []).forEach((g) => {
      const s = (g.status || "unapplied").toLowerCase();
      if (s === "received" || s === "completed" || s === "approved") buckets.received++;
      else if (s === "denied") buckets.denied++;
      else if (s === "applied" || s === "pending") buckets.applied++;
      else buckets.unapplied++;
    });

    const total = grants.length;

    // When sum of all statuses is 0, show a single 100% grey placeholder
    // to avoid divide-by-zero or NaN render errors
    if (total === 0) {
      return {
        chartData: [
          { name: "No Suggested Grants", value: 1, color: "#d1d5db", actualValue: 0 },
        ],
        total: 0,
      };
    }

    return {
      chartData: STATUS_CONFIG.map((sc) => ({
        name: sc.label,
        value: buckets[sc.key],
        color: sc.color,
        actualValue: buckets[sc.key],
      })).filter((d) => d.value > 0), // Only show segments with data
      total,
    };
  }, [grants]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
          Grant Status Breakdown
        </span>
        <span className="text-[8px] font-semibold text-slate-300 tabular-nums">
          {total} total
        </span>
      </div>
      <div className="flex-1 min-h-0 w-full flex items-center gap-2">
        {/* Donut chart */}
        <div className="flex-1 min-h-0 h-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={total === 0 ? 0 : 2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "10px",
                  color: "#f8fafc",
                  padding: "6px 10px",
                }}
                formatter={(value: number, name: string, props: any) => {
                  const actual = props.payload.actualValue;
                  return [`${actual}`, name];
                }}
                labelStyle={{ display: "none" }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center count overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-sm font-extrabold text-slate-800 leading-none">{total}</span>
              <span className="block text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                Grants
              </span>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-1.5 shrink-0 pr-1">
          {STATUS_CONFIG.map((sc) => {
            const bucket = grants.filter((g) => {
              const s = (g.status || "unapplied").toLowerCase();
              if (sc.key === "received") return s === "received" || s === "completed" || s === "approved";
              if (sc.key === "denied") return s === "denied";
              if (sc.key === "applied") return s === "applied" || s === "pending";
              return s === "unapplied";
            });
            return (
              <div key={sc.key} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: sc.color }}
                />
                <span className="text-[8px] font-semibold text-slate-500 whitespace-nowrap leading-none">
                  {sc.label}
                </span>
                <span className="text-[8px] font-bold text-slate-700 tabular-nums leading-none">
                  {bucket.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
