"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { logActivity } from "@/lib/activity-logger";
import { useGrantSessions } from "@/hooks/useGrantSessions";
import {
  ArrowLeft, ChevronDown, Loader2, AlertCircle, ScrollText, Search,
  Send, CheckCircle2, XCircle, Building2, Calendar, DollarSign, Tag,
  FileText, ShieldCheck, Layers, Globe, ExternalLink, Trash2, CheckSquare,
  TrendingUp, Clock, AlertTriangle, Filter, ArrowUpDown, Sparkles,
  Timer, Target, Zap, X, Download, PlusCircle, StickyNote, ClipboardCheck,
  BookOpen, Save,
} from "lucide-react";

/* ——— Types ——— */
interface GrantRecord {
  id: string;
  title: string;
  agency: string;
  amount: number | null;
  status: "unapplied" | "applied" | "approved" | "denied";
  dateSuggested: any;
  agentId?: string;
  description?: string;
  url?: string;
  openDate?: any;
  closeDate?: any;
  classification?: string;
  eligibility?: string;
  fundingInstruments?: string[];
  fundingCategories?: string[];
  grantStructures?: string[];
  fundingAgencyLevels?: string[];
  sourceWebsite?: string;
  sources?: string[];
  relevanceScore?: number | null;
  relevanceExplanation?: string | null;
  grantScope?: string;
  opportunityNumber?: string;
  searchMode?: string;
  notes?: string;
  amountRequested?: number | null;
  amountAwarded?: number | null;
  checklist?: Record<string, boolean>;
  sessionId?: string;
}

type SortOption = "relevance" | "deadline" | "amount" | "dateFound";

