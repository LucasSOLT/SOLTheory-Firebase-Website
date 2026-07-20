"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { Customer } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  Filter, Plus, X, Save, Trash2, ChevronDown, Star,
  Users, DollarSign, Clock, AlertTriangle, Zap, RotateCcw,
} from "lucide-react";

/* ─────────────── TYPES ─────────────── */

export interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  logic: "AND" | "OR";
  rules: FilterRule[];
}

export interface SavedSegment {
  id: string;
  name: string;
  icon?: string;
  group: FilterGroup;
  isPinned?: boolean;
}

/* ─────────────── FIELD DEFINITIONS (FALLBACK) ─────────────── */

const DEFAULT_FILTER_FIELDS = [
  { id: "firstName", label: "First Name", type: "text" },
  { id: "lastName", label: "Last Name", type: "text" },
  { id: "email", label: "Email", type: "text" },
  { id: "phone", label: "Phone", type: "text" },
  { id: "company", label: "Company", type: "text" },
  { id: "leadStatus", label: "Lead Status", type: "select", options: ["Cold Lead", "Warm Lead", "Interested", "Sale Completed"] },
  { id: "totalRevenue", label: "Revenue", type: "number" },
  { id: "outstandingBalance", label: "Outstanding Balance", type: "number" },
  { id: "tags", label: "Tags", type: "array" },
  { id: "location", label: "Location/Notes", type: "text" },
  { id: "createdAt", label: "Created Date", type: "date" },
];

type FilterFieldDef = { id: string; label: string; type: string; options?: string[] };

/** Map a ContactFieldDef.type to a FilterBuilder-compatible type */
function mapFieldType(type: string): string {
  switch (type) {
    case "email":
    case "phone":
    case "url":
      return "text";
    case "currency":
      return "number";
    case "tags":
      return "array";
    case "boolean":
      return "select";
    default:
      return type; // text, number, date, select — pass through
  }
}

const OPERATORS: Record<string, { id: string; label: string }[]> = {
  text: [
    { id: "is", label: "is" },
    { id: "is_not", label: "is not" },
    { id: "contains", label: "contains" },
    { id: "not_contains", label: "does not contain" },
    { id: "is_empty", label: "is empty" },
    { id: "is_not_empty", label: "is not empty" },
    { id: "starts_with", label: "starts with" },
  ],
  number: [
    { id: "eq", label: "equals" },
    { id: "neq", label: "not equal to" },
    { id: "gt", label: "greater than" },
    { id: "gte", label: "greater than or equal" },
    { id: "lt", label: "less than" },
    { id: "lte", label: "less than or equal" },
  ],
  select: [
    { id: "is", label: "is" },
    { id: "is_not", label: "is not" },
  ],
  array: [
    { id: "contains", label: "contains" },
    { id: "not_contains", label: "does not contain" },
    { id: "is_empty", label: "is empty" },
    { id: "is_not_empty", label: "is not empty" },
  ],
  date: [
    { id: "before", label: "before" },
    { id: "after", label: "after" },
    { id: "last_n_days", label: "in the last N days" },
    { id: "more_than_n_days", label: "more than N days ago" },
  ],
};

/* ─────────────── PRE-BUILT SEGMENTS ─────────────── */

export const PREBUILT_SEGMENTS: SavedSegment[] = [
  {
    id: "high_value",
    name: "High Value",
    icon: "DollarSign",
    group: { id: "g1", logic: "AND", rules: [{ id: "r1", field: "totalRevenue", operator: "gt", value: "5000" }] },
    isPinned: true,
  },
  {
    id: "new_this_week",
    name: "New This Week",
    icon: "Zap",
    group: { id: "g2", logic: "AND", rules: [{ id: "r2", field: "createdAt", operator: "last_n_days", value: "7" }] },
    isPinned: true,
  },
  {
    id: "no_email",
    name: "Missing Email",
    icon: "AlertTriangle",
    group: { id: "g3", logic: "AND", rules: [{ id: "r3", field: "email", operator: "is_empty", value: "" }] },
  },
  {
    id: "cold_leads",
    name: "Cold Leads",
    icon: "Users",
    group: { id: "g4", logic: "AND", rules: [{ id: "r4", field: "leadStatus", operator: "is", value: "Cold Lead" }] },
  },
  {
    id: "completed_sales",
    name: "Won Deals",
    icon: "Star",
    group: { id: "g5", logic: "AND", rules: [{ id: "r5", field: "leadStatus", operator: "is", value: "Sale Completed" }] },
  },
];

