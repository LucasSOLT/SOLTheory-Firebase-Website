"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft, Loader2,
  ArrowUpRight, FileText, ChevronRight,
  MapPin, DollarSign, Calendar, Users,
  Building2, MonitorSmartphone, Sparkles, Search, Brain, CheckCircle2, XCircle
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useFirestore } from "@/firebase";
import { GrantAgentConfigModal, type GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";
import { SessionSwitcher } from "@/components/portal/SessionSwitcher";
import { useGrantSessions } from "@/hooks/useGrantSessions";
import { useOrgProfile } from "@/hooks/useOrgProfile";
import { useGrantScanStatus } from "@/hooks/useGrantScanStatus";
import { AgentWorkerController } from "@/components/portal/AgentWorkerController";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { SERVICE_AREA_GROUPS } from "@/data/service-areas";
import { POPULATION_CATEGORIES } from "@/data/populations";

/* ── Types ── */
interface GrantRecord {
  id: string;
  title: string;
  agency: string;
  amount: number | null;
  status: "unapplied" | "applied" | "approved" | "denied";
  dateSuggested: any;
  agentId?: string;
  url?: string;
}

/* ── Helpers ── */
function fmtCurrency(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}



/* ═══════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════ */

export default function FederalGrantScoutDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const firestore = useFirestore();

  const orgPrefix = pathname.includes("/nxtchapter/") ? "nxtchapter" : "soltheory";
  const dash = `/portal/dashboard/${orgPrefix}`;

  const dk = isDarkMode;

  /* ── state ── */

  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [showNewSessionWizard, setShowNewSessionWizard] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  /* ── sessions hook ── */
  const {
    sessions, activeSession, activeSessionId, setActiveSessionId,
    createSession, updateSession, deleteSession, renameSession, canCreateMore,
    loading: sessionsLoading,
  } = useGrantSessions("soltheory");
  const { orgProfile, saveOrgProfile } = useOrgProfile("soltheory");
  const { status: scanStatus, message: scanMessage, isScanning } = useGrantScanStatus();

  /* ── filter sessions to federal only ── */
  const federalSessions = useMemo(
    () => sessions.filter((s: any) => s.searchMode === 'federal' || !s.searchMode),
    [sessions]
  );

  const loading = sessionsLoading;

  /* ── load grants (filtered by active session — client-side) ── */
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "grant_suggestions"), where("orgId", "==", "soltheory"));
    const unsub = onSnapshot(q, s => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() } as GrantRecord));
      // If a session is selected, show only that session's grants
      // Otherwise, show only grants that belong to federal sessions
      const federalSessionIds = new Set(federalSessions.map(fs => fs.id));
      const filtered = activeSessionId
        ? all.filter((g: any) => g.sessionId === activeSessionId)
        : all.filter((g: any) => g.searchMode === 'federal' || (!g.searchMode && federalSessionIds.has(g.sessionId)));
      setGrants(filtered);
      setGrantsLoading(false);
    }, () => setGrantsLoading(false));
    return unsub;
  }, [firestore, activeSessionId, federalSessions]);

  /* ── derived stats ── */
  const total = grants.length;
  const applied = grants.filter(g => g.status === "applied").length;
  const approved = grants.filter(g => g.status === "approved").length;
  const funding = grants.filter(g => g.status === "approved" && g.amount).reduce((s, g) => s + (g.amount || 0), 0);

  /* ── common classes ── */
  const surface  = dk ? "bg-[#111214] border-[#1e2028]" : "bg-white border-slate-200";
  const surface2 = dk ? "bg-[#0c0d0f]" : "bg-[#f7f7f5]";
  const txt      = dk ? "text-slate-100" : "text-slate-900";
  const txt2     = dk ? "text-slate-400" : "text-slate-500";
  const txt3     = dk ? "text-slate-500" : "text-slate-400";
  const divide   = dk ? "border-[#1e2028]" : "border-slate-200";

  return (
    <div className={`min-h-screen ${surface2} ${txt} overflow-y-auto`} style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Mount the worker controller so scanning runs on this page too */}
      <AgentWorkerController />
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">

        {/* ── Federal scout accent bar ── */}
        <div className="flex items-center gap-2.5 mb-6 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 shadow-sm">
          <Building2 className="w-4 h-4 text-white/90 drop-shadow-sm" />
          <span className="text-[11px] font-bold text-white tracking-wide uppercase">Federal Grant Scout</span>
          <span className="text-[10px] text-white/70 font-medium ml-auto">Grants.gov · SAM.gov · USASpending</span>
        </div>

        {/* ── breadcrumb ── */}
        <button
          onClick={() => router.push(`${dash}/agentic-prospecting`)}
          className={`flex items-center gap-1.5 text-[13px] font-medium mb-6 ${txt2} hover:${txt} transition-colors cursor-pointer`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Agentic Prospecting
        </button>

        {/* ── page header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className={`text-2xl font-semibold tracking-tight ${txt}`}>Federal Grant Scout</h1>

            </div>
            <p className={`text-[13px] leading-relaxed max-w-xl ${txt2}`}>
              Autonomous agents scanning Grants.gov daily, matching opportunities to your organizational eligibility profile.
            </p>
          </div>
          <button
            onClick={() => router.push(`${dash}/grant-statuses`)}
            className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg border transition-colors cursor-pointer shrink-0 ${dk ? "border-[#1e2028] text-slate-300 hover:bg-[#17181c]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            View All Grants
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── stats ── */}
        <div className={`grid grid-cols-2 md:grid-cols-4 border rounded-xl overflow-hidden mb-8 ${surface} ${divide}`}>
          {[
            { label: "Sessions active", value: String(federalSessions.length) },
            { label: "Grants discovered", value: grantsLoading ? "–" : String(total) },
            { label: "Applications filed", value: grantsLoading ? "–" : String(applied) },
            { label: "Approved funding", value: grantsLoading ? "–" : fmtCurrency(funding || null) },
          ].map((s, i) => (
            <div key={s.label} className={`px-5 py-4 ${i > 0 ? (dk ? "border-l border-[#1e2028]" : "border-l border-slate-200") : ""} ${i >= 2 ? "max-md:border-t max-md:border-l-0" + (i === 2 ? " max-md:!border-l-0" : "") : ""}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide mb-1 ${txt3}`}>{s.label}</p>
              <p className={`text-xl font-semibold tabular-nums ${txt}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Session Switcher ── */}
        <div className={`rounded-xl border p-4 mb-6 ${surface}`}>
          <SessionSwitcher
            sessions={federalSessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onCreateSession={() => setShowNewSessionWizard(true)}
            onDeleteSession={(id) => deleteSession(id, true)}
            onRenameSession={renameSession}
            onEditSession={(id) => setEditingSessionId(id)}
            onDuplicateSession={async (id) => {
              const src = sessions.find(s => s.id === id);
              if (!src) return;
              await createSession(src.name + " (Copy)", src.config, undefined, src.searchMode === 'federal' ? undefined : src.searchMode as any);
            }}
            canCreateMore={canCreateMore}
            loading={sessionsLoading}
          />
        </div>

        {/* ── Client-side scanning notice ── */}
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 mb-6 ${dk ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50 border-amber-200"}`}>
          <MonitorSmartphone className={`w-4 h-4 mt-0.5 shrink-0 ${dk ? "text-amber-400" : "text-amber-600"}`} />
          <div>
            <p className={`text-[11px] font-bold mb-0.5 ${dk ? "text-amber-300" : "text-amber-800"}`}>Scans run in your browser</p>
            <p className={`text-[10px] leading-relaxed ${dk ? "text-amber-400/70" : "text-amber-700/80"}`}>
              Grant scouts search while this tab is open and active. If you close the tab, navigate away, or your computer sleeps, scanning pauses automatically and resumes when you return. Keep this page open for continuous, uninterrupted discovery.
            </p>
          </div>
        </div>

        {/* ── Active filter summary strip ── */}
        {activeSession && (() => {
          const cfg = activeSession.config;
          if (!cfg) return null;
          const tags: { icon: React.ReactNode; text: string }[] = [];

          // Location
          if (cfg.locationCity && cfg.locationState) {
            tags.push({ icon: <MapPin className="w-3 h-3" />, text: `${cfg.locationCity}, ${cfg.locationState}` });
          } else if (cfg.locationState) {
            tags.push({ icon: <MapPin className="w-3 h-3" />, text: cfg.locationState });
          } else if (cfg.geoScope === "nationwide") {
            tags.push({ icon: <MapPin className="w-3 h-3" />, text: "Nationwide" });
          }

          // Service areas (show up to 3)
          if (cfg.serviceAreas?.length > 0) {
            const labels = cfg.serviceAreas.slice(0, 3).map(id => {
              for (const g of SERVICE_AREA_GROUPS) {
                const sub = g.subcategories.find(s => s.id === id);
                if (sub) return sub.label.split(" & ")[0]; // shorten
              }
              return id;
            });
            const extra = cfg.serviceAreas.length > 3 ? ` +${cfg.serviceAreas.length - 3}` : "";
            tags.push({ icon: <FileText className="w-3 h-3" />, text: labels.join(", ") + extra });
          }

          // Budget
          if (cfg.budgetMin || cfg.budgetMax) {
            const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
            if (cfg.budgetMin && cfg.budgetMax) {
              tags.push({ icon: <DollarSign className="w-3 h-3" />, text: `${fmt(cfg.budgetMin)}–${fmt(cfg.budgetMax)}` });
            } else if (cfg.budgetMin) {
              tags.push({ icon: <DollarSign className="w-3 h-3" />, text: `${fmt(cfg.budgetMin)}+` });
            } else if (cfg.budgetMax) {
              tags.push({ icon: <DollarSign className="w-3 h-3" />, text: `Up to ${fmt(cfg.budgetMax)}` });
            }
          }

          // Deadline
          if (cfg.deadlineWindow && cfg.deadlineWindow !== "any") {
            const dl: Record<string, string> = { "30": "30 days", "60": "60 days", "90": "90 days", "180": "6 months", "custom": "Custom" };
            tags.push({ icon: <Calendar className="w-3 h-3" />, text: dl[cfg.deadlineWindow] || cfg.deadlineWindow });
          }

          // Populations (show up to 2)
          if (cfg.populationsServed?.length > 0) {
            const popLabels = cfg.populationsServed.slice(0, 2).map(id => {
              const cat = POPULATION_CATEGORIES?.find?.((p: any) => p.id === id);
              return cat?.label?.split(" (")[0] || id;
            });
            const extra = cfg.populationsServed.length > 2 ? ` +${cfg.populationsServed.length - 2}` : "";
            tags.push({ icon: <Users className="w-3 h-3" />, text: popLabels.join(", ") + extra });
          }

          if (tags.length === 0) return null;

          return (
            <div className={`flex flex-wrap items-center gap-2 mb-4 px-1`}>
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    dk ? "bg-[#1a1b1f] text-slate-400 border border-[#252730]" : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {tag.icon}
                  {tag.text}
                </span>
              ))}
            </div>
          );
        })()}



        {/* ── Live Scan Progress Tile ── */}
        {scanMessage && (
          <div className={`rounded-xl border p-4 mb-4 transition-all duration-300 ${
            scanStatus === "searching" 
              ? (dk ? "bg-indigo-500/5 border-indigo-500/20" : "bg-indigo-50/80 border-indigo-200")
              : scanStatus === "found"
              ? (dk ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50/80 border-emerald-200")
              : (dk ? "bg-[#111214] border-[#1e2028]" : "bg-white border-slate-200")
          }`}>
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                scanStatus === "searching"
                  ? (dk ? "bg-indigo-500/10" : "bg-indigo-100")
                  : scanStatus === "found"
                  ? (dk ? "bg-emerald-500/10" : "bg-emerald-100")
                  : (dk ? "bg-slate-800" : "bg-slate-100")
              }`}>
                {scanStatus === "searching" ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${dk ? "text-indigo-400" : "text-indigo-600"}`} />
                ) : scanStatus === "found" ? (
                  <CheckCircle2 className={`w-4 h-4 ${dk ? "text-emerald-400" : "text-emerald-600"}`} />
                ) : (
                  <Search className={`w-4 h-4 ${dk ? "text-slate-500" : "text-slate-400"}`} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-wide mb-0.5 ${
                  scanStatus === "searching" ? (dk ? "text-indigo-400" : "text-indigo-700")
                  : scanStatus === "found" ? (dk ? "text-emerald-400" : "text-emerald-700")
                  : (dk ? "text-slate-500" : "text-slate-400")
                }`}>
                  {scanStatus === "searching" ? "Agent Active" : scanStatus === "found" ? "Discovery" : "Agent Status"}
                </p>
                <p className={`text-[12px] font-medium truncate ${
                  scanStatus === "searching" ? (dk ? "text-indigo-300" : "text-indigo-800")
                  : scanStatus === "found" ? (dk ? "text-emerald-300" : "text-emerald-800")
                  : (dk ? "text-slate-400" : "text-slate-500")
                }`}>
                  {scanMessage}
                </p>
              </div>

              {/* Scanning pulse dot */}
              {isScanning && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${dk ? "bg-indigo-400" : "bg-indigo-500"}`} />
                  <span className={`text-[10px] font-semibold ${dk ? "text-indigo-400" : "text-indigo-600"}`}>Live</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── recent discoveries heading ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-[15px] font-semibold ${txt}`}>{activeSession ? `${activeSession.name} — Discoveries` : "Recent Discoveries"}</h2>
          {grants.length > 0 && (
            <button
              onClick={() => router.push(`${dash}/grant-statuses`)}
              className={`flex items-center gap-1 text-[12px] font-medium cursor-pointer transition-colors ${dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"}`}
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* ── grants table ── */}
        {grantsLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className={`w-5 h-5 animate-spin ${txt3}`} /></div>
        ) : grants.length === 0 ? (
          <div className={`rounded-xl border p-12 text-center ${surface}`}>
            <p className={`text-[13px] font-medium mb-1 ${txt2}`}>No grants discovered yet</p>
            <p className={`text-[12px] ${txt3}`}>Deploy at least one search agent to start scanning.</p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden mb-10 ${surface}`}>
            {/* header row */}
            <div className={`grid grid-cols-12 gap-3 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide border-b ${dk ? "bg-[#0c0d0f] text-slate-500 border-[#1e2028]" : "bg-[#f7f7f5] text-slate-400 border-slate-200"}`}>
              <div className="col-span-5">Opportunity</div>
              <div className="col-span-3">Agency</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            {grants.slice(0, 8).map((g, i) => (
              <div
                key={g.id}
                onClick={() => router.push(`${dash}/grant-statuses`)}
                className={`grid grid-cols-12 gap-3 px-5 py-3 items-center border-b last:border-b-0 cursor-pointer transition-colors ${dk ? "border-[#1e2028] hover:bg-[#15161a]" : "border-slate-100 hover:bg-slate-50/60"}`}
              >
                <div className="col-span-5 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${txt}`}>{g.title}</p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className={`text-[12px] truncate ${txt2}`}>{g.agency}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className={`text-[13px] font-medium tabular-nums ${txt}`}>{fmtCurrency(g.amount)}</p>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                    g.status === "approved" ? (dk ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700")
                    : g.status === "applied" ? (dk ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-700")
                    : g.status === "denied" ? (dk ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-700")
                    : (dk ? "bg-[#1e2028] text-slate-400" : "bg-slate-100 text-slate-500")
                  }`}>
                    {g.status.charAt(0).toUpperCase() + g.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
            {grants.length > 8 && (
              <div className={`px-5 py-2.5 text-center border-t ${divide}`}>
                <button onClick={() => router.push(`${dash}/grant-statuses`)} className={`text-[12px] font-medium cursor-pointer ${dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
                  {grants.length - 8} more →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── footer note ── */}
        <div className={`flex items-center justify-between py-4 border-t ${divide}`}>
          <p className={`text-[11px] ${txt3}`}>
            All data sourced from <a href="https://www.grants.gov" target="_blank" rel="noopener noreferrer" className={`font-medium underline underline-offset-2 ${dk ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"}`}>Grants.gov</a> — the official U.S. government grants database.
          </p>
        </div>
      </div>


      {/* ── new session wizard ── */}
      {showNewSessionWizard && (
        <GrantAgentConfigModal
          onClose={() => setShowNewSessionWizard(false)}
          onSave={async (config) => {
            const sessionName = config.companyDescription
              ? config.companyDescription.substring(0, 30) + "..."
              : `Session ${federalSessions.length + 1}`;
            await createSession(sessionName, config);
            setShowNewSessionWizard(false);
          }}
          orgProfile={orgProfile}
          onSaveOrgProfile={saveOrgProfile}
        />
      )}

      {/* ── edit session wizard ── */}
      {editingSessionId && (() => {
        const editSession = sessions.find(s => s.id === editingSessionId);
        if (!editSession) return null;
        // Find most recent scan timestamp across all agents
        const scanTimes = editSession.lastScanTimes || {};
        let latestScanTs: any = null;
        for (const ts of Object.values(scanTimes)) {
          if (!ts) continue;
          const ms = typeof (ts as any).toMillis === "function" ? (ts as any).toMillis() : new Date(ts as any).getTime();
          if (!latestScanTs) { latestScanTs = ts; continue; }
          const prevMs = typeof (latestScanTs as any).toMillis === "function" ? (latestScanTs as any).toMillis() : new Date(latestScanTs as any).getTime();
          if (ms > prevMs) latestScanTs = ts;
        }
        return (
          <GrantAgentConfigModal
            onClose={() => setEditingSessionId(null)}
            initialConfig={editSession.config}
            isEditMode
            lastScanTimestamp={latestScanTs}
            onSave={async (config, options) => {
              const updates: any = { config };
              if (options?.resetTimer) {
                // Clear all scan times so agents re-scan immediately
                const cleared: Record<string, null> = {};
                for (const agentId of Object.keys(editSession.agents)) {
                  cleared[agentId] = null;
                }
                updates.lastScanTimes = cleared;
              }
              await updateSession(editingSessionId, updates);
              setEditingSessionId(null);
            }}
            orgProfile={orgProfile}
            onSaveOrgProfile={saveOrgProfile}
          />
        );
      })()}
    </div>
  );
}
