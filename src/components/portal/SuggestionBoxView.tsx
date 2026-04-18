"use client";

import React from "react";
import { Lightbulb } from "lucide-react";

export function SuggestionBoxView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-white rounded-3xl border border-slate-200 shadow-sm h-full w-full">
      <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-[2rem] shadow-sm flex items-center justify-center text-slate-300 mb-6 rotate-12 transition-transform hover:rotate-0 duration-300">
        <Lightbulb className="w-10 h-10 text-amber-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-800">Suggestion Box</h2>
      <p className="text-slate-500 mt-2 max-w-sm font-medium">
        We'll listen to our community's voices here. The suggestion intake system is being configured!
      </p>
    </div>
  );
}