/* ─────────────── FILTER EVALUATION ─────────────── */

export function evaluateRule(customer: Customer, rule: FilterRule, fieldDefs?: FilterFieldDef[]): boolean {
  try {
    const fields = fieldDefs || DEFAULT_FILTER_FIELDS;
    const field = fields.find(f => f.id === rule.field);
    if (!field) return true;

    // Support both top-level and customFields
    let rawValue = (customer as any)[rule.field];
    if (rawValue === undefined && (customer as any).customFields) {
      rawValue = (customer as any).customFields[rule.field];
    }

    switch (field.type) {
      case "text": {
        const val = (rawValue ?? "").toString().toLowerCase();
        const target = (rule.value || "").toLowerCase();
        switch (rule.operator) {
          case "is": return val === target;
          case "is_not": return val !== target;
          case "contains": return val.includes(target);
          case "not_contains": return !val.includes(target);
          case "is_empty": return !val;
          case "is_not_empty": return !!val;
          case "starts_with": return val.startsWith(target);
          default: return true;
        }
      }
      case "number": {
        const num = typeof rawValue === "number" ? rawValue : parseFloat(rawValue ?? "0");
        const target = parseFloat(rule.value || "0");
        if (isNaN(num)) return true; // Can't evaluate, show the contact
        switch (rule.operator) {
          case "eq": return num === target;
          case "neq": return num !== target;
          case "gt": return num > target;
          case "gte": return num >= target;
          case "lt": return num < target;
          case "lte": return num <= target;
          default: return true;
        }
      }
      case "select": {
        const val = (rawValue ?? "").toString();
        switch (rule.operator) {
          case "is": return val === rule.value;
          case "is_not": return val !== rule.value;
          default: return true;
        }
      }
      case "array": {
        const arr = Array.isArray(rawValue) ? rawValue : [];
        switch (rule.operator) {
          case "contains": return arr.some(v => String(v).toLowerCase().includes((rule.value || "").toLowerCase()));
          case "not_contains": return !arr.some(v => String(v).toLowerCase().includes((rule.value || "").toLowerCase()));
          case "is_empty": return arr.length === 0;
          case "is_not_empty": return arr.length > 0;
          default: return true;
        }
      }
      case "date": {
        // Robustly handle Firestore Timestamps, Date objects, ISO strings, and epoch seconds
        let dateVal: Date | null = null;
        if (rawValue?.toDate && typeof rawValue.toDate === "function") {
          dateVal = rawValue.toDate();
        } else if (rawValue?.seconds && typeof rawValue.seconds === "number") {
          dateVal = new Date(rawValue.seconds * 1000);
        } else if (rawValue instanceof Date) {
          dateVal = rawValue;
        } else if (rawValue) {
          dateVal = new Date(rawValue);
        }
        if (!dateVal || isNaN(dateVal.getTime())) return rule.operator === "is_empty";
        const now = new Date();
        switch (rule.operator) {
          case "before": return dateVal < new Date(rule.value);
          case "after": return dateVal > new Date(rule.value);
          case "last_n_days": {
            const daysAgo = new Date();
            daysAgo.setDate(now.getDate() - parseInt(rule.value || "0"));
            return dateVal >= daysAgo;
          }
          case "more_than_n_days": {
            const daysAgo = new Date();
            daysAgo.setDate(now.getDate() - parseInt(rule.value || "0"));
            return dateVal < daysAgo;
          }
          default: return true;
        }
      }
      default: return true;
    }
  } catch (err) {
    // Never crash the UI — just show the contact if evaluation fails
    console.warn("[FilterBuilder] evaluateRule error:", err);
    return true;
  }
}

export function evaluateGroup(customer: Customer, group: FilterGroup, fieldDefs?: FilterFieldDef[]): boolean {
  if (group.rules.length === 0) return true;
  if (group.logic === "AND") return group.rules.every(r => evaluateRule(customer, r, fieldDefs));
  return group.rules.some(r => evaluateRule(customer, r, fieldDefs));
}

/* ─────────────── COMPONENT ─────────────── */

