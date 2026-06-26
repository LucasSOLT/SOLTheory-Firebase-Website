"use client";

import { useState } from "react";
import { Cpu, DollarSign, Clock, ShieldCheck, Activity, Info } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from "@/lib/useDarkMode";
import { useGrantsData } from "@/hooks/useGrantsData";

export function AIAgentOperationsWidget({ orgId = "soltheory" }: { orgId?: string }) {
  const { lang } = useTranslation();
  const isDarkMode = useDarkMode();
  const { grants } = useGrantsData(orgId);
  const [activeTab, setActiveTab] = useState<"agents" | "logs">("agents");

  // Calculate dynamic hours saved: Every grant found = 15 minutes of human time
  const grantsCount = grants?.length || 0;
  const grantsHoursSaved = (grantsCount * 15) / 60;

  // Other non-functional actions contribute 0 for now
  const emailsWritten = 0;
  const phoneCallsMinutes = 0;
  const crmLeadsFound = 0;

  const totalHoursSaved = grantsHoursSaved + (emailsWritten * 5) / 60 + phoneCallsMinutes / 60 + (crmLeadsFound * 10) / 60;

  // Setup agents list with current operational status (Only Grant Scrapers Alpha->Delta are functional)
  const agents = [
    { name: lang === "es" ? "Scraper de Subvenciones Alpha" : "Grant Scraper Alpha", status: "active", version: "v1.2" },
    { name: lang === "es" ? "Scraper de Subvenciones Beta" : "Grant Scraper Beta", status: "active", version: "v1.2" },
    { name: lang === "es" ? "Scraper de Subvenciones Gamma" : "Grant Scraper Gamma", status: "active", version: "v1.1" },
    { name: lang === "es" ? "Scraper de Subvenciones Delta" : "Grant Scraper Delta", status: "active", version: "v1.1" },
    { name: lang === "es" ? "Agente de Correos Salientes" : "Outbound Email Agent", status: "inactive", version: "v0.1" },
    { name: lang === "es" ? "Agente de Correos Entrantes" : "Inbound Email Agent", status: "inactive", version: "v0.1" },
    { name: lang === "es" ? "Agente de Llamadas Entrantes" : "Inbound Phone Agent", status: "inactive", version: "v0.1" },
    { name: lang === "es" ? "Scraper de Prospectos CRM" : "CRM Lead Scraper", status: "inactive", version: "v0.2" },
  ];

  return (
    <div className="flex flex-col h-full w-full min-h-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            {lang === "es" ? "Operaciones de Agentes IA" : "AI Agent Operations"}
          </h3>
          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {lang === "es" ? "Monitoreo de estado en tiempo real" : "Real-time state monitoring & ROI"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>{lang === "es" ? "4 de 8 Activos" : "4 of 8 Active"}</span>
        </div>
      </div>

      {/* ROI Stats Grid */}
      <div className="grid grid-cols-3 gap-2 shrink-0 mb-3">
        {/* Hours Saved */}
        <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-[#ede8da]/70'} flex flex-col justify-between`}>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
            {lang === "es" ? "Horas Salvas" : "Hours Saved"}
          </span>
          <div className="mt-1.5">
            <span className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              {totalHoursSaved.toFixed(1)} hrs
            </span>
          </div>
        </div>

        {/* Token Costs */}
        <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-[#ede8da]/70'} flex flex-col justify-between`}>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
            {lang === "es" ? "Costo Tokens" : "Token Costs"}
          </span>
          <div className="mt-1.5">
            <span className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              $0.00
            </span>
          </div>
        </div>

        {/* Audits */}
        <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-[#ede8da]/70'} flex flex-col justify-between`}>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
            {lang === "es" ? "Auditorías" : "Audits"}
          </span>
          <div className="mt-1.5">
            <span className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              0
            </span>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-2 shrink-0 border-b pb-1.5 border-slate-200/20">
        <button
          onClick={() => setActiveTab("agents")}
          className={`text-[10px] font-bold pb-0.5 border-b-2 transition-all cursor-pointer ${
            activeTab === "agents"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-350"
          }`}
        >
          {lang === "es" ? "Agentes" : "Agents"}
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`text-[10px] font-bold pb-0.5 border-b-2 transition-all cursor-pointer ${
            activeTab === "logs"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-350"
          }`}
        >
          {lang === "es" ? "Registro de Actividad" : "Activity Log"}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "agents" ? (
          <div className="space-y-1.5">
            {agents.map((agent, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-1.5 rounded-lg border text-[10px] ${
                  isDarkMode
                    ? 'bg-slate-900/30 border-slate-850 hover:bg-slate-855/40'
                    : 'bg-white/40 border-[#ede8da]/40 hover:bg-[#faf8f2]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="relative flex h-1.5 w-1.5">
                    {agent.status === "active" ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
                    )}
                  </span>
                  <span className={`font-semibold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[8px] font-mono px-1 rounded bg-slate-500/10 text-slate-400`}>
                    {agent.version}
                  </span>
                  <span className={`font-bold ${
                    agent.status === "active" ? "text-emerald-500" : "text-slate-450"
                  }`}>
                    {agent.status === "active"
                      ? (lang === "es" ? "ACTIVO" : "ACTIVE")
                      : (lang === "es" ? "INACTIVO" : "INACTIVE")
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col justify-between">
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
              {grantsCount > 0 ? (
                grants.slice(0, 6).map((grant) => (
                  <div
                    key={grant.id}
                    className={`p-2 rounded-lg border text-[10px] flex gap-2 items-start ${
                      isDarkMode
                        ? 'bg-slate-900/30 border-slate-850'
                        : 'bg-white/40 border-[#ede8da]/40'
                    }`}
                  >
                    <span className="relative flex h-1.5 w-1.5 mt-1">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-750'}`}>
                        {lang === "es" ? "Scraper Alpha encontró subvención" : "Scraper Alpha found grant"}
                      </p>
                      <p className={`text-[9px] mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-550'}`}>
                        {grant.title}
                      </p>
                    </div>
                    <span className="text-[8px] text-slate-500 shrink-0 mt-0.5">
                      +15m
                    </span>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                  <Cpu className="w-6 h-6 text-slate-500 animate-pulse mb-1.5" />
                  <p className="text-[10px] text-slate-450 font-medium">
                    {lang === "es" ? "A la espera de registros de agentes..." : "Awaiting agent logs..."}
                  </p>
                </div>
              )}
            </div>

            {/* Legend info */}
            <div className={`mt-2 p-1.5 rounded-lg border text-[8px] font-semibold text-slate-400 space-y-0.5 leading-tight ${
              isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-[#ede8da]/50'
            }`}>
              <div className="flex items-center gap-1 text-[9px] font-bold border-b border-slate-200/10 pb-0.5 mb-1 text-slate-300">
                <Info className="w-3 h-3 text-indigo-400" />
                <span>{lang === "es" ? "Métricas de Ahorro Humano" : "Human Time Equivalents"}</span>
              </div>
              <div className="flex justify-between">
                <span>📁 {lang === "es" ? "Subvención Encontrada" : "Grant Found"}</span>
                <span className="text-emerald-500">15m</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>✉️ {lang === "es" ? "Email Enviado" : "Email Written"} (no built)</span>
                <span>5m</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>📞 {lang === "es" ? "Llamada Telefónica" : "Phone Call"} (no built)</span>
                <span>dur.</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>👤 {lang === "es" ? "Prospecto CRM" : "CRM Lead Scraped"} (no built)</span>
                <span>10m</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
