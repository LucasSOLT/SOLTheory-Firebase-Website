"use client";

import React from "react";
import { Activity, BarChart4 } from "lucide-react";

export function AnalyticsView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-[#fefcf6] rounded-3xl border border-slate-200 shadow-sm">
      <div className="w-20 h-20 bg-[#faf6ed] border border-slate-100 rounded-[2rem] shadow-sm flex items-center justify-center text-slate-300 mb-6 rotate-12 transition-transform hover:rotate-0 duration-300">
        <Activity className="w-10 h-10 text-indigo-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-800">Analytics Dashboard</h2>
      <p className="text-slate-500 mt-2 max-w-sm font-medium">
        Your comprehensive analytics data will appear here soon. We are connecting the live metrics right now!
      </p>
    </div>
  );
}