interface FilterBuilderProps {
  customers: Customer[];
  onFilterChange: (filterFn: ((c: Customer) => boolean) | null) => void;
  savedSegments: SavedSegment[];
  onSaveSegment: (segment: SavedSegment) => void;
  onDeleteSegment: (id: string) => void;
  /** Dynamic fields from useContactFields. Falls back to DEFAULT_FILTER_FIELDS if omitted. */
  availableFields?: { id: string; label: string; type: string; options?: string[] }[];
}

function FilterBuilder({ customers, onFilterChange, savedSegments, onSaveSegment, onDeleteSegment, availableFields }: FilterBuilderProps) {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({ id: "main", logic: "AND", rules: [] });
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");

  // Resolve filter fields: map dynamic fields to filter-compatible types, or use defaults
  const FILTER_FIELDS: FilterFieldDef[] = useMemo(() => {
    if (!availableFields || availableFields.length === 0) return [...DEFAULT_FILTER_FIELDS];
    return availableFields.map(f => ({
      id: f.id,
      label: f.label,
      type: mapFieldType(f.type),
      options: f.type === "boolean" ? ["true", "false"] : (f.options || (f.id === "leadStatus" ? ["Cold Lead", "Warm Lead", "Interested", "Sale Completed"] : undefined)),
    }));
  }, [availableFields]);

  const allSegments = useMemo(() => {
    const existing = new Set(savedSegments.map(s => s.id));
    const prebuilt = PREBUILT_SEGMENTS.filter(p => !existing.has(p.id));
    return [...savedSegments, ...prebuilt];
  }, [savedSegments]);

  // Count matches for each segment
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const seg of allSegments) {
      counts[seg.id] = customers.filter(c => evaluateGroup(c, seg.group, FILTER_FIELDS)).length;
    }
    return counts;
  }, [allSegments, customers]);

  // Count matches for current filter
  const currentMatchCount = useMemo(() => {
    if (filterGroup.rules.length === 0) return customers.length;
    return customers.filter(c => evaluateGroup(c, filterGroup, FILTER_FIELDS)).length;
  }, [filterGroup, customers, FILTER_FIELDS]);

  // Apply filter when group changes
  useEffect(() => {
    if (filterGroup.rules.length === 0) {
      onFilterChange(null);
    } else {
      onFilterChange((c: Customer) => evaluateGroup(c, filterGroup, FILTER_FIELDS));
    }
  }, [filterGroup, FILTER_FIELDS]);

  const addRule = () => {
    setFilterGroup(prev => ({
      ...prev,
      rules: [...prev.rules, { id: `rule-${Date.now()}`, field: "firstName", operator: "contains", value: "" }],
    }));
    setIsOpen(true);
  };

  const updateRule = (ruleId: string, updates: Partial<FilterRule>) => {
    setFilterGroup(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r),
    }));
  };

  const removeRule = (ruleId: string) => {
    setFilterGroup(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== ruleId),
    }));
  };

  const clearAll = () => {
    setFilterGroup({ id: "main", logic: "AND", rules: [] });
    setActiveSegmentId(null);
  };

  const applySegment = (segment: SavedSegment) => {
    setFilterGroup({ ...segment.group });
    setActiveSegmentId(segment.id);
    setIsOpen(true);
  };

  const handleSaveSegment = () => {
    if (!saveName.trim()) return;
    onSaveSegment({
      id: `segment-${Date.now()}`,
      name: saveName.trim(),
      group: { ...filterGroup },
    });
    setSaveName("");
    setShowSaveInput(false);
  };

  const isActive = filterGroup.rules.length > 0;

  return (
    <div className="w-full">
      {/* Segment Pills */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Segments:</span>
        {allSegments.filter(s => s.isPinned || savedSegments.some(ss => ss.id === s.id)).slice(0, 6).map(seg => (
          <button
            key={seg.id}
            onClick={() => activeSegmentId === seg.id ? clearAll() : applySegment(seg)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
              activeSegmentId === seg.id
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                : isDarkMode ? "border-slate-700 text-slate-400 hover:text-white hover:border-slate-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {seg.name}
            <span className={`text-[9px] px-1 rounded-full ${
              activeSegmentId === seg.id
                ? "bg-indigo-200 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-300"
                : isDarkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
            }`}>
              {segmentCounts[seg.id] ?? 0}
            </span>
          </button>
        ))}
        <button
          onClick={addRule}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border border-dashed transition-all cursor-pointer ${
            isDarkMode ? "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300" : "border-slate-200 text-slate-400 hover:border-slate-300"
          }`}
        >
          <Plus className="w-3 h-3" />
          Filter
        </button>
        {isActive && (
          <button onClick={clearAll} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-400 hover:text-red-500 transition-colors cursor-pointer">
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Filter Builder Panel */}
      {isOpen && filterGroup.rules.length > 0 && (
        <div className={`rounded-xl border p-4 mb-4 animate-in slide-in-from-top-2 fade-in duration-200 ${isDarkMode ? 'bg-slate-900/80 border-slate-700/60' : 'bg-[#faf8f3] border-[#ede8da]/80'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
              <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Filter Rules</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {currentMatchCount} match{currentMatchCount !== 1 ? "es" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* AND/OR toggle */}
              <div className={`flex rounded-lg border p-0.5 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                {(["AND", "OR"] as const).map(logic => (
                  <button
                    key={logic}
                    onClick={() => setFilterGroup(prev => ({ ...prev, logic }))}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      filterGroup.logic === logic
                        ? isDarkMode ? "bg-slate-600 text-white" : "bg-white text-slate-800 shadow-sm"
                        : "text-slate-400"
                    }`}
                  >
                    {logic}
                  </button>
                ))}
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-2 mb-3">
            {filterGroup.rules.map((rule, idx) => {
              const fieldDef = FILTER_FIELDS.find(f => f.id === rule.field);
              const fieldType = fieldDef?.type || "text";
              const ops = OPERATORS[fieldType] || OPERATORS.text;
              const needsValue = !["is_empty", "is_not_empty"].includes(rule.operator);

              return (
                <div key={rule.id} className="flex items-center gap-2 flex-wrap">
                  {idx > 0 && (
                    <span className={`text-[10px] font-bold w-8 text-center ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`}>{filterGroup.logic}</span>
                  )}
                  {idx === 0 && <span className="w-8 text-center text-[10px] font-bold text-slate-400">WHERE</span>}
                  <select
                    value={rule.field}
                    onChange={e => {
                      const newField = FILTER_FIELDS.find(f => f.id === e.target.value);
                      const newOps = OPERATORS[newField?.type || "text"];
                      updateRule(rule.id, { field: e.target.value, operator: newOps[0].id, value: "" });
                    }}
                    className={`text-xs rounded-lg border px-2 py-1.5 font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                  >
                  {FILTER_FIELDS.filter(f => !fieldSearch || f.label.toLowerCase().includes(fieldSearch.toLowerCase())).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <select
                    value={rule.operator}
                    onChange={e => updateRule(rule.id, { operator: e.target.value })}
                    className={`text-xs rounded-lg border px-2 py-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                  >
                    {ops.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  {needsValue && (
                    fieldDef?.type === "select" ? (
                      <select
                        value={rule.value}
                        onChange={e => updateRule(rule.id, { value: e.target.value })}
                        className={`text-xs rounded-lg border px-2 py-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                      >
                        <option value="">Select...</option>
                        {fieldDef.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={fieldDef?.type === "number" ? "number" : fieldDef?.type === "date" ? "date" : "text"}
                        value={rule.value}
                        onChange={e => updateRule(rule.id, { value: e.target.value })}
                        placeholder="value..."
                        className={`text-xs rounded-lg border px-2 py-1.5 w-32 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-400'} focus:outline-none`}
                      />
                    )
                  )}
                  <button onClick={() => removeRule(rule.id)} className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={addRule} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-dashed transition-all cursor-pointer ${isDarkMode ? 'border-slate-700 text-slate-400 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
              <Plus className="w-3 h-3" />
              Add Rule
            </button>
            <div className="flex-1" />
            {showSaveInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Segment name..."
                  className={`text-xs rounded-lg border px-2 py-1 w-32 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'} focus:outline-none`}
                  onKeyDown={e => e.key === "Enter" && handleSaveSegment()}
                  autoFocus
                />
                <button onClick={handleSaveSegment} disabled={!saveName.trim()} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold disabled:opacity-50 cursor-pointer">Save</button>
                <button onClick={() => setShowSaveInput(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button onClick={() => setShowSaveInput(true)} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                <Save className="w-3 h-3" />
                Save Segment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FilterBuilder);
