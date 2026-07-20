"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Check,
  ArrowRight,
  Zap,
  Settings2,
  ChevronLeft,
  X,
  Plus,
  SkipForward,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import type { CSVFieldMatch, ContactFieldDef, MatchResult } from "@/lib/contactFieldTypes";

/* ─────────────── TYPES ─────────────── */

interface CSVFieldMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  csvHeaders: string[];
  matches: CSVFieldMatch[];
  allFields: ContactFieldDef[];
  onAutoMerge: () => void;
  onManualMerge: (mappings: Record<string, string | null>) => void;
  isDarkMode: boolean;
  /** Called when the user toggles case-sensitivity to re-run field matching */
  onRematch?: (caseSensitive: boolean) => void;
}

type ViewState = "prompt" | "manual";

/** Sentinel values for the mapping dropdown */
const CREATE_NEW = "__create_new__";
const SKIP = "__skip__";

/* ─────────────── HELPERS ─────────────── */

function matchColor(result: MatchResult) {
  switch (result) {
    case "exact":
      return { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" };
    case "fuzzy":
      return { dot: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20" };
    case "new":
      return { dot: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/20" };
  }
}

function matchLabel(result: MatchResult) {
  switch (result) {
    case "exact":
      return "Exact match";
    case "fuzzy":
      return "Similar match";
    case "new":
      return "New field";
  }
}

/* ─────────────── COMPONENT ─────────────── */

export default function CSVFieldMergeDialog({
  isOpen,
  onClose,
  csvHeaders,
  matches,
  allFields,
  onAutoMerge,
  onManualMerge,
  isDarkMode,
  onRematch,
}: CSVFieldMergeDialogProps) {
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [view, setView] = useState<ViewState>("prompt");

  // Manual mapping state: csvHeader -> selected value (fieldId | CREATE_NEW | SKIP)
  const [mappings, setMappings] = useState<Record<string, string>>({});

  /* ── Counts ── */
  const counts = useMemo(() => {
    let exact = 0;
    let fuzzy = 0;
    let newField = 0;
    for (const m of matches) {
      if (m.matchResult === "exact") exact++;
      else if (m.matchResult === "fuzzy") fuzzy++;
      else newField++;
    }
    return { exact, fuzzy, new: newField };
  }, [matches]);

  /* ── Initialise mappings when switching to manual view ── */
  function openManualView() {
    const init: Record<string, string> = {};
    for (const m of matches) {
      if (m.matchResult === "exact" && m.matchedFieldId) {
        init[m.csvHeader] = m.matchedFieldId;
      } else if (m.matchResult === "fuzzy" && m.matchedFieldId) {
        init[m.csvHeader] = m.matchedFieldId;
      } else {
        init[m.csvHeader] = CREATE_NEW;
      }
    }
    setMappings(init);
    setView("manual");
  }

  function handleApplyManual() {
    const result: Record<string, string | null> = {};
    for (const header of csvHeaders) {
      const val = mappings[header];
      if (val === SKIP) {
        result[header] = null;
      } else if (val === CREATE_NEW) {
        result[header] = null; // null signals "create new"
      } else {
        result[header] = val; // existing field ID
      }
    }
    // Differentiate skip vs create-new: pass a separate structure
    // Convention: null = create new, undefined = skip. But interface says string | null.
    // We'll use the simple convention: null for both, and let the consumer check
    // We embed the intent in the value itself to keep the interface clean.
    const finalMappings: Record<string, string | null> = {};
    for (const header of csvHeaders) {
      const val = mappings[header];
      if (val === SKIP) {
        // Skip: don't include this header in the mapping at all
        // (omitted key = skipped column)
        continue;
      } else if (val === CREATE_NEW) {
        finalMappings[header] = null;
      } else {
        finalMappings[header] = val;
      }
    }
    onManualMerge(finalMappings);
  }

  /* ── Already-mapped field IDs (to prevent double-mapping) ── */
  const usedFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const val of Object.values(mappings)) {
      if (val && val !== CREATE_NEW && val !== SKIP) ids.add(val);
    }
    return ids;
  }, [mappings]);

  function updateMapping(csvHeader: string, value: string) {
    setMappings((prev) => ({ ...prev, [csvHeader]: value }));
  }

  /* ── Reset on close ── */
  function handleClose() {
    setView("prompt");
    setMappings({});
    onClose();
  }

  if (!isOpen) return null;

  /* ─────────────── STYLE TOKENS ─────────────── */

  const bgCard = isDarkMode ? "bg-slate-900" : "bg-white";
  const bgSecondary = isDarkMode ? "bg-slate-800" : "bg-slate-50";
  const bgTertiary = isDarkMode ? "bg-slate-800/60" : "bg-[#faf8f3]";
  const textPrimary = isDarkMode ? "text-white" : "text-slate-900";
  const textSecondary = isDarkMode ? "text-slate-300" : "text-slate-600";
  const textMuted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const borderColor = isDarkMode ? "border-slate-700" : "border-slate-200";
  const hoverBg = isDarkMode ? "hover:bg-slate-700/50" : "hover:bg-slate-100";

  /* ─────────────── RENDER ─────────────── */

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl ${bgCard} overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {view === "prompt" ? (
          /* ═══════════════ VIEW 1: INITIAL PROMPT ═══════════════ */
          <>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 pt-6 pb-4`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDarkMode ? "bg-amber-500/15" : "bg-amber-50"}`}>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${textPrimary}`}>
                    Your CSV has fields not in your dashboard
                  </h2>
                  <p className={`text-sm ${textMuted} mt-0.5`}>
                    Some CSV columns don&apos;t match your current fields. Choose how to handle them below.
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg ${hoverBg} ${textMuted} transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Case Sensitivity Toggle */}
            <div className={`mx-6 mb-4 rounded-xl border p-4 flex items-center justify-between ${
              isDarkMode 
                ? "bg-slate-800/60 border-slate-700" 
                : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center gap-3">
                <Settings2 className={`w-4 h-4 ${textMuted}`} />
                <div>
                  <div className={`text-sm font-medium ${textPrimary}`}>Smart Matching</div>
                  <div className={`text-xs ${textMuted}`}>
                    {caseSensitive
                      ? '"email" won\'t match "Email" — exact casing required'
                      : '"email" will match "Email" — case-insensitive (recommended)'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !caseSensitive;
                  setCaseSensitive(next);
                  onRematch?.(next);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  !caseSensitive
                    ? 'bg-indigo-500'
                    : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
                }`}
                title={caseSensitive ? 'Enable smart matching' : 'Disable smart matching (strict mode)'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  !caseSensitive ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Summary */}
            <div className={`mx-6 mb-5 rounded-xl border ${borderColor} ${bgTertiary} p-4 space-y-2.5`}>
              {counts.exact > 0 && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15">
                    <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                  </div>
                  <span className={`text-sm ${textSecondary}`}>
                    <span className={`font-medium ${textPrimary}`}>{counts.exact} field{counts.exact !== 1 ? "s" : ""}</span> matched exactly
                  </span>
                </div>
              )}
              {counts.fuzzy > 0 && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15">
                    <HelpCircle className="w-3 h-3 text-amber-500" strokeWidth={2.5} />
                  </div>
                  <span className={`text-sm ${textSecondary}`}>
                    <span className={`font-medium ${textPrimary}`}>{counts.fuzzy} field{counts.fuzzy !== 1 ? "s" : ""}</span> have similar matches
                  </span>
                </div>
              )}
              {counts.new > 0 && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15">
                    <Sparkles className="w-3 h-3 text-blue-500" strokeWidth={2.5} />
                  </div>
                  <span className={`text-sm ${textSecondary}`}>
                    <span className={`font-medium ${textPrimary}`}>{counts.new} field{counts.new !== 1 ? "s" : ""}</span> {counts.new !== 1 ? "are" : "is"} new / unrecognized
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 space-y-3 pb-2">
              {/* Auto-merge */}
              <button
                onClick={() => {
                  onAutoMerge();
                  handleClose();
                }}
                className="w-full group flex items-center gap-4 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.99]"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/15 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">Auto-Map Everything</div>
                  <div className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                    Matched columns fill existing fields. Unrecognized columns become new fields automatically.
                    Contacts with matching emails are updated — no duplicates created.
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Manual */}
              <button
                onClick={openManualView}
                className={`w-full group flex items-center gap-4 p-4 rounded-xl border ${borderColor} ${bgSecondary} ${hoverBg} transition-all duration-200 active:scale-[0.99]`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${isDarkMode ? "bg-slate-700" : "bg-slate-200/80"}`}>
                  <Settings2 className={`w-5 h-5 ${textMuted}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className={`font-semibold text-sm ${textPrimary}`}>Review Each Column Manually</div>
                  <div className={`text-xs ${textMuted} mt-0.5 leading-relaxed`}>
                    For each CSV column, pick an existing field to merge into, create a new field, or skip it entirely.
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 ${textMuted} opacity-60 group-hover:translate-x-0.5 transition-transform`} />
              </button>
            </div>

            {/* Footer */}
            <div className={`flex justify-end px-6 py-4 mt-2`}>
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm rounded-lg ${textMuted} ${hoverBg} transition-colors`}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          /* ═══════════════ VIEW 2: MANUAL MAPPING ═══════════════ */
          <>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 pt-5 pb-4 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView("prompt")}
                  className={`p-1.5 rounded-lg ${hoverBg} ${textMuted} transition-colors`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className={`text-lg font-semibold ${textPrimary}`}>Map CSV Fields</h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg ${hoverBg} ${textMuted} transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mapping Table */}
            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
              {/* Table Header */}
              <div className={`grid grid-cols-[1fr,auto,1fr] gap-3 items-center mb-3 px-3`}>
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>CSV Column</span>
                <span className="w-6" />
                <span className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Map To</span>
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {matches.map((match) => {
                  const colors = matchColor(match.matchResult);
                  const currentValue = mappings[match.csvHeader] || CREATE_NEW;

                  return (
                    <div
                      key={match.csvHeader}
                      className={`grid grid-cols-[1fr,auto,1fr] gap-3 items-center p-3 rounded-xl border ${borderColor} ${bgTertiary} transition-colors`}
                    >
                      {/* Left: CSV Header */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${textPrimary}`}>
                            {match.csvHeader}
                          </div>
                          <div className={`text-[11px] ${colors.text}`}>
                            {matchLabel(match.matchResult)}
                            {match.matchResult === "fuzzy" && match.confidence < 1 && (
                              <span className={textMuted}> · {Math.round(match.confidence * 100)}%</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className={`w-4 h-4 shrink-0 ${textMuted}`} />

                      {/* Right: Dropdown */}
                      <div className="min-w-0">
                        <div className="relative">
                          <select
                            value={currentValue}
                            onChange={(e) => updateMapping(match.csvHeader, e.target.value)}
                            className={`w-full text-sm rounded-lg border px-3 py-2 pr-8 appearance-none cursor-pointer transition-colors truncate
                              ${isDarkMode
                                ? "bg-slate-800 border-slate-600 text-slate-200 hover:border-slate-500 focus:border-indigo-500"
                                : "bg-white border-slate-300 text-slate-800 hover:border-slate-400 focus:border-indigo-500"
                              } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                          >
                            {/* Sentinel options */}
                            <option value={CREATE_NEW}>✦ Create new column for this data</option>
                            <option value={SKIP}>⏭ Don&apos;t import this column</option>

                            {/* Separator */}
                            <option disabled>────────────</option>

                            {/* All existing fields */}
                            {allFields.map((field) => {
                              const isUsedElsewhere =
                                usedFieldIds.has(field.id) && currentValue !== field.id;
                              return (
                                <option
                                  key={field.id}
                                  value={field.id}
                                  disabled={isUsedElsewhere}
                                >
                                  {field.label}
                                  {isUsedElsewhere ? " (already mapped)" : ""}
                                </option>
                              );
                            })}
                          </select>

                          {/* Dropdown chevron */}
                          <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${textMuted}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Status indicator below dropdown */}
                        {currentValue === CREATE_NEW && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Plus className="w-3 h-3 text-blue-500" />
                            <span className="text-[11px] text-blue-600 dark:text-blue-400">
                              A new &ldquo;{match.csvHeader}&rdquo; column will be added to your CRM
                            </span>
                          </div>
                        )}
                        {currentValue === SKIP && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <SkipForward className="w-3 h-3 text-slate-400" />
                            <span className={`text-[11px] ${textMuted}`}>This column&apos;s data will NOT be imported</span>
                          </div>
                        )}
                        {currentValue !== CREATE_NEW && currentValue !== SKIP && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              Mapped to existing field
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Note */}
            <div className={`mx-6 mb-4 flex items-start gap-2 p-3 rounded-lg ${bgSecondary} border ${borderColor}`}>
              <HelpCircle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${textMuted}`} />
              <p className={`text-xs leading-relaxed ${textMuted}`}>
                <strong>How it works:</strong> Contacts with matching emails are merged (empty fields get filled in, existing data is kept). New emails create new contacts. New fields are added as Text type.
              </p>
            </div>

            {/* Footer Actions */}
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${borderColor}`}>
              <button
                onClick={handleClose}
                className={`px-4 py-2 text-sm rounded-lg ${textMuted} ${hoverBg} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyManual}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                Apply Mapping
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