/* ——— Helpers ——— */
function formatCurrency(amount: number | null): string {
  if (amount == null) return "Not specified";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(ts: any): string {
  if (!ts) return "—";
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function daysUntil(ts: any): number | null {
  const d = toDate(ts);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Fix legacy mock URLs that pointed to nonexistent pages */
const URL_FIXUPS: Record<string, string> = {
  "https://www.grants.gov/search-results-detail/350421": "https://www.hudexchange.info/programs/esg/",
  "https://www.grants.gov/search-results-detail/352089": "https://www.hudexchange.info/programs/coc/",
  "https://www.grants.gov/search-results-detail/353102": "https://www.grants.gov/search-grants?keywords=youth+homelessness+demonstration",
  "https://www.samhsa.gov/grants/grant-announcements/ti-23-005": "https://www.samhsa.gov/grants",
  "https://cdola.colorado.gov/thr-grants": "https://cdola.colorado.gov/funding-opportunities",
  "https://cdola.colorado.gov/funding-programs": "https://cdola.colorado.gov/funding-opportunities",
  "https://cdola.colorado.gov/": "https://cdola.colorado.gov/funding-opportunities",
  "https://www.denvergov.org/Government/Agencies-Departments-Offices/HOST": "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Funding-Opportunities-Procurement-Resources",
  "https://www.denvergov.org/Government/Agencies-Departments-Offices/HOST/Programs-Services": "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Funding-Opportunities-Procurement-Resources",
  "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability": "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Funding-Opportunities-Procurement-Resources",
  "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Homelessness-Resolution": "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Funding-Opportunities-Procurement-Resources",
  "https://www.hud.gov/program_offices/comm_planning/home-arp": "https://www.hudexchange.info/programs/home-arp/",
  "https://coloradohealth.org/funding-opportunities": "https://coloradohealth.org/for-grantees/apply-for-funding",
  "https://coloradohealth.org/grants-and-funding": "https://coloradohealth.org/for-grantees/apply-for-funding",
  "https://coloradohealth.org/funding": "https://coloradohealth.org/for-grantees/apply-for-funding",
  "https://unitedwaydenver.org/grants": "https://unitedwaydenver.org/our-work/",
  "https://www.denvergov.org/Government/Agencies-Departments-Offices/Economic-Development": "https://www.denvergov.org/Government/Agencies-Departments-Offices/Economic-Development-Opportunity",
};

function fixGrantUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  return URL_FIXUPS[url] || url;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  approved: { label: "Approved", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  denied: { label: "Denied", bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-500" },
  applied: { label: "Applied", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  unapplied: { label: "New", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" },
};

/* ═══ Relevance Ring ═══ */
function RelevanceRing({ score }: { score: number | null }) {
  if (score == null || score <= 0) return null;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-slate-700">
        {score}%
      </span>
    </div>
  );
}

/* ═══ Deadline Badge ═══ */
function DeadlineBadge({ closeDate }: { closeDate: any }) {
  const days = daysUntil(closeDate);
  if (days == null) return <span className="text-xs text-slate-400 italic">No deadline</span>;

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
        <Clock className="w-3 h-3" /> Closed
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 animate-pulse">
        <AlertTriangle className="w-3 h-3" /> Closes today!
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 animate-pulse">
        <AlertTriangle className="w-3 h-3" /> {days}d left
      </span>
    );
  }
  if (days <= 14) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
        <Timer className="w-3 h-3" /> {days}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
      <Calendar className="w-3 h-3" /> {days}d left
    </span>
  );
}

/* ═══ Detail Field ═══ */
function DetailField({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#faf6ed] border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm text-slate-700 leading-relaxed">{value}</div>
      </div>
    </div>
  );
}

/* ═══ KPI Card ═══ */
function KpiCard({ label, value, subtitle, gradient, borderColor, textColor, icon: Icon, pulse }: {
  label: string; value: string | number; subtitle: string;
  gradient: string; borderColor: string; textColor: string;
  icon: any; pulse?: boolean;
}) {
  return (
    <div className={`${gradient} border ${borderColor} rounded-2xl p-4 relative overflow-hidden group hover:shadow-md transition-all duration-300`}>
      <div className="absolute -right-3 -top-3 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500">
        <Icon className="w-20 h-20" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold ${textColor} tabular-nums mt-0.5 ${pulse ? "animate-pulse" : ""}`}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

/* ═══ Grant Card ═══ */
function GrantCard({
  grant,
  isExpanded,
  onToggle,
  onUpdateStatus,
  onDelete,
  isSelected,
  onSelect,
  updatingId,
  onCardRef,
  onSaveNotes,
  onUpdateField,
  onToggleChecklist,
}: {
  grant: GrantRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: GrantRecord["status"]) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  updatingId: string | null;
  onCardRef?: (el: HTMLDivElement | null) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onUpdateField: (id: string, field: string, value: any) => void;
  onToggleChecklist: (id: string, itemKey: string, checked: boolean) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [localNotes, setLocalNotes] = useState(grant.notes || "");
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isExpanded]);

  const style = STATUS_STYLES[grant.status] || STATUS_STYLES.unapplied;
  const isUpdating = updatingId === grant.id;
  const days = daysUntil(grant.closeDate);
  const isUrgent = days != null && days >= 0 && days <= 3;

  // Defaults
  const description = grant.description || "A government or foundation grant opportunity identified by the automated grant search agent.";
  const classification = grant.classification || "Nonprofits 501(c)(3)";
  const eligibility = grant.eligibility || "Nonprofits with 501(c)(3) IRS Status (Other than Institutions of Higher Education)";
  const fundingInstruments = grant.fundingInstruments?.length ? grant.fundingInstruments.join(", ") : "Grant, Cooperative Agreement";
  const fundingCategories = grant.fundingCategories?.length ? grant.fundingCategories : ["Housing", "Health", "Education"];
  const grantStructures = grant.grantStructures?.length ? grant.grantStructures.join(", ") : "Project Grants, Block Grants, Categorical Grants";
  const fundingAgencyLevels = grant.fundingAgencyLevels?.length ? grant.fundingAgencyLevels : ["Federal", "State Pass-Through", "Local/Municipal"];

  const cardBorder = isUrgent
    ? "border-red-200/70 shadow-red-100/40"
    : grant.status === "approved"
    ? "border-emerald-100/70"
    : grant.status === "denied"
    ? "border-red-100/50"
    : "border-slate-100/80";

  return (
    <div
      ref={(el) => { outerRef.current = el; onCardRef?.(el); }}
      className={`bg-[#faf8f3] rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${cardBorder} ${
        isSelected ? "ring-2 ring-indigo-400/40" : ""
      }`}
    >
      {/* ── Card Header ── */}
      <div className="px-5 pt-4 pb-3 cursor-pointer group" onClick={onToggle}>
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onSelect(grant.id); }}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer accent-indigo-600"
            />
          </div>

          {/* Title & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-slate-800 leading-tight truncate group-hover:text-indigo-700 transition-colors">
                {grant.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">{grant.agency}</span>
              {/* Source badges */}
              {(grant.sources && grant.sources.length > 0) ? (
                grant.sources.map((src) => (
                  <span key={src} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-500">
                    {src}
                  </span>
                ))
              ) : grant.sourceWebsite ? (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-500">
                  {grant.sourceWebsite}
                </span>
              ) : null}
            </div>
          </div>

          {/* Relevance Ring */}
          <RelevanceRing score={grant.relevanceScore ?? null} />

          {/* Status Badge */}
          <div className="shrink-0 pt-0.5">
            <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {style.label}
            </span>
          </div>

          {/* Expand */}
          <div className="shrink-0 pt-1">
            <ChevronDown className={`w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-all duration-300 ${isExpanded ? "rotate-180" : ""}`} />
          </div>
        </div>

        {/* AI Relevance Explanation preview (if available) */}
        {grant.relevanceExplanation && !isExpanded && (
          <p className="mt-2 ml-7 text-[12px] text-indigo-500/80 italic leading-relaxed line-clamp-1">
            &ldquo;{grant.relevanceExplanation}&rdquo;
          </p>
        )}

        {/* ── Meta Strip ── */}
        <div className="mt-3 ml-7 flex items-center gap-4 flex-wrap">
          {/* Amount */}
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className={`text-[12px] font-bold tabular-nums ${grant.amount != null ? "text-slate-700" : "text-slate-400 italic"}`}>
              {formatCurrency(grant.amount)}
            </span>
          </div>

          {/* Deadline */}
          <div className="flex items-center gap-1.5">
            <DeadlineBadge closeDate={grant.closeDate} />
          </div>

          {/* Scope */}
          {grant.grantScope && (
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px] font-semibold text-violet-600">{grant.grantScope}</span>
            </div>
          )}

          {/* Opportunity # */}
          {grant.opportunityNumber && (
            <span className="text-[10px] text-slate-400 font-mono">#{grant.opportunityNumber}</span>
          )}

          {/* Date found */}
          <span className="text-[10px] text-slate-400 ml-auto hidden sm:block">
            Found {formatDate(grant.dateSuggested)}
          </span>
        </div>
      </div>

      {/* ── Quick Actions (always visible) ── */}
      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-slate-100/60 pt-2.5 ml-0">
        {fixGrantUrl(grant.url) && (
          <a
            href={fixGrantUrl(grant.url)!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold tracking-wide shadow-sm hover:shadow-md transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            Apply Now
          </a>
        )}

        {grant.status === "unapplied" && (
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "applied"); }}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold border border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-40"
          >
            <Send className="w-3 h-3" />
            Mark Applied
          </button>
        )}

        {grant.status === "applied" && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "approved"); }}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "denied"); }}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-100 transition-all cursor-pointer disabled:opacity-40"
            >
              <XCircle className="w-3 h-3" />
              Denied
            </button>
          </>
        )}

        {(grant.status === "applied" || grant.status === "approved" || grant.status === "denied") && (
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "unapplied"); }}
            disabled={isUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            Reset
          </button>
        )}

        {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${grant.title}"? This cannot be undone.`)) {
              onDelete(grant.id);
            }
          }}
          disabled={isUpdating}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-red-300 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer ml-auto disabled:opacity-40"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* ── Expandable Detail ── */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? `${height}px` : "0px" }}
      >
        <div
          ref={contentRef}
          className="border-t border-slate-100/60 px-6 py-5 bg-[#faf6ed]/30"
        >
          {/* Relevance explanation block */}
          {grant.relevanceExplanation && (
            <div className="bg-gradient-to-r from-indigo-50/80 to-violet-50/40 border border-indigo-100/80 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Why This Grant?</p>
              </div>
              <p className="text-[13px] text-indigo-700 leading-relaxed">{grant.relevanceExplanation}</p>
              {grant.relevanceScore != null && (
                <p className="text-[11px] font-bold text-indigo-400 mt-2">
                  AI Relevance: {grant.relevanceScore}% match
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left */}
            <div className="space-y-4">
              <DetailField
                icon={FileText}
                label="Description"
                value={<p className="text-[13px] text-slate-600 leading-relaxed">{description}</p>}
              />
              <DetailField icon={Building2} label="Provider" value={grant.agency} />
              <DetailField
                icon={Calendar}
                label="Key Dates"
                value={
                  <div className="flex gap-4 text-[13px]">
                    <span><span className="text-slate-400 font-medium">Open:</span> {formatDate(grant.openDate)}</span>
                    <span><span className="text-slate-400 font-medium">Close:</span> {formatDate(grant.closeDate)}</span>
                  </div>
                }
              />
              <DetailField
                icon={DollarSign}
                label="Funding Value"
                value={<span className={`text-base font-extrabold ${grant.amount != null ? "text-slate-800" : "text-slate-400 italic text-sm"}`}>{formatCurrency(grant.amount)}</span>}
              />
            </div>

            {/* Right */}
            <div className="space-y-4">
              <DetailField icon={ShieldCheck} label="Classification" value={classification} />
              <DetailField
                icon={ShieldCheck}
                label="Eligibility"
                value={<span className="text-[13px]">{eligibility}</span>}
              />
              <DetailField icon={Tag} label="Funding Instruments" value={fundingInstruments} />
              <DetailField
                icon={Layers}
                label="Funding Categories"
                value={
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {fundingCategories.map((cat) => (
                      <span key={cat} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600">
                        {cat}
                      </span>
                    ))}
                  </div>
                }
              />
              <DetailField icon={Layers} label="Grant Structures" value={grantStructures} />
              <DetailField
                icon={Globe}
                label="Funding Agency Levels"
                value={
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {fundingAgencyLevels.map((lvl) => (
                      <span key={lvl} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                        {lvl}
                      </span>
                    ))}
                  </div>
                }
              />
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="mt-5 pt-4 border-t border-slate-200/60">
            <div className="flex items-center gap-2 mb-2">
              <StickyNote className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes</span>
            </div>
            <textarea
              value={localNotes}
              onChange={(e) => {
                const val = e.target.value;
                setLocalNotes(val);
                if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
                notesTimerRef.current = setTimeout(() => onSaveNotes(grant.id, val), 500);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Add notes about this opportunity, application progress, contacts..."
              className="w-full text-[13px] text-slate-700 bg-white/80 border border-slate-200 rounded-xl p-3 resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 placeholder:text-slate-300"
              rows={2}
            />
          </div>

          {/* ── Amount Requested / Awarded ── */}
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Amount Requested</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  defaultValue={grant.amountRequested ?? ""}
                  onBlur={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    onUpdateField(grant.id, "amountRequested", val);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="0"
                  className="w-40 pl-7 pr-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            {grant.status === "approved" && (
              <div>
                <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Amount Awarded</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    defaultValue={grant.amountAwarded ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      onUpdateField(grant.id, "amountAwarded", val);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0"
                    className="w-40 pl-7 pr-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Application Readiness Checklist ── */}
          <div className="mt-5 pt-4 border-t border-slate-200/60">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Application Readiness Checklist</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {(grant.searchMode === "philanthropic"
                ? [
                    { key: "guidelines_reviewed", label: "Foundation giving guidelines reviewed" },
                    { key: "loi_drafted", label: "Letter of Inquiry (LOI) drafted" },
                    { key: "990_ready", label: "Organization's 990 tax return ready" },
                    { key: "annual_report", label: "Annual report prepared" },
                    { key: "board_list", label: "Board of directors list current" },
                    { key: "audit_current", label: "Financial audit up to date" },
                  ]
                : [
                    { key: "sam_registered", label: "SAM.gov registration active" },
                    { key: "uei_obtained", label: "Unique Entity ID (UEI) obtained" },
                    { key: "grants_gov_account", label: "Grants.gov account registered" },
                    { key: "nofo_reviewed", label: "NOFO downloaded and reviewed" },
                    { key: "sf424_prepared", label: "SF-424 form prepared" },
                    { key: "budget_drafted", label: "Budget narrative drafted" },
                    { key: "letters_of_support", label: "Letters of support obtained" },
                    { key: "board_resolution", label: "Board resolution (if required)" },
                  ]
              ).map((item) => (
                <label
                  key={item.key}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!grant.checklist?.[item.key]}
                    onChange={(e) => onToggleChecklist(grant.id, item.key, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={`text-[12px] ${grant.checklist?.[item.key] ? "text-slate-400 line-through" : "text-slate-600"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Full action buttons in expanded view */}
          <div className="mt-6 pt-5 border-t border-slate-200/60 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Update Status:</span>

            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "applied"); }}
              disabled={isUpdating || grant.status === "applied"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                grant.status === "applied" ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-[#faf8f3] border-amber-200 text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {grant.status === "applied" ? "Applied ✔" : "Mark as Applied"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "approved"); }}
              disabled={isUpdating || grant.status === "approved"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                grant.status === "approved" ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-[#faf8f3] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {grant.status === "approved" ? "Approved ✔" : "Approved / Received"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "denied"); }}
              disabled={isUpdating || grant.status === "denied"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                grant.status === "denied" ? "bg-red-100 border-red-300 text-red-800" : "bg-[#faf8f3] border-red-200 text-red-700 hover:bg-red-50"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              {grant.status === "denied" ? "Denied ✔" : "Denied"}
            </button>

            {(grant.status === "applied" || grant.status === "approved" || grant.status === "denied") && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "unapplied"); }}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-[#f2ece0] transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${grant.title}"? This cannot be undone.`)) {
                  onDelete(grant.id);
                }
              }}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>

            {isUpdating && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-1" />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Page Component — Grant Command Center
   ═══════════════════════════════════════════════════════════ */
export default function GrantStatusesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // New sort & filter state
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<string>("all");
  const [showAddGrant, setShowAddGrant] = useState(false);
  const { sessions, activeSessionId, setActiveSessionId } = useGrantSessions("soltheory");

  // Card refs for scroll-to
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  /* ═══ Firestore Listener ═══ */
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    setLoading(true);
    setError(null);

    const grantsRef = collection(firestore, "grant_suggestions");
    const q = query(grantsRef, where("orgId", "==", "soltheory"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched: GrantRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || "Untitled Grant",
            agency: data.agency || "Unknown Agency",
            amount: data.amount ?? null,
            status: (data.status as GrantRecord["status"]) || "unapplied",
            dateSuggested: data.dateSuggested || data.createdAt || null,
            agentId: data.agentId || null,
            description: data.description || null,
            openDate: data.openDate || null,
            closeDate: data.closeDate || null,
            url: data.url || null,
            classification: data.classification || null,
            eligibility: data.eligibility || null,
            fundingInstruments: data.fundingInstruments || (data.fundingInstrument ? [data.fundingInstrument] : null),
            fundingCategories: data.fundingCategories || data.activityCategories || null,
            grantStructures: data.grantStructures || null,
            fundingAgencyLevels: data.fundingAgencyLevels || data.agencyLevels || null,
            sourceWebsite: data.sourceWebsite || null,
            sources: data.sources || (data.sourceWebsite ? [data.sourceWebsite] : null),
            relevanceScore: data.relevanceScore ?? null,
            relevanceExplanation: data.relevanceExplanation || data.relevanceExplantion || null,
            grantScope: data.grantScope || null,
            opportunityNumber: data.opportunityNumber || null,
            searchMode: data.searchMode || null,
            notes: data.notes || "",
            amountRequested: data.amountRequested ?? null,
            amountAwarded: data.amountAwarded ?? null,
            checklist: data.checklist || {},
            sessionId: data.sessionId || null,
          };
        });

        // Default sort by date found
        fetched.sort((a, b) => toMs(b.dateSuggested) - toMs(a.dateSuggested));

        // Client-side session filtering (avoids composite Firestore index)
        const filtered = activeSessionId
          ? fetched.filter((g: any) => g.sessionId === activeSessionId)
          : fetched;

        setGrants(filtered);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading grant statuses:", err);
        setError("Failed to load grant records");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid, activeSessionId]);

  /* ═══ Status Update Handler ═══ */
  async function handleUpdateStatus(grantId: string, newStatus: GrantRecord["status"]) {
    if (!firestore) return;
    setUpdatingId(grantId);
    try {
      const grantRef = doc(firestore, "grant_suggestions", grantId);
      const updateData: Record<string, any> = { status: newStatus };

      if (newStatus === "applied") {
        updateData.appliedAt = Timestamp.now();
      } else if (newStatus === "approved") {
        updateData.completedAt = Timestamp.now();
      } else if (newStatus === "denied") {
        updateData.deniedAt = Timestamp.now();
      }

      await updateDoc(grantRef, updateData);
      const grantTitle = grants.find((g) => g.id === grantId)?.title || grantId;
      logActivity(firestore, "grant_status_changed", { email: user?.email || "", displayName: user?.displayName || "" }, `Changed grant "${grantTitle}" status to ${newStatus}`);
    } catch (err) {
      console.error("Failed to update grant status:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  /* ═══ Delete Handler ═══ */
  async function handleDeleteGrant(grantId: string) {
    if (!firestore) return;
    setUpdatingId(grantId);
    try {
      const grantRef = doc(firestore, "grant_suggestions", grantId);
      const grantTitle = grants.find((g) => g.id === grantId)?.title || grantId;
      await deleteDoc(grantRef);
      logActivity(firestore, "item_deleted", { email: user?.email || "", displayName: user?.displayName || "" }, `Deleted grant "${grantTitle}"`);
      if (expandedId === grantId) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete grant:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  /* ═══ Computed Values ═══ */
  const uniqueSources = useMemo(() => {
    const srcSet = new Set<string>();
    grants.forEach((g) => {
      if (g.sources) g.sources.forEach((s) => srcSet.add(s));
      else if (g.sourceWebsite) srcSet.add(g.sourceWebsite);
    });
    return Array.from(srcSet).sort();
  }, [grants]);

  const kpis = useMemo(() => {
    const totalFound = grants.length;
    const sourceCount = uniqueSources.length;
    const fundingAvailable = grants.reduce((sum, g) => sum + (g.amount || 0), 0);
    const grantsWithAmounts = grants.filter((g) => g.amount != null && g.amount > 0).length;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const closingSoon = grants.filter((g) => {
      const d = daysUntil(g.closeDate);
      return d != null && d >= 0 && d <= 14;
    }).length;
    const urgentCount = grants.filter((g) => {
      const d = daysUntil(g.closeDate);
      return d != null && d >= 0 && d <= 3;
    }).length;
    const appliedCount = grants.filter((g) => g.status === "applied").length;
    const approvedCount = grants.filter((g) => g.status === "approved").length;

    return { totalFound, sourceCount, fundingAvailable, grantsWithAmounts, closingSoon, urgentCount, appliedCount, approvedCount };
  }, [grants, uniqueSources]);

  // Deadline alerts
  const deadlineAlerts = useMemo(() => {
    return grants
      .filter((g) => {
        const d = daysUntil(g.closeDate);
        return d != null && d >= 0 && d <= 14 && g.status !== "denied";
      })
      .sort((a, b) => {
        const da = daysUntil(a.closeDate) ?? 999;
        const db = daysUntil(b.closeDate) ?? 999;
        return da - db;
      });
  }, [grants]);

  /* ═══ Filtering & Sorting ═══ */
  const processedGrants = useMemo(() => {
    let result = [...grants];

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((g) => g.status === filterStatus);
    }

    // Source filter
    if (filterSources.size > 0) {
      result = result.filter((g) => {
        const gSources = g.sources || (g.sourceWebsite ? [g.sourceWebsite] : []);
        return gSources.some((s) => filterSources.has(s));
      });
    }

    // SearchMode filter
    if (filterMode !== "all") {
      result = result.filter((g) => g.searchMode === filterMode);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.agency.toLowerCase().includes(q) ||
          (g.description && g.description.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "relevance":
          return (b.relevanceScore || 0) - (a.relevanceScore || 0);
        case "deadline": {
          const da = daysUntil(a.closeDate) ?? 99999;
          const db = daysUntil(b.closeDate) ?? 99999;
          return da - db;
        }
        case "amount":
          return (b.amount || 0) - (a.amount || 0);
        case "dateFound":
        default:
          return toMs(b.dateSuggested) - toMs(a.dateSuggested);
      }
    });

    return result;
  }, [grants, filterStatus, filterSources, filterMode, searchQuery, sortBy]);

  /* ═══ Selection Handlers ═══ */
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === processedGrants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedGrants.map((g) => g.id)));
    }
  }

  async function handleBulkDelete() {
    if (!firestore || selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} grant${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        deleteDoc(doc(firestore, "grant_suggestions", id))
      );
      await Promise.all(deletePromises);
      logActivity(firestore, "item_deleted", { email: user?.email || "", displayName: user?.displayName || "" }, `Bulk deleted ${selectedIds.size} grant(s)`);
      setSelectedIds(new Set());
      if (expandedId && selectedIds.has(expandedId)) setExpandedId(null);
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSourceFilter(src: string) {
    setFilterSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  }

  function scrollToGrant(id: string) {
    setExpandedId(id);
    setTimeout(() => {
      const el = cardRefs.current.get(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }

  /* ═══ CSV Export ═══ */
  function exportCsv() {
    const headers = ["Title", "Agency", "Amount", "Status", "Deadline", "Relevance Score", "Source URL", "Opportunity #", "Date Found", "Eligibility", "Source Type", "Notes"];
    const rows = processedGrants.map((g) => [
      `"${(g.title || "").replace(/"/g, '""')}"`,
      `"${(g.agency || "").replace(/"/g, '""')}"`,
      g.amount ?? "",
      g.status,
      g.closeDate ? formatDate(g.closeDate) : "",
      g.relevanceScore ?? "",
      g.url || "",
      g.opportunityNumber || "",
      g.dateSuggested ? formatDate(g.dateSuggested) : "",
      `"${(g.eligibility || "").replace(/"/g, '""')}"`,
      g.searchMode || "federal",
      `"${(g.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grant_pipeline_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ═══ Notes Save Handler ═══ */
  async function handleSaveNotes(grantId: string, notes: string) {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "grant_suggestions", grantId), { notes });
    } catch (err) {
      console.error("Failed to save notes:", err);
    }
  }

  /* ═══ Grant Field Update Handler ═══ */
  async function handleUpdateField(grantId: string, field: string, value: any) {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, "grant_suggestions", grantId), { [field]: value });
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  }

  /* ═══ Checklist Toggle Handler ═══ */
  async function handleToggleChecklist(grantId: string, itemKey: string, checked: boolean) {
    if (!firestore) return;
    const grant = grants.find((g) => g.id === grantId);
    const updated = { ...(grant?.checklist || {}), [itemKey]: checked };
    try {
      await updateDoc(doc(firestore, "grant_suggestions", grantId), { checklist: updated });
    } catch (err) {
      console.error("Failed to save checklist:", err);
    }
  }

  /* ═══ Add Grant Manually ═══ */
  async function handleAddGrant(data: { title: string; agency: string; amount: number | null; deadline: string; url: string; notes: string; searchMode: string }) {
    if (!firestore) return;
    try {
      const grantDoc: Record<string, any> = {
        title: data.title,
        agency: data.agency || "Manual Entry",
        amount: data.amount,
        status: "unapplied",
        orgId: "soltheory",
        agentId: "manual",
        searchMode: data.searchMode || "federal",
        dateSuggested: Timestamp.now(),
        createdAt: Timestamp.now(),
        url: data.url || "",
        notes: data.notes || "",
        sources: ["manual"],
      };
      if (data.deadline) {
        const d = new Date(data.deadline);
        if (!isNaN(d.getTime())) grantDoc.closeDate = Timestamp.fromDate(d);
      }
      await addDoc(collection(firestore, "grant_suggestions"), grantDoc);
      setShowAddGrant(false);
      logActivity(firestore, "item_created", { email: user?.email || "", displayName: user?.displayName || "" }, `Manually added grant: "${data.title}"`);
    } catch (err) {
      console.error("Failed to add grant:", err);
    }
  }

  const allSelected = processedGrants.length > 0 && selectedIds.size === processedGrants.length;

  const statusFilters = [
    { key: "all", label: "All", count: grants.length },
    { key: "unapplied", label: "New", count: grants.filter((g) => g.status === "unapplied").length },
    { key: "applied", label: "Applied", count: grants.filter((g) => g.status === "applied").length },
    { key: "approved", label: "Approved", count: grants.filter((g) => g.status === "approved").length },
    { key: "denied", label: "Denied", count: grants.filter((g) => g.status === "denied").length },
  ];

  const statusPillColors: Record<string, string> = {
    all: "bg-indigo-600 text-white border-indigo-600",
    unapplied: "bg-slate-600 text-white border-slate-600",
    applied: "bg-amber-500 text-white border-amber-500",
    approved: "bg-emerald-600 text-white border-emerald-600",
    denied: "bg-red-500 text-white border-red-500",
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#faf6ed]">
      {/* ═══ Header ═══ */}
      <div className="shrink-0 px-6 lg:px-8 pt-6 pb-2">
        <button
          onClick={() => router.push("/portal/dashboard/soltheory")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mb-4 cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Grant Command Center</h1>
              {!loading && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-500 tabular-nums">
                  {grants.length} grants
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Track, filter, and manage all grant opportunities across your organization.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddGrant(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Grant
            </button>
            <button
              onClick={exportCsv}
              disabled={processedGrants.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() => router.push("/portal/dashboard/soltheory/grant-statuses/grant-writing-guide")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Guide
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Content (scrollable) ═══ */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 pb-8">

          {/* Session Filter Pills */}
          {sessions.length > 1 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Session:</span>
              <button
                onClick={() => setActiveSessionId(null)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  !activeSessionId
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                All Sessions
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeSessionId === s.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Source Type Filter */}
          <div className="flex items-center gap-2 mb-4 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Source:</span>
            {[
              { key: "all", label: "All" },
              { key: "federal", label: "Federal" },
              { key: "philanthropic", label: "Philanthropic" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterMode === f.key
                    ? f.key === "philanthropic" ? "bg-amber-500 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="text-sm text-slate-400 font-medium">Loading grants...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-red-700 mb-1">Failed to Load</h3>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : grants.length === 0 ? (
            /* ═══ Empty State ═══ */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center mb-6 shadow-sm">
                <ScrollText className="w-12 h-12 text-indigo-300" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-700 mb-2">No Grants Yet</h3>
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
                Your grant agents haven&apos;t found any opportunities yet. Once deployed, discovered grants will appear here automatically.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/portal/dashboard/soltheory")}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Configure Search Agents
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ═══ Section 1: KPI Header Strip ═══ */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 mb-6">
                <KpiCard
                  label="Total Found"
                  value={kpis.totalFound}
                  subtitle={`from ${kpis.sourceCount} source${kpis.sourceCount !== 1 ? "s" : ""}`}
                  gradient="bg-gradient-to-br from-indigo-500/10 to-violet-500/10"
                  borderColor="border-indigo-200/50"
                  textColor="text-indigo-600"
                  icon={Target}
                />
                <KpiCard
                  label="Funding Available"
                  value={kpis.fundingAvailable > 0 ? formatCurrency(kpis.fundingAvailable) : "$0"}
                  subtitle={`${kpis.grantsWithAmounts} grants with amounts`}
                  gradient="bg-gradient-to-br from-emerald-500/10 to-teal-500/10"
                  borderColor="border-emerald-200/50"
                  textColor="text-emerald-600"
                  icon={DollarSign}
                />
                <KpiCard
                  label="Closing Soon"
                  value={kpis.closingSoon}
                  subtitle={kpis.urgentCount > 0 ? `${kpis.urgentCount} urgent (< 3 days)` : "within 14 days"}
                  gradient="bg-gradient-to-br from-amber-500/10 to-orange-500/10"
                  borderColor="border-amber-200/50"
                  textColor="text-amber-600"
                  icon={AlertTriangle}
                  pulse={kpis.urgentCount > 0}
                />
                <KpiCard
                  label="Pipeline"
                  value={`${kpis.appliedCount + kpis.approvedCount}`}
                  subtitle={`${kpis.appliedCount} applied · ${kpis.approvedCount} approved`}
                  gradient="bg-gradient-to-br from-violet-500/10 to-purple-500/10"
                  borderColor="border-violet-200/50"
                  textColor="text-violet-600"
                  icon={TrendingUp}
                />
              </div>

              {/* ═══ Section 2: Sort & Filter Toolbar ═══ */}
              <div className="bg-[#faf8f3] border border-slate-100/80 rounded-2xl p-4 mb-4 space-y-3">
                {/* Row 1: Search + Sort */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, agency, or description..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all cursor-pointer appearance-none pr-8"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.25rem" }}
                    >
                      <option value="relevance">Sort by Relevance</option>
                      <option value="deadline">Sort by Deadline</option>
                      <option value="amount">Sort by Amount</option>
                      <option value="dateFound">Sort by Date Found</option>
                    </select>
                  </div>

                  {/* Select all / count */}
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={processedGrants.length === 0}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Select All
                    </span>
                  </div>
                </div>

                {/* Row 2: Status filter pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {statusFilters.map((sf) => (
                    <button
                      key={sf.key}
                      onClick={() => setFilterStatus(sf.key)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                        filterStatus === sf.key
                          ? statusPillColors[sf.key]
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {sf.label}
                      <span className="ml-1.5 opacity-70">{sf.count}</span>
                    </button>
                  ))}

                  {/* Source filters */}
                  {uniqueSources.length > 0 && (
                    <>
                      <div className="w-px h-5 bg-slate-200 mx-1" />
                      {uniqueSources.map((src) => (
                        <button
                          key={src}
                          onClick={() => toggleSourceFilter(src)}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            filterSources.has(src)
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-white border-slate-200 text-slate-400 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-500"
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* ═══ Section 3: Deadline Alerts Banner ═══ */}
              {deadlineAlerts.length > 0 && (
                <div className="mb-4 bg-gradient-to-r from-amber-50/80 to-red-50/40 border border-amber-200/60 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                      Deadline Alerts — {deadlineAlerts.length} grant{deadlineAlerts.length !== 1 ? "s" : ""} closing soon
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {deadlineAlerts.map((g) => {
                      const d = daysUntil(g.closeDate)!;
                      const isVeryUrgent = d <= 3;
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            setFilterStatus("all");
                            scrollToGrant(g.id);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer hover:shadow-sm ${
                            isVeryUrgent
                              ? "bg-red-100/80 border border-red-200 hover:bg-red-100"
                              : "bg-white/80 border border-amber-200/60 hover:bg-amber-50"
                          }`}
                        >
                          <span className={`text-[10px] font-extrabold tabular-nums ${isVeryUrgent ? "text-red-600" : "text-amber-600"}`}>
                            {d === 0 ? "TODAY" : `${d}d`}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[180px]">{g.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══ Bulk Action Bar ═══ */}
              {selectedIds.size > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3">
                    <CheckSquare className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-700">
                      {selectedIds.size} grant{selectedIds.size !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      {bulkDeleting ? "Deleting..." : "Delete Selected"}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ Section 4: Grant Cards ═══ */}
              {processedGrants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <Search className="w-7 h-7 text-slate-300" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-500 mb-1">No Matching Grants</h3>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Try adjusting your search query or filters to find grants.
                  </p>
                  <button
                    onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterSources(new Set()); }}
                    className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {processedGrants.map((grant) => (
                    <GrantCard
                      key={grant.id}
                      grant={grant}
                      isExpanded={expandedId === grant.id}
                      onToggle={() => setExpandedId(expandedId === grant.id ? null : grant.id)}
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={handleDeleteGrant}
                      isSelected={selectedIds.has(grant.id)}
                      onSelect={toggleSelect}
                      updatingId={updatingId}
                      onCardRef={(el) => setCardRef(grant.id, el)}
                      onSaveNotes={handleSaveNotes}
                      onUpdateField={handleUpdateField}
                      onToggleChecklist={handleToggleChecklist}
                    />
                  ))}
                </div>
              )}

              {/* Results summary */}
              {processedGrants.length > 0 && (
                <div className="mt-6 text-center">
                  <p className="text-[11px] text-slate-400">
                    Showing {processedGrants.length} of {grants.length} grants
                    {filterStatus !== "all" && ` · Filtered by ${filterStatus}`}
                    {searchQuery && ` · Searching "${searchQuery}"`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ Add Grant Modal ═══ */}
      {showAddGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddGrant(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-slate-800">Add Grant Manually</h2>
              </div>
              <button onClick={() => setShowAddGrant(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const fd = new FormData(form);
                handleAddGrant({
                  title: fd.get("title") as string,
                  agency: fd.get("agency") as string,
                  amount: fd.get("amount") ? Number(fd.get("amount")) : null,
                  deadline: fd.get("deadline") as string,
                  url: fd.get("url") as string,
                  notes: fd.get("notes") as string,
                  searchMode: fd.get("searchMode") as string,
                });
              }}
              className="px-6 py-5 space-y-4"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Title *</label>
                <input name="title" required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="e.g., HUD CoC Planning Grant 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Funder / Agency</label>
                  <input name="agency" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="e.g., HUD" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Amount</label>
                  <input name="amount" type="number" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="500000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Deadline</label>
                  <input name="deadline" type="date" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Source Type</label>
                  <select name="searchMode" defaultValue="federal" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option value="federal">Federal</option>
                    <option value="philanthropic">Philanthropic</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">URL</label>
                <input name="url" type="url" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="https://www.grants.gov/..." />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y" placeholder="Any notes about this opportunity..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddGrant(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer">
                  <Save className="w-3.5 h-3.5 inline mr-1.5" />
                  Add Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
