"use client";

import { useState, useEffect, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { logActivity } from "@/lib/activity-logger";
import {
  ArrowLeft, ChevronDown, Loader2, AlertCircle, ScrollText, Search,
  Send, CheckCircle2, XCircle, Building2, Calendar, DollarSign, Tag,
  FileText, ShieldCheck, Layers, Globe, ExternalLink, Trash2, CheckSquare,
} from "lucide-react";

/* â”€â”€â”€ Types â”€â”€â”€ */
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
}

/* â”€â”€â”€ Helpers â”€â”€â”€ */
function formatCurrency(amount: number | null): string {
  if (amount == null) return "â€”";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(ts: any): string {
  if (!ts) return "â€”";
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  approved: { label: "Approved", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  denied: { label: "Denied", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  applied: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  unapplied: { label: "Un-Applied", bg: "bg-[#faf6ed]", text: "text-slate-500", border: "border-slate-200" },
};

/* â”€â”€â”€ Detail Field Component â”€â”€â”€ */
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

/* â”€â”€â”€ Expandable Row â”€â”€â”€ */
function GrantRow({
  grant,
  isExpanded,
  onToggle,
  onUpdateStatus,
  onDelete,
  isSelected,
  onSelect,
  updatingId,
}: {
  grant: GrantRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: GrantRecord["status"]) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  updatingId: string | null;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isExpanded]);

  const style = STATUS_STYLES[grant.status] || STATUS_STYLES.unapplied;
  const cardBg =
    grant.status === "approved"
      ? "bg-emerald-50/30 border-emerald-100/60"
      : grant.status === "denied"
      ? "bg-red-50/20 border-red-100/50"
      : "bg-[#faf8f3] border-slate-100";

  const isUpdating = updatingId === grant.id;

  // Defaults for fields that may not exist in Firestore yet
  const description = grant.description || "A government or foundation grant opportunity identified by the automated grant search agent. Detailed description will be populated when the grant data source is fully integrated.";
  const classification = grant.classification || "Nonprofits 501(c)(3)";
  const eligibility = grant.eligibility || "Nonprofits with 501(c)(3) IRS Status (Other than Institutions of Higher Education)";
  const fundingInstruments = grant.fundingInstruments?.length ? grant.fundingInstruments.join(", ") : "Grant, Cooperative Agreement";
  const fundingCategories = grant.fundingCategories?.length ? grant.fundingCategories : ["Housing", "Health", "Education"];
  const grantStructures = grant.grantStructures?.length ? grant.grantStructures.join(", ") : "Project Grants, Block Grants, Categorical Grants";
  const fundingAgencyLevels = grant.fundingAgencyLevels?.length ? grant.fundingAgencyLevels : ["Federal", "State Pass-Through", "Local/Municipal"];

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Row Bar */}
      <div
        onClick={onToggle}
        className={`flex items-center px-5 py-3.5 border shadow-sm hover:shadow transition-all cursor-pointer group ${cardBg} ${
          isExpanded ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl"
        }`}
      >
        {/* Checkbox */}
        <div className="w-6 mr-2 flex items-center justify-center shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onSelect(grant.id); }}
            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer accent-indigo-600"
          />
        </div>
        <div className="flex-[3] min-w-0 pr-3">
          <p className="text-sm font-semibold text-slate-800 truncate leading-tight group-hover:text-slate-900 transition-colors">
            {grant.title}
          </p>
        </div>
        <div className="flex-[2] min-w-0 pr-3 hidden sm:block">
          <p className="text-xs text-slate-400 font-medium truncate">{grant.agency}</p>
        </div>
        <div className="w-24 text-right pr-3 hidden md:block">
          <span className="text-[11px] text-slate-400 font-medium tabular-nums">{formatDate(grant.dateSuggested)}</span>
        </div>
        <div className="w-28 text-right pr-3">
          <span className="text-sm font-bold text-slate-700 tabular-nums">{formatCurrency(grant.amount)}</span>
        </div>
        <div className="w-24 flex justify-center">
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
            {style.label}
          </span>
        </div>
        <div className="w-8 flex justify-end">
          <ChevronDown className={`w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-all ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Expandable Detail Panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out`}
        style={{ maxHeight: isExpanded ? `${height}px` : "0px" }}
      >
        <div
          ref={contentRef}
          className={`border border-t-0 rounded-b-xl px-6 py-5 ${
            grant.status === "approved"
              ? "bg-emerald-50/20 border-emerald-100/60"
              : grant.status === "denied"
              ? "bg-red-50/10 border-red-100/50"
              : "bg-[#faf6ed]/40 border-slate-100"
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left column */}
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
                value={<span className="text-base font-extrabold text-slate-800">{formatCurrency(grant.amount)}</span>}
              />
              {fixGrantUrl(grant.url) && (
                <a
                  href={fixGrantUrl(grant.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wide shadow-sm hover:shadow-md transition-all mt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Apply Now
                </a>
              )}
            </div>

            {/* Right column */}
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

          {/* â•â•â• Action Buttons â•â•â• */}
          <div className="mt-6 pt-5 border-t border-slate-200/60 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Update Status:</span>

            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "applied"); }}
              disabled={isUpdating || grant.status === "applied"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                grant.status === "applied"
                  ? "bg-amber-100 border-amber-300 text-amber-800"
                  : "bg-[#faf8f3] border-amber-200 text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {grant.status === "applied" ? "Applied âœ“" : "Mark as Applied"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "approved"); }}
              disabled={isUpdating || grant.status === "approved"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                grant.status === "approved"
                  ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                  : "bg-[#faf8f3] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {grant.status === "approved" ? "Approved âœ“" : "Approved / Received"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(grant.id, "denied"); }}
              disabled={isUpdating || grant.status === "denied"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                grant.status === "denied"
                  ? "bg-red-100 border-red-300 text-red-800"
                  : "bg-[#faf8f3] border-red-200 text-red-700 hover:bg-red-50"
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              {grant.status === "denied" ? "Denied âœ“" : "Denied"}
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

            {isUpdating && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Page Component
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
          };
        });

        fetched.sort((a, b) => {
          const aMs = a.dateSuggested
            ? typeof a.dateSuggested.toMillis === "function" ? a.dateSuggested.toMillis() : new Date(a.dateSuggested).getTime()
            : 0;
          const bMs = b.dateSuggested
            ? typeof b.dateSuggested.toMillis === "function" ? b.dateSuggested.toMillis() : new Date(b.dateSuggested).getTime()
            : 0;
          return bMs - aMs;
        });

        setGrants(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading grant statuses:", err);
        setError("Failed to load grant records");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid]);

  /* â”€â”€â”€ Status Update Handler â”€â”€â”€ */
  async function handleUpdateStatus(grantId: string, newStatus: GrantRecord["status"]) {
    if (!firestore) return;
    setUpdatingId(grantId);
    try {
      const grantRef = doc(firestore, "grant_suggestions", grantId);
      const updateData: Record<string, any> = { status: newStatus };

      // Track when status was changed
      if (newStatus === "applied") {
        updateData.appliedAt = Timestamp.now();
      } else if (newStatus === "approved") {
        updateData.completedAt = Timestamp.now();
      } else if (newStatus === "denied") {
        updateData.deniedAt = Timestamp.now();
      }

      await updateDoc(grantRef, updateData);
      const grantTitle = grants.find((g) => g.id === grantId)?.title || grantId;
      logActivity(firestore, 'grant_status_changed', { email: user?.email || '', displayName: user?.displayName || '' }, `Changed grant "${grantTitle}" status to ${newStatus}`);
    } catch (err) {
      console.error("Failed to update grant status:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  /* â”€â”€â”€ Delete Handler â”€â”€â”€ */
  async function handleDeleteGrant(grantId: string) {
    if (!firestore) return;
    setUpdatingId(grantId);
    try {
      const grantRef = doc(firestore, "grant_suggestions", grantId);
      const grantTitle = grants.find((g) => g.id === grantId)?.title || grantId;
      await deleteDoc(grantRef);
      logActivity(firestore, 'item_deleted', { email: user?.email || '', displayName: user?.displayName || '' }, `Deleted grant "${grantTitle}"`);
      // Collapse if this row was expanded
      if (expandedId === grantId) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete grant:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredGrants = searchQuery.trim()
    ? grants.filter(
        (g) =>
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.agency.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : grants;

  /* â”€â”€â”€ Selection Handlers â”€â”€â”€ */
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredGrants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGrants.map((g) => g.id)));
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
      logActivity(firestore, 'item_deleted', { email: user?.email || '', displayName: user?.displayName || '' }, `Bulk deleted ${selectedIds.size} grant(s)`);
      setSelectedIds(new Set());
      if (expandedId && selectedIds.has(expandedId)) setExpandedId(null);
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setBulkDeleting(false);
    }
  }

  const allSelected = filteredGrants.length > 0 && selectedIds.size === filteredGrants.length;

  return (
    <div className="h-full w-full flex flex-col bg-[#faf6ed]">
      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-4">
        <button
          onClick={() => router.push("/portal/dashboard/soltheory")}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Grant Statuses</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 tabular-nums">
              {filteredGrants.length} record{filteredGrants.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          All grants retrieved by active search agents across your organization.
        </p>

        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search grants by name or agency..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 shadow-sm"
          />
        </div>
      </div>

      {/* Column Headers */}
      <div className="shrink-0 px-8">
        <div className="flex items-center px-5 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <div className="w-6 mr-2 flex items-center justify-center shrink-0">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={filteredGrants.length === 0}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer accent-indigo-600"
            />
          </div>
          <div className="flex-[3] min-w-0">Grant Name</div>
          <div className="flex-[2] min-w-0 hidden sm:block">Agency</div>
          <div className="w-24 text-right hidden md:block">Date Found</div>
          <div className="w-28 text-right">Amount</div>
          <div className="w-24 text-center">Status</div>
          <div className="w-8" />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 px-8 mb-2">
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-2.5">
            <CheckSquare className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-red-700">
              {selectedIds.size} grant{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {bulkDeleting ? "Deleting..." : "Delete Selected"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <h3 className="text-sm font-bold text-red-700 mb-1">Failed to Load</h3>
            <p className="text-xs text-red-500">{error}</p>
          </div>
        ) : filteredGrants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <ScrollText className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-500 mb-1">
              {searchQuery ? "No Matching Grants" : "No Grants Retrieved Yet"}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs">
              {searchQuery
                ? "Try adjusting your search query."
                : "Once your grant search agents are deployed and find opportunities, they will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGrants.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                isExpanded={expandedId === grant.id}
                onToggle={() => setExpandedId(expandedId === grant.id ? null : grant.id)}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteGrant}
                isSelected={selectedIds.has(grant.id)}
                onSelect={toggleSelect}
                updatingId={updatingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
