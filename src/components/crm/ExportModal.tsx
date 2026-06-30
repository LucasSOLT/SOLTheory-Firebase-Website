"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Check,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import type { ContactFieldDef, FieldConfig } from "@/lib/contactFieldTypes";

/* ─────────────── TYPES ─────────────── */

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthday: string;
  leadStatus: string;
  tags: string[];
  totalRevenue: number;
  aiNotes: string;
  outstandingBalance: number;
  company: string;
  location: string;
  lastContactedDate: string;
  createdAt?: any;
  customFields?: Record<string, any>;
}

type ExportFormat = "csv" | "pdf";
type RecordScope = "all" | "filtered" | "selected";
type SortDirection = "asc" | "desc";
type PageOrientation = "portrait" | "landscape";
type PageSize = "letter" | "a4";
type RowDensity = "compact" | "comfortable";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldConfig: FieldConfig;
  customers: Customer[];
  filteredCustomers: Customer[];
  selectedCustomers: Customer[];
  isDarkMode: boolean;
}

/* ─────────────── HELPERS ─────────────── */

/** Escape a CSV field value per RFC 4180 */
function escapeCSVField(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Get the display value for a field from a customer record */
function getFieldValue(customer: Customer, fieldId: string): string {
  // Known direct fields
  const directFields: Record<string, (c: Customer) => string> = {
    firstName: (c) => c.firstName || "",
    lastName: (c) => c.lastName || "",
    phone: (c) => c.phone || "",
    email: (c) => c.email || "",
    birthday: (c) => c.birthday || "",
    leadStatus: (c) => c.leadStatus || "",
    tags: (c) => (c.tags || []).join("; "),
    totalRevenue: (c) => c.totalRevenue?.toString() || "0",
    aiNotes: (c) => c.aiNotes || "",
    outstandingBalance: (c) => c.outstandingBalance?.toString() || "0",
    company: (c) => c.company || "",
    location: (c) => c.location || "",
    lastContactedDate: (c) => c.lastContactedDate || "",
  };

  if (directFields[fieldId]) {
    return directFields[fieldId](customer);
  }

  // Custom fields
  if (customer.customFields && customer.customFields[fieldId] !== undefined) {
    const val = customer.customFields[fieldId];
    if (Array.isArray(val)) return val.join("; ");
    return String(val);
  }

  return "";
}

/** Generate and download a CSV file */
function downloadCSV(
  customers: Customer[],
  fields: ContactFieldDef[],
  sortField: string | null,
  sortDir: SortDirection,
  filename: string,
) {
  // Sort if needed
  let sorted = [...customers];
  if (sortField) {
    sorted.sort((a, b) => {
      const va = getFieldValue(a, sortField).toLowerCase();
      const vb = getFieldValue(b, sortField).toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  // UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";

  // Header row
  const headerRow = fields.map((f) => escapeCSVField(f.label)).join(",");

  // Data rows
  const dataRows = sorted.map((customer) =>
    fields.map((f) => escapeCSVField(getFieldValue(customer, f.id))).join(",")
  );

  const csvContent = BOM + headerRow + "\r\n" + dataRows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Generate and download a PDF file */
function downloadPDF(
  customers: Customer[],
  fields: ContactFieldDef[],
  sortField: string | null,
  sortDir: SortDirection,
  groupByField: string | null,
  orientation: PageOrientation,
  pageSize: PageSize,
  density: RowDensity,
  includeSummary: boolean,
  filename: string,
  title: string,
) {
  // Sort
  let sorted = [...customers];
  if (sortField) {
    sorted.sort((a, b) => {
      const va = getFieldValue(a, sortField).toLowerCase();
      const vb = getFieldValue(b, sortField).toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  // Group
  const groups: { label: string; records: Customer[] }[] = [];
  if (groupByField) {
    const map = new Map<string, Customer[]>();
    for (const c of sorted) {
      const val = getFieldValue(c, groupByField) || "Ungrouped";
      if (!map.has(val)) map.set(val, []);
      map.get(val)!.push(c);
    }
    for (const [label, records] of map) {
      groups.push({ label, records });
    }
  } else {
    groups.push({ label: "", records: sorted });
  }

  const isLandscape = orientation === "landscape";
  const pageW = pageSize === "letter" ? (isLandscape ? 11 : 8.5) : (isLandscape ? 11.69 : 8.27);
  const pageH = pageSize === "letter" ? (isLandscape ? 8.5 : 11) : (isLandscape ? 8.27 : 11.69);

  const margin = 0.5;
  const usableW = pageW - margin * 2;
  const colW = usableW / fields.length;
  const rowH = density === "compact" ? 0.22 : 0.3;
  const headerH = 0.3;
  const fontSize = density === "compact" ? 7 : 8;
  const headerFontSize = density === "compact" ? 7.5 : 8.5;

  const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Build HTML for printing
  let html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${pageSize} ${orientation}; margin: ${margin}in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: ${fontSize}pt; }
  .report-header { text-align: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #6366f1; }
  .report-title { font-size: 16pt; font-weight: 700; color: #1e293b; }
  .report-meta { font-size: 8pt; color: #64748b; margin-top: 4px; }
  .group-header { font-size: 10pt; font-weight: 700; color: #4f46e5; margin: 14px 0 6px 0; padding: 4px 8px; background: #eef2ff; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #f1f5f9; color: #334155; font-size: ${headerFontSize}pt; font-weight: 600; padding: 6px 5px; text-align: left; border-bottom: 1.5px solid #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: ${colW}in; }
  td { padding: ${density === "compact" ? "3px 5px" : "5px 5px"}; border-bottom: 0.5px solid #e2e8f0; font-size: ${fontSize}pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: ${colW}in; }
  tr:nth-child(even) td { background: #f8fafc; }
  .summary-row { margin-top: 12px; padding: 8px 10px; background: #f1f5f9; border-radius: 6px; font-size: 8pt; color: #475569; }
  .summary-row strong { color: #1e293b; }
  .footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
</style>
</head><body>
<div class="report-header">
  <div class="report-title">${escapeHtml(title)}</div>
  <div class="report-meta">Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · ${sorted.length} record${sorted.length !== 1 ? "s" : ""} · ${fields.length} field${fields.length !== 1 ? "s" : ""}</div>
</div>`;

  for (const group of groups) {
    if (group.label) {
      html += `<div class="group-header">${escapeHtml(group.label)} (${group.records.length})</div>`;
    }
    html += `<table><thead><tr>`;
    for (const f of fields) {
      html += `<th>${f.label}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (const c of group.records) {
      html += `<tr>`;
      for (const f of fields) {
        html += `<td>${escapeHtml(getFieldValue(c, f.id))}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;
  }

  // Summary row
  if (includeSummary) {
    const revenueField = fields.find((f) => f.id === "totalRevenue");
    const balanceField = fields.find((f) => f.id === "outstandingBalance");
    const totalRevenue = sorted.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
    const totalBalance = sorted.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);

    html += `<div class="summary-row">`;
    html += `<strong>Summary:</strong> ${sorted.length} total records`;
    if (revenueField) html += ` · Total Revenue: $${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    if (balanceField) html += ` · Outstanding Balance: $${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    html += `</div>`;
  }

  html += `<div class="footer">SOLTheory CRM · Confidential</div></body></html>`;

  // Open print window
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}

/* ─────────────── COMPONENT ─────────────── */

export default function ExportModal({
  isOpen,
  onClose,
  fieldConfig,
  customers,
  filteredCustomers,
  selectedCustomers,
  isDarkMode,
}: ExportModalProps) {
  // Format
  const [format, setFormat] = useState<ExportFormat>("csv");
  // Scope
  const [scope, setScope] = useState<RecordScope>("all");
  // Field selection
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    new Set(fieldConfig.visibleFields)
  );
  const [fieldSearch, setFieldSearch] = useState("");
  // Sort
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  // PDF-specific
  const [groupByField, setGroupByField] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<PageOrientation>("landscape");
  const [pageSize, setPageSize] = useState<PageSize>("letter");
  const [density, setDensity] = useState<RowDensity>("comfortable");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [reportTitle, setReportTitle] = useState("Contacts Report");
  // Advanced toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFieldIds(new Set(fieldConfig.visibleFields));
      setFieldSearch("");
      setSortField(null);
      setSortDir("asc");
      setGroupByField(null);
      setShowAdvanced(false);
    }
  }, [isOpen, fieldConfig.visibleFields]);

  // Derived
  const allFields = fieldConfig.allFields;
  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return allFields;
    const q = fieldSearch.toLowerCase();
    return allFields.filter((f) => f.label.toLowerCase().includes(q));
  }, [allFields, fieldSearch]);

  const selectedFields = useMemo(() => {
    return fieldConfig.allFields.filter((f) => selectedFieldIds.has(f.id));
  }, [fieldConfig.allFields, selectedFieldIds]);

  const recordsToExport = useMemo(() => {
    switch (scope) {
      case "selected": return selectedCustomers;
      case "filtered": return filteredCustomers;
      default: return customers;
    }
  }, [scope, customers, filteredCustomers, selectedCustomers]);

  if (!isOpen) return null;

  const toggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedFieldIds(new Set(allFields.map((f) => f.id)));
  const deselectAll = () => setSelectedFieldIds(new Set());

  const handleExport = () => {
    if (selectedFields.length === 0) return;

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (format === "csv") {
      downloadCSV(
        recordsToExport,
        selectedFields,
        sortField,
        sortDir,
        `contacts_export_${dateStr}.csv`,
      );
    } else {
      downloadPDF(
        recordsToExport,
        selectedFields,
        sortField,
        sortDir,
        groupByField,
        orientation,
        pageSize,
        density,
        includeSummary,
        `contacts_export_${dateStr}.pdf`,
        reportTitle,
      );
    }
    onClose();
  };

  // Shared styles
  const bgModal = isDarkMode ? "bg-slate-900" : "bg-[#faf8f3]";
  const textPrimary = isDarkMode ? "text-white" : "text-slate-800";
  const textSecondary = isDarkMode ? "text-slate-400" : "text-slate-500";
  const bgCard = isDarkMode ? "bg-slate-800" : "bg-white";
  const borderColor = isDarkMode ? "border-slate-700" : "border-[#ede8da]";
  const hoverBg = isDarkMode ? "hover:bg-slate-700" : "hover:bg-slate-50";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl ${bgModal} rounded-2xl shadow-2xl border ${borderColor} overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${textPrimary}`}>Export Contacts</h2>
              <p className={`text-xs ${textSecondary} mt-0.5`}>
                {recordsToExport.length} record{recordsToExport.length !== 1 ? "s" : ""} · {selectedFieldIds.size} field{selectedFieldIds.size !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${hoverBg} ${textSecondary} transition-colors cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {/* Format selector */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider ${textSecondary} block mb-2`}>Format</label>
            <div className="flex gap-3">
              {([
                { id: "csv" as ExportFormat, label: "CSV Spreadsheet", desc: "Comma-separated values for Excel", icon: FileSpreadsheet },
                { id: "pdf" as ExportFormat, label: "PDF Document", desc: "Print-ready formatted report", icon: FileText },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    format === opt.id
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20 dark:bg-indigo-950/30 dark:border-indigo-400"
                      : `${borderColor} ${bgCard} ${hoverBg}`
                  }`}
                >
                  <opt.icon className={`w-5 h-5 shrink-0 ${format === opt.id ? "text-indigo-600" : isDarkMode ? "text-slate-400" : "text-slate-400"}`} />
                  <div className="text-left">
                    <div className={`text-sm font-semibold ${format === opt.id ? "text-indigo-700 dark:text-indigo-300" : textPrimary}`}>{opt.label}</div>
                    <div className={`text-[10px] ${textSecondary}`}>{opt.desc}</div>
                  </div>
                  {format === opt.id && <Check className="w-4 h-4 text-indigo-600 ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Record scope */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider ${textSecondary} block mb-2`}>Records to Export</label>
            <div className="flex gap-2">
              {([
                { id: "all" as RecordScope, label: "All Records", count: customers.length },
                { id: "filtered" as RecordScope, label: "Current View", count: filteredCustomers.length },
                { id: "selected" as RecordScope, label: "Selected Only", count: selectedCustomers.length },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setScope(opt.id)}
                  disabled={opt.id === "selected" && selectedCustomers.length === 0}
                  className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                    scope === opt.id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-400"
                      : `${borderColor} ${bgCard} ${textSecondary} ${hoverBg}`
                  } ${opt.id === "selected" && selectedCustomers.length === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {opt.label}
                  <span className="ml-1 text-[10px] opacity-70">({opt.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Field selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Fields to Include</label>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-[10px] font-semibold text-indigo-600 hover:underline cursor-pointer">Select All</button>
                <span className={`text-[10px] ${textSecondary}`}>·</span>
                <button onClick={deselectAll} className="text-[10px] font-semibold text-indigo-600 hover:underline cursor-pointer">Clear</button>
              </div>
            </div>
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search fields..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className={`w-full h-8 pl-9 pr-3 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-[#E5E7EB] text-slate-700"}`}
              />
            </div>
            {/* Field checkboxes */}
            <div className={`rounded-xl border ${borderColor} ${bgCard} p-2 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {filteredFields.map((field) => (
                  <label
                    key={field.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                      selectedFieldIds.has(field.id)
                        ? isDarkMode ? "bg-indigo-950/30 text-indigo-300" : "bg-indigo-50 text-indigo-700"
                        : `${hoverBg} ${textSecondary}`
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFieldIds.has(field.id)}
                      onChange={() => toggleField(field.id)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer accent-indigo-600"
                    />
                    <span className="truncate">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider ${textSecondary} block mb-2`}>Sort By</label>
            <div className="flex gap-2">
              <select
                value={sortField || ""}
                onChange={(e) => setSortField(e.target.value || null)}
                className={`flex-1 h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-[#E5E7EB] text-slate-700"}`}
              >
                <option value="">No sorting (original order)</option>
                {selectedFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                disabled={!sortField}
                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${borderColor} ${bgCard} ${hoverBg} ${!sortField ? "opacity-40" : ""}`}
                title={sortDir === "asc" ? "Ascending" : "Descending"}
              >
                <ArrowUpDown className={`w-4 h-4 ${textSecondary}`} />
              </button>
            </div>
          </div>

          {/* PDF-specific options */}
          {format === "pdf" && (
            <div className={`rounded-xl border ${borderColor} ${bgCard} p-4 space-y-4`}>
              <div className="flex items-center gap-2 mb-1">
                <SlidersHorizontal className={`w-4 h-4 ${textSecondary}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>PDF Options</span>
              </div>

              {/* Report title */}
              <div>
                <label className={`text-[11px] font-medium ${textSecondary} block mb-1`}>Report Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className={`w-full h-8 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-[#E5E7EB] text-slate-700"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Orientation */}
                <div>
                  <label className={`text-[11px] font-medium ${textSecondary} block mb-1`}>Orientation</label>
                  <div className="flex gap-1.5">
                    {(["portrait", "landscape"] as PageOrientation[]).map((o) => (
                      <button
                        key={o}
                        onClick={() => setOrientation(o)}
                        className={`flex-1 py-1.5 rounded-md border text-xs font-medium capitalize transition-all cursor-pointer ${
                          orientation === o
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-400"
                            : `${borderColor} ${textSecondary} ${hoverBg}`
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page size */}
                <div>
                  <label className={`text-[11px] font-medium ${textSecondary} block mb-1`}>Page Size</label>
                  <div className="flex gap-1.5">
                    {([{ id: "letter" as PageSize, label: "Letter" }, { id: "a4" as PageSize, label: "A4" }]).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setPageSize(s.id)}
                        className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                          pageSize === s.id
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-400"
                            : `${borderColor} ${textSecondary} ${hoverBg}`
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Density */}
                <div>
                  <label className={`text-[11px] font-medium ${textSecondary} block mb-1`}>Row Density</label>
                  <div className="flex gap-1.5">
                    {(["compact", "comfortable"] as RowDensity[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDensity(d)}
                        className={`flex-1 py-1.5 rounded-md border text-xs font-medium capitalize transition-all cursor-pointer ${
                          density === d
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-400"
                            : `${borderColor} ${textSecondary} ${hoverBg}`
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Group by */}
                <div>
                  <label className={`text-[11px] font-medium ${textSecondary} block mb-1`}>Group By</label>
                  <select
                    value={groupByField || ""}
                    onChange={(e) => setGroupByField(e.target.value || null)}
                    className={`w-full h-8 px-2 text-xs rounded-md border focus:outline-none cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-[#E5E7EB] text-slate-700"}`}
                  >
                    <option value="">None</option>
                    {selectedFields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer accent-indigo-600"
                />
                <span className={`text-xs font-medium ${textPrimary}`}>Include summary row with totals</span>
              </label>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${borderColor}`}>
          <span className={`text-xs ${textSecondary}`}>
            {recordsToExport.length} record{recordsToExport.length !== 1 ? "s" : ""}, {selectedFieldIds.size} field{selectedFieldIds.size !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg ${textSecondary} ${hoverBg} transition-colors cursor-pointer`}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedFields.length === 0}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export {format.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
