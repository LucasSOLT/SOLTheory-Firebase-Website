"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  X,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Save,
  CheckSquare,
  Square,
  ExternalLink,
  Settings2,
  RefreshCw,
} from "lucide-react";
import { useDarkMode } from "@/lib/useDarkMode";
import { useFirestore, useUser } from "@/firebase";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";

/* ─── Types ─── */

interface AgentConfig {
  welfareKeywords?: string[];
  grantTypes?: string[];
  locationState?: string;
  locationCity?: string;
  companyDescription?: string;
  eligibilityType?: string;
  budgetMin?: number;
  budgetMax?: number;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  agency: string;
  amount: number | null;
  closeDate?: string;
  opportunityNumber?: string;
  sources: string[];
  sourceUrl?: string;
  applicationUrl?: string;
  relevanceScore?: number;
  relevanceExplanation?: string;
  grantScope?: string;
  categories?: string[];
  eligibleApplicants?: string[];
  fundingInstrument?: string;
  awardAmountMax?: number | null;
}

type SourceStatus = "idle" | "searching" | "done" | "error" | "not_configured";

interface SourceProgress {
  name: string;
  displayName: string;
  status: SourceStatus;
  resultCount: number;
  error?: string;
}

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  "grants.gov": "Grants.gov",
  "sam.gov": "SAM.gov",
  usaspending: "USAspending",
  candid: "Candid",
  propublica: "ProPublica",
};

/* ─── Props ─── */
interface Props {
  onClose: () => void;
  onSearchComplete: () => void;
}

/* ─── Helpers ─── */

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "Not specified";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/* ─── Main Component ─── */

