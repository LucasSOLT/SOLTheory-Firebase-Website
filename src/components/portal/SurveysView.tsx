"use client";

import React from "react";
import { ClipboardList } from "lucide-react";

export function SurveysView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-[#faf8f3] rounded-3xl border border-slate-200 shadow-sm">
      <div className="w-20 h-20 bg-[#faf6ed] border border-slate-100 rounded-[2rem] shadow-sm flex items-center justify-center text-slate-300 mb-6 rotate-12 transition-transform hover:rotate-0 duration-300">
        <ClipboardList className="w-10 h-10 text-emerald-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-800">Master Surveys</h2>
      <p className="text-slate-500 mt-2 max-w-sm font-medium">
        Survey results flow here securely without exposing any raw data metrics.
      </p>
    </div>
  );
}
