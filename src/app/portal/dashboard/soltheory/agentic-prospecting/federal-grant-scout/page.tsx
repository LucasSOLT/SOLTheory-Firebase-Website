"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft, Bot, Loader2, Plus, Trash2,
  ArrowUpRight, FileText, ChevronRight, ExternalLink
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useUser, useFirestore } from "@/firebase";
import { type AgentSlot } from "@/components/portal/GrantAgentHub";
import { GrantAgentConfigModal, type GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";
import { GrantAgentBrowserSim } from "@/components/portal/GrantAgentBrowserSim";
import { doc, getDoc, setDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { logActivity } from "@/lib/activity-logger";

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

const SLOT_ACCENT = [
  { gradient: "from-indigo-500 to-violet-600", ring: "ring-indigo-400/25", dot: "bg-indigo-500", muted: "text-indigo-600 dark:text-indigo-400" },
  { gradient: "from-emerald-500 to-teal-600", ring: "ring-emerald-400/25", dot: "bg-emerald-500", muted: "text-emerald-600 dark:text-emerald-400" },
  { gradient: "from-amber-500 to-orange-500", ring: "ring-amber-400/25", dot: "bg-amber-500", muted: "text-amber-600 dark:text-amber-400" },
  { gradient: "from-rose-500 to-pink-600", ring: "ring-rose-400/25", dot: "bg-rose-500", muted: "text-rose-600 dark:text-rose-400" },
];

const DEFAULT_NAMES = ["Global Grant Scout", "Health & Human Services", "Community Development", "Custom Agent"];

/* ═══════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════ */

export default function FederalGrantScoutDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const firestore = useFirestore();

  const orgPrefix = pathname.includes("/nxtchapter/") ? "nxtchapter" : "soltheory";
  const dash = `/portal/dashboard/${orgPrefix}`;

  const dk = isDarkMode;

  /* ── state ── */
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AgentSlot[]>(DEFAULT_NAMES.map((n, i) => ({ id: `agent_${i + 1}`, name: n, config: null, active: false })));
  const [cfgIdx, setCfgIdx] = useState<number | null>(null);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);

  /* ── load agent config ── */
  useEffect(() => {
    if (!firestore) return;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, "grant_agent_config", "soltheory"));
        if (snap.exists()) {
          const agents = snap.data().agents as Record<string, any> | undefined;
          if (agents) setSlots(p => p.map(s => { const sv = agents[s.id]; return sv ? { ...s, name: sv.name || s.name, config: sv.config || null, active: sv.active ?? false } : s; }));
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [firestore]);

  /* ── load grants ── */
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "grant_suggestions"), where("orgId", "==", "soltheory"));
    const unsub = onSnapshot(q, s => { setGrants(s.docs.map(d => ({ id: d.id, ...d.data() } as GrantRecord))); setGrantsLoading(false); }, () => setGrantsLoading(false));
    return unsub;
  }, [firestore]);

  /* ── save / clear ── */
  async function save(index: number, config: GrantAgentConfig) {
    const next = [...slots]; next[index] = { ...next[index], config, active: true }; setSlots(next); setCfgIdx(null);
    if (!firestore) return;
    const m: Record<string, any> = {}; next.forEach(s => { m[s.id] = { name: s.name, config: s.config, active: s.active }; });
    await setDoc(doc(firestore, "grant_agent_config", "soltheory"), { agents: m, updatedAt: new Date(), updatedBy: user?.uid || null }, { merge: true }).catch(() => {});
    logActivity(firestore, "grant_agent_created", { email: user?.email || "", displayName: user?.displayName }, `Created: ${slots[index]?.name}`);
  }
  async function clear(index: number) {
    const next = [...slots]; next[index] = { ...next[index], config: null, active: false }; setSlots(next);
    if (!firestore) return;
    const m: Record<string, any> = {}; next.forEach(s => { m[s.id] = { name: s.name, config: s.config, active: s.active }; });
    await setDoc(doc(firestore, "grant_agent_config", "soltheory"), { agents: m, updatedAt: new Date(), updatedBy: user?.uid || null }, { merge: true }).catch(() => {});
  }

  /* ── derived stats ── */
  const active = slots.filter(s => s.active).length;
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
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">

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
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ${dk ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
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
            { label: "Agents deployed", value: `${active}/${slots.length}` },
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

        {/* ── agent slots heading ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-[15px] font-semibold ${txt}`}>Search Agents</h2>
          <p className={`text-[12px] ${txt3}`}>{active} of {slots.length} active</p>
        </div>

        {/* ── agent slots grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className={`w-5 h-5 animate-spin ${txt3}`} /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {slots.map((slot, i) => {
              const c = SLOT_ACCENT[i];
              const on = slot.active && slot.config;
              return (
                <div
                  key={slot.id}
                  onClick={() => setCfgIdx(i)}
                  className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
                    on
                      ? `${surface} ring-1 ${c.ring}`
                      : dk
                        ? "border-dashed border-[#1e2028] bg-[#0c0d0f] hover:bg-[#111214] hover:border-[#2a2d38]"
                        : "border-dashed border-slate-200 bg-[#f7f7f5] hover:bg-white hover:border-slate-300"
                  }`}
                >
                  {on ? (
                    <>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${c.gradient} flex items-center justify-center shrink-0`}>
                            <Bot className="w-3 h-3 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[13px] font-medium truncate ${txt}`}>{slot.name}</p>
                            <p className={`text-[11px] ${txt3} truncate`}>
                              {slot.config!.locationCity && slot.config!.locationState
                                ? `${slot.config!.locationCity}, ${slot.config!.locationState}`
                                : "Scanning"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
                          <span className={`text-[10px] font-medium ${c.muted}`}>Live</span>
                        </div>
                      </div>
                      <div className="min-h-[90px] relative"><GrantAgentBrowserSim config={slot.config!} colorTheme={{ dot: c.dot, label: c.muted }} /></div>
                      {/* delete btn */}
                      <button
                        onClick={(e) => { e.stopPropagation(); clear(i); }}
                        className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer ${dk ? "bg-[#1e2028] text-slate-400 hover:text-red-400" : "bg-white border border-slate-200 text-slate-400 hover:text-red-500"}`}
                        title="Remove agent"
                      ><Trash2 className="w-3 h-3" /></button>
                      {/* edit overlay */}
                      <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none">
                        <span className={`text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${dk ? "bg-[#1e2028] text-slate-300" : "bg-white border border-slate-200 text-slate-500 shadow-sm"}`}>
                          Edit configuration
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-5 text-center min-h-[140px]">
                      <div className={`w-10 h-10 rounded-lg border border-dashed flex items-center justify-center mb-2.5 ${dk ? "border-[#2a2d38]" : "border-slate-300"}`}>
                        <Plus className={`w-4 h-4 ${txt3} group-hover:${txt2} transition-colors`} />
                      </div>
                      <p className={`text-[13px] font-medium mb-0.5 ${dk ? "text-slate-500" : "text-slate-400"}`}>{slot.name}</p>
                      <p className={`text-[11px] ${dk ? "text-slate-600" : "text-slate-300"}`}>Click to deploy</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── recent discoveries heading ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-[15px] font-semibold ${txt}`}>Recent Discoveries</h2>
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

      {/* ── config modal ── */}
      {cfgIdx !== null && (
        <GrantAgentConfigModal
          initialConfig={slots[cfgIdx].config ?? undefined}
          onClose={() => setCfgIdx(null)}
          onSave={(config) => save(cfgIdx, config)}
        />
      )}
    </div>
  );
}
