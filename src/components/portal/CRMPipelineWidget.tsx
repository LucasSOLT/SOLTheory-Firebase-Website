"use client";

import { TrendingUp, Users, DollarSign, Briefcase } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from "@/lib/useDarkMode";

export function CRMPipelineWidget() {
  const { lang } = useTranslation();
  const isDarkMode = useDarkMode();

  return (
    <div className="flex flex-col h-full w-full min-h-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            {lang === "es" ? "Embudo y Pipeline CRM" : "CRM Funnel & Pipeline"}
          </h3>
          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {lang === "es" ? "Pipeline de ventas y conversión" : "Pipeline value & conversion funnel"}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-500/10 px-2 py-1 rounded-full border border-slate-500/10">
          <TrendingUp className="w-3 h-3" />
          <span>0.0%</span>
        </div>
      </div>

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 shrink-0 mb-4">
        <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-[#ede8da]/70'} flex items-center justify-between`}>
          <div>
            <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
              {lang === "es" ? "Valor de Pipeline" : "Pipeline Value"}
            </span>
            <span className={`text-base font-bold tracking-tight mt-0.5 block ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              $0
            </span>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-[#ede8da]/70'} flex items-center justify-between`}>
          <div>
            <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
              {lang === "es" ? "Leads Activos" : "Active Leads"}
            </span>
            <span className={`text-base font-bold tracking-tight mt-0.5 block ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              0
            </span>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <Users className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Conversion Funnel Section */}
      <div className="grid grid-cols-5 gap-3 flex-1 min-h-0">
        {/* Left Funnel Graphics */}
        <div className="col-span-2 flex flex-col justify-between py-1 shrink-0 space-y-1">
          {/* Funnel Stage 1: Leads */}
          <div className="w-full">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 px-1 mb-0.5">
              <span>{lang === "es" ? "Leads" : "Leads"}</span>
              <span>0</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-500/10 overflow-hidden border border-slate-500/5">
              <div className="h-full w-0 bg-indigo-500 rounded-full" />
            </div>
          </div>

          {/* Funnel Stage 2: Contacted */}
          <div className="w-full">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 px-1 mb-0.5">
              <span>{lang === "es" ? "Contacto" : "Contacted"}</span>
              <span>0</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-500/10 overflow-hidden border border-slate-500/5">
              <div className="h-full w-0 bg-blue-500 rounded-full" />
            </div>
          </div>

          {/* Funnel Stage 3: Proposal */}
          <div className="w-full">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 px-1 mb-0.5">
              <span>{lang === "es" ? "Propuesta" : "Proposal"}</span>
              <span>0</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-500/10 overflow-hidden border border-slate-500/5">
              <div className="h-full w-0 bg-amber-500 rounded-full" />
            </div>
          </div>

          {/* Funnel Stage 4: Closed */}
          <div className="w-full">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 px-1 mb-0.5">
              <span>{lang === "es" ? "Cierre" : "Closed"}</span>
              <span>0</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-500/10 overflow-hidden border border-slate-500/5">
              <div className="h-full w-0 bg-emerald-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Active Deals List */}
        <div className={`col-span-3 flex flex-col min-h-0 justify-center items-center border p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-950/40 border-slate-800/80' : 'bg-white/50 border-[#ede8da]/50'}`}>
          <Briefcase className="w-6 h-6 text-slate-550 mb-1.5 animate-pulse" />
          <span className={`text-[10px] font-semibold text-slate-400 text-center`}>
            {lang === "es" ? "Sin oportunidades en pipeline" : "No active deals in pipeline"}
          </span>
        </div>
      </div>
    </div>
  );
}