export function GrantManualSearch({ onClose, onSearchComplete }: Props) {
  const isDarkMode = useDarkMode();
  const firestore = useFirestore();
  const { user } = useUser();

  // State
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sourceProgress, setSourceProgress] = useState<SourceProgress[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [searchComplete, setSearchComplete] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Load agent config from Firestore
  useEffect(() => {
    if (!firestore) return;

    async function loadConfig() {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const configRef = doc(firestore!, "grant_agent_config", "soltheory");
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data() as AgentConfig;
          console.log("[GrantUI] Loaded agent config:", data);
          setConfig(data);
        } else {
          console.log("[GrantUI] No agent config found");
          setConfig({});
        }
      } catch (err) {
        console.error("[GrantUI] Failed to load agent config:", err);
        setConfigError("Failed to load agent configuration");
      } finally {
        setConfigLoading(false);
      }
    }

    loadConfig();
  }, [firestore]);

  // Escape key closes modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Initialize source progress
  const initSourceProgress = useCallback((): SourceProgress[] => {
    const allSources = ["grants.gov", "sam.gov", "usaspending", "candid", "propublica"];
    return allSources.map((s) => ({
      name: s,
      displayName: SOURCE_DISPLAY_NAMES[s] || s,
      status: "searching" as SourceStatus,
      resultCount: 0,
    }));
  }, []);

  // Run the search
  const handleSearch = useCallback(async () => {
    if (isSearching) return;

    console.log("[GrantUI] Starting manual grant search");
    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    setSelectedIds(new Set());
    setSavedCount(0);
    setSearchComplete(false);

    const progress = initSourceProgress();
    setSourceProgress(progress);

    try {
      const body = {
        welfareKeywords: config?.welfareKeywords || [],
        grantTypes: config?.grantTypes || [],
        locationState: config?.locationState || "",
        locationCity: config?.locationCity || "",
        companyDescription: config?.companyDescription || "",
        eligibilityType: config?.eligibilityType || "nonprofit_501c3",
        budgetMin: config?.budgetMin ?? null,
        budgetMax: config?.budgetMax ?? null,
      };

      const res = await fetch("/api/grants/search", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }

      const data = await res.json();
      const grants: SearchResult[] = (data.grants || []).map(
        (g: any): SearchResult => ({
          id: g.id || `result-${Math.random().toString(36).slice(2)}`,
          title: g.title || "Untitled Grant",
          description: g.description || "",
          agency: g.agency || "Unknown Agency",
          amount: g.awardAmountMax ?? g.amount ?? null,
          closeDate: g.closeDate || null,
          opportunityNumber: g.opportunityNumber || "",
          sources: g.sources || ["unknown"],
          sourceUrl: g.sourceUrl || "",
          applicationUrl: g.applicationUrl || "",
          relevanceScore: g.relevanceScore ?? null,
          relevanceExplanation: g.relevanceExplanation || "",
          grantScope: g.grantScope || "",
          categories: g.categories || [],
          eligibleApplicants: g.eligibleApplicants || [],
          fundingInstrument: g.fundingInstrument || "",
          awardAmountMax: g.awardAmountMax ?? null,
        })
      );

      // Update source progress from sourceStats
      const stats: Record<string, number> = data.sourceStats || {};
      setSourceProgress((prev) =>
        prev.map((sp) => {
          const count = stats[sp.name];
          if (count != null && count > 0) {
            return { ...sp, status: "done" as SourceStatus, resultCount: count };
          }
          // If zero results from this source, still mark done
          if (count === 0) {
            return { ...sp, status: "done" as SourceStatus, resultCount: 0 };
          }
          // Source not present in stats — likely not configured
          return {
            ...sp,
            status: "not_configured" as SourceStatus,
            resultCount: 0,
          };
        })
      );

      console.log(
        `[GrantUI] Search returned ${grants.length} results`
      );

      setResults(grants);
      setSearchComplete(true);
    } catch (err: any) {
      console.error("[GrantUI] Search error:", err);
      setSearchError(err.message || "Search failed");
      setSourceProgress((prev) =>
        prev.map((sp) =>
          sp.status === "searching"
            ? { ...sp, status: "error" as SourceStatus, error: "Failed" }
            : sp
        )
      );
    } finally {
      setIsSearching(false);
    }
  }, [config, isSearching, initSourceProgress]);

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all / deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.id)));
    }
  }, [results, selectedIds.size]);

  // Save grants to Firestore
  const saveGrants = useCallback(
    async (grantIds: string[]) => {
      if (!firestore || grantIds.length === 0) return;

      setIsSaving(true);
      setSavedCount(0);

      const toSave = results.filter((r) => grantIds.includes(r.id));
      console.log(`[GrantUI] Saving ${toSave.length} grants to Firestore`);

      let saved = 0;
      for (const grant of toSave) {
        try {
          await addDoc(collection(firestore, "grant_suggestions"), {
            title: grant.title,
            description: grant.description,
            agency: grant.agency,
            amount: grant.amount,
            status: "unapplied",
            orgId: "soltheory",
            url: grant.sourceUrl || grant.applicationUrl || "",
            eligibility: (grant.eligibleApplicants || []).join(", "),
            fundingInstrument: grant.fundingInstrument || "",
            activityCategories: grant.categories || [],
            grantStructures: [],
            agencyLevels: [],
            location_state: config?.locationState || "",
            location_city: config?.locationCity || "",
            sources: grant.sources || [],
            relevanceScore: grant.relevanceScore ?? null,
            relevanceExplanation: grant.relevanceExplanation || "",
            grantScope: grant.grantScope || "",
            opportunityNumber: grant.opportunityNumber || "",
            sourceWebsite: grant.sourceUrl || "",
            closeDate: grant.closeDate
              ? Timestamp.fromDate(new Date(grant.closeDate))
              : null,
            dateSuggested: Timestamp.now(),
            createdAt: Timestamp.now(),
          });
          saved++;
          setSavedCount(saved);
        } catch (err) {
          console.error(
            `[GrantUI] Failed to save grant "${grant.title}":`,
            err
          );
        }
      }

      console.log(`[GrantUI] Saved ${saved}/${toSave.length} grants`);
      setIsSaving(false);

      if (saved > 0) {
        onSearchComplete();
      }
    },
    [firestore, results, config, onSearchComplete]
  );

  const handleSaveSelected = useCallback(() => {
    saveGrants(Array.from(selectedIds));
  }, [saveGrants, selectedIds]);

  const handleSaveAll = useCallback(() => {
    saveGrants(results.map((r) => r.id));
  }, [saveGrants, results]);

  /* ─── Source status icon ─── */
  function SourceIcon({ status }: { status: SourceStatus }) {
    switch (status) {
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "searching":
        return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "not_configured":
        return (
          <Circle
            className={`w-4 h-4 ${
              isDarkMode ? "text-slate-600" : "text-slate-300"
            }`}
          />
        );
      default:
        return (
          <Clock
            className={`w-4 h-4 ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}
          />
        );
    }
  }

  function sourceStatusLabel(sp: SourceProgress): string {
    switch (sp.status) {
      case "done":
        return `${sp.resultCount} result${sp.resultCount !== 1 ? "s" : ""}`;
      case "searching":
        return "searching…";
      case "error":
        return sp.error || "failed";
      case "not_configured":
        return "not configured";
      default:
        return "waiting";
    }
  }

  /* ─── Relevance badge color ─── */
  function relevanceBadge(score: number | null | undefined) {
    if (score == null) return null;
    let bg: string, text: string;
    if (score >= 70) {
      bg = isDarkMode ? "bg-emerald-950/50 border-emerald-800" : "bg-emerald-50 border-emerald-200";
      text = isDarkMode ? "text-emerald-400" : "text-emerald-700";
    } else if (score >= 40) {
      bg = isDarkMode ? "bg-amber-950/50 border-amber-800" : "bg-amber-50 border-amber-200";
      text = isDarkMode ? "text-amber-400" : "text-amber-700";
    } else {
      bg = isDarkMode ? "bg-red-950/50 border-red-800" : "bg-red-50 border-red-200";
      text = isDarkMode ? "text-red-400" : "text-red-600";
    }
    return (
      <span
        className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${bg} ${text}`}
      >
        {score}%
      </span>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${
          isDarkMode ? "bg-black/70" : "bg-black/40"
        } backdrop-blur-sm`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-3xl max-h-[90vh] mx-4 rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode
            ? "bg-slate-900 border-slate-700"
            : "bg-[#faf6ed] border-slate-200"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? "border-slate-700" : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDarkMode ? "bg-indigo-950/50" : "bg-indigo-50"
              }`}
            >
              <Search
                className={`w-5 h-5 ${
                  isDarkMode ? "text-indigo-400" : "text-indigo-600"
                } ${isSearching ? "animate-pulse" : ""}`}
              />
            </div>
            <div>
              <h2
                className={`text-sm font-bold ${
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                }`}
              >
                Search Grants Now
              </h2>
              <p
                className={`text-[10px] font-medium ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                On-demand multi-source grant search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-slate-100 text-slate-500"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Agent Config Summary */}
          <div
            className={`rounded-xl border p-4 ${
              isDarkMode
                ? "bg-slate-800/50 border-slate-700"
                : "bg-[#faf8f3] border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Settings2
                className={`w-3.5 h-3.5 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDarkMode ? "text-slate-300" : "text-slate-400"
                }`}
              >
                Current Search Config
              </span>
            </div>

            {configLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                <span
                  className={`text-[10px] ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Loading config…
                </span>
              </div>
            ) : configError ? (
              <div className="flex items-center gap-2 py-2">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="text-[10px] text-red-500">{configError}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <ConfigField
                  label="Keywords"
                  value={
                    config?.welfareKeywords?.join(", ") || "None configured"
                  }
                  dark={isDarkMode}
                />
                <ConfigField
                  label="Grant Types"
                  value={config?.grantTypes?.join(", ") || "All types"}
                  dark={isDarkMode}
                />
                <ConfigField
                  label="Location"
                  value={
                    [config?.locationCity, config?.locationState]
                      .filter(Boolean)
                      .join(", ") || "Not specified"
                  }
                  dark={isDarkMode}
                />
                <ConfigField
                  label="Eligibility"
                  value={config?.eligibilityType || "nonprofit_501c3"}
                  dark={isDarkMode}
                />
              </div>
            )}
          </div>

          {/* Search button */}
          {!searchComplete && (
            <button
              onClick={handleSearch}
              disabled={isSearching || configLoading}
              className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isSearching || configLoading
                  ? isDarkMode
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : isDarkMode
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
              }`}
            >
              {isSearching ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" />
                  Start Search
                </span>
              )}
            </button>
          )}

          {/* Source Progress */}
          {sourceProgress.length > 0 && (
            <div
              className={`rounded-xl border p-4 ${
                isDarkMode
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-[#faf8f3] border-slate-200"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider block mb-2 ${
                  isDarkMode ? "text-slate-300" : "text-slate-400"
                }`}
              >
                Source Progress
              </span>
              <div className="space-y-1.5">
                {sourceProgress.map((sp) => (
                  <div key={sp.name} className="flex items-center gap-2">
                    <SourceIcon status={sp.status} />
                    <span
                      className={`text-[11px] font-semibold flex-1 ${
                        isDarkMode ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      {sp.displayName}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        sp.status === "done"
                          ? isDarkMode
                            ? "text-emerald-400"
                            : "text-emerald-600"
                          : sp.status === "error"
                          ? "text-red-500"
                          : isDarkMode
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      {sourceStatusLabel(sp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Error */}
          {searchError && (
            <div
              className={`rounded-xl border p-4 flex items-center gap-3 ${
                isDarkMode
                  ? "bg-red-950/30 border-red-800"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 shrink-0 ${
                  isDarkMode ? "text-red-400" : "text-red-500"
                }`}
              />
              <div>
                <p
                  className={`text-xs font-bold ${
                    isDarkMode ? "text-red-300" : "text-red-700"
                  }`}
                >
                  Search Failed
                </p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    isDarkMode ? "text-red-400" : "text-red-600"
                  }`}
                >
                  {searchError}
                </p>
              </div>
              <button
                onClick={handleSearch}
                className={`ml-auto shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  isDarkMode
                    ? "bg-red-900/50 hover:bg-red-900 text-red-300"
                    : "bg-red-100 hover:bg-red-200 text-red-700"
                }`}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div>
              {/* Results header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDarkMode ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {results.length} Result{results.length !== 1 ? "s" : ""} Found
                </span>
                <button
                  onClick={toggleSelectAll}
                  className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                    isDarkMode
                      ? "text-slate-300 hover:bg-slate-800"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {selectedIds.size === results.length ? (
                    <>
                      <CheckSquare className="w-3 h-3" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-3 h-3" /> Select All
                    </>
                  )}
                </button>
              </div>

              {/* Results cards */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {results.map((result) => {
                  const isSelected = selectedIds.has(result.id);
                  return (
                    <div
                      key={result.id}
                      onClick={() => toggleSelect(result.id)}
                      className={`group rounded-lg border px-3 py-2.5 flex items-start gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? isDarkMode
                            ? "bg-indigo-950/30 border-indigo-700"
                            : "bg-indigo-50/50 border-indigo-200"
                          : isDarkMode
                          ? "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="shrink-0 mt-0.5">
                        {isSelected ? (
                          <CheckSquare
                            className={`w-4 h-4 ${
                              isDarkMode
                                ? "text-indigo-400"
                                : "text-indigo-600"
                            }`}
                          />
                        ) : (
                          <Square
                            className={`w-4 h-4 ${
                              isDarkMode
                                ? "text-slate-600"
                                : "text-slate-300"
                            }`}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-[11px] font-bold leading-tight truncate ${
                              isDarkMode
                                ? "text-slate-100"
                                : "text-slate-800"
                            }`}
                          >
                            {result.title}
                          </p>
                          {result.sourceUrl && (
                            <a
                              href={result.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                                isDarkMode
                                  ? "text-indigo-400 hover:text-indigo-300"
                                  : "text-indigo-400 hover:text-indigo-600"
                              }`}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p
                          className={`text-[9px] mt-0.5 line-clamp-2 ${
                            isDarkMode
                              ? "text-slate-400"
                              : "text-slate-500"
                          }`}
                        >
                          {truncate(result.description, 150)}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span
                            className={`text-[8px] font-semibold ${
                              isDarkMode
                                ? "text-slate-400"
                                : "text-slate-500"
                            }`}
                          >
                            {result.agency}
                          </span>
                          <span
                            className={`text-[8px] font-semibold ${
                              result.amount != null
                                ? isDarkMode
                                  ? "text-slate-300"
                                  : "text-slate-600"
                                : isDarkMode
                                ? "text-slate-500"
                                : "text-slate-400"
                            }`}
                          >
                            {formatCurrency(result.amount)}
                          </span>
                          {result.sources?.map((src) => (
                            <span
                              key={src}
                              className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                                isDarkMode
                                  ? "bg-slate-800 border-slate-600 text-slate-400"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
                              }`}
                            >
                              {src}
                            </span>
                          ))}
                          {relevanceBadge(result.relevanceScore)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved confirmation */}
          {savedCount > 0 && !isSaving && (
            <div
              className={`rounded-xl border p-3 flex items-center gap-2 ${
                isDarkMode
                  ? "bg-emerald-950/30 border-emerald-800"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span
                className={`text-[11px] font-semibold ${
                  isDarkMode ? "text-emerald-300" : "text-emerald-700"
                }`}
              >
                {savedCount} grant{savedCount !== 1 ? "s" : ""} saved
                successfully
              </span>
            </div>
          )}
        </div>

        {/* Footer with save actions */}
        {results.length > 0 && (
          <div
            className={`px-6 py-3 border-t flex items-center justify-between shrink-0 ${
              isDarkMode ? "border-slate-700" : "border-slate-200"
            }`}
          >
            <span
              className={`text-[10px] font-medium ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {selectedIds.size} of {results.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAll}
                disabled={isSaving || results.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  isDarkMode
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Save className="w-3 h-3" />
                Save All ({results.length})
              </button>
              <button
                onClick={handleSaveSelected}
                disabled={isSaving || selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedIds.size === 0 || isSaving
                    ? isDarkMode
                      ? "bg-indigo-900/30 text-indigo-600 cursor-not-allowed"
                      : "bg-indigo-50 text-indigo-300 cursor-not-allowed"
                    : isDarkMode
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving {savedCount}…
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    Save Selected ({selectedIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Config field helper ─── */

function ConfigField({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark: boolean;
}) {
  return (
    <div>
      <span
        className={`text-[8px] font-bold uppercase tracking-wider block mb-0.5 ${
          dark ? "text-slate-500" : "text-slate-400"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-[10px] font-medium block truncate ${
          dark ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
