"use client";

import React, { useState, useMemo } from "react";
import { useCRMStore } from "@/stores/crm-store";
import type { Customer } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  Settings, GitBranch, Tag, Database, Keyboard,
  ChevronRight, Pencil, Trash2, Plus, X, Check,
  Download, Copy, BarChart3, Users,
} from "lucide-react";

/* ─────────────── TYPES ─────────────── */

interface CRMSettingsViewProps {
  customers: Customer[];
  onConfigurePipeline?: () => void;
  onExportAll?: () => void;
  onFindDuplicates?: () => void;
}

type SettingsSection = "general" | "pipeline" | "tags" | "data" | "shortcuts";

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
}

/* ─────────────── CONSTANTS ─────────────── */

const NAV_ITEMS: NavItem[] = [
  { id: "general",   label: "General",            icon: <Settings size={16} /> },
  { id: "pipeline",  label: "Pipeline",           icon: <GitBranch size={16} /> },
  { id: "tags",      label: "Tags",               icon: <Tag size={16} /> },
  { id: "data",      label: "Data Management",    icon: <Database size={16} /> },
  { id: "shortcuts", label: "Keyboard Shortcuts",  icon: <Keyboard size={16} /> },
];

const SHORTCUTS = [
  { keys: "⌘K",  description: "Command palette" },
  { keys: "N",   description: "New contact" },
  { keys: "/",   description: "Focus search" },
  { keys: "Esc", description: "Close panels" },
];

/* ─────────────── COMPONENT ─────────────── */

export default function CRMSettingsView({
  customers,
  onConfigurePipeline,
  onExportAll,
  onFindDuplicates,
}: CRMSettingsViewProps) {
  const { isDarkMode } = useTheme();
  const customTags = useCRMStore((s) => s.customTags);
  const setCustomTags = useCRMStore((s) => s.setCustomTags);
  const pipelineConfig = useCRMStore((s) => s.pipelineConfig);

  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  /* ── General section state ── */
  const [crmLabel, setCrmLabel] = useState("My CRM");
  const [defaultView, setDefaultView] = useState<"table" | "pipeline" | "follow-ups">("table");

  /* ── Tag editing state ── */
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  /* ── Status breakdown ── */
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    customers.forEach((c) => {
      map[c.leadStatus] = (map[c.leadStatus] || 0) + 1;
    });
    return map;
  }, [customers]);

  /* ── All tags in use across contacts ── */
  const tagsInUse = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return set;
  }, [customers]);

  /* ── Styles ── */
  const cardBg = isDarkMode ? "bg-slate-800/60" : "bg-white";
  const cardBorder = isDarkMode ? "border-slate-700" : "border-[#ede8da]";
  const mutedText = isDarkMode ? "text-slate-400" : "text-slate-500";
  const labelText = isDarkMode ? "text-slate-300" : "text-slate-700";
  const inputBg = isDarkMode
    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
    : "bg-white border-[#ede8da] text-slate-900 placeholder-slate-400";
  const hoverBg = isDarkMode ? "hover:bg-slate-700/60" : "hover:bg-slate-50";

  /* ── Tag handlers ── */
  const handleDeleteTag = (index: number) => {
    setCustomTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartEditTag = (index: number) => {
    setEditingTagIndex(index);
    setEditingTagName(customTags[index].name);
  };

  const handleSaveEditTag = () => {
    if (editingTagIndex === null || !editingTagName.trim()) return;
    setCustomTags((prev) =>
      prev.map((tag, i) =>
        i === editingTagIndex ? { ...tag, name: editingTagName.trim() } : tag
      )
    );
    setEditingTagIndex(null);
    setEditingTagName("");
  };

  const handleCancelEditTag = () => {
    setEditingTagIndex(null);
    setEditingTagName("");
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const colors = ["#64748b", "#475569", "#94a3b8", "#334155", "#71717a"];
    const color = colors[customTags.length % colors.length];
    setCustomTags((prev) => [...prev, { name: newTagName.trim(), color }]);
    setNewTagName("");
    setIsAddingTag(false);
  };

  /* ─────────────── SECTION RENDERERS ─────────────── */

  const renderGeneral = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          General Settings
        </h2>
        <p className={`text-xs mt-1 ${mutedText}`}>
          Configure your CRM display name and default view preferences.
        </p>
      </div>

      {/* CRM Label */}
      <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
        <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>
          CRM Name / Label
        </label>
        <input
          type="text"
          value={crmLabel}
          onChange={(e) => setCrmLabel(e.target.value)}
          className={`w-full max-w-sm h-8 px-3 text-sm rounded-md border outline-none transition-colors focus:ring-1 focus:ring-slate-400 ${inputBg}`}
          placeholder="e.g. SOLTheory CRM"
        />
        <p className={`text-[11px] mt-1.5 ${mutedText}`}>
          This label appears in the sidebar and page header.
        </p>
      </div>

      {/* Default View */}
      <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
        <label className={`block text-xs font-medium mb-1.5 ${labelText}`}>
          Default View
        </label>
        <p className={`text-[11px] mb-3 ${mutedText}`}>
          Choose which view opens when you navigate to the CRM.
        </p>
        <div className="flex gap-2">
          {(["table", "pipeline", "follow-ups"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setDefaultView(v)}
              className={`h-8 px-3 text-xs rounded-md border transition-colors ${
                defaultView === v
                  ? isDarkMode
                    ? "bg-white text-slate-900 border-white"
                    : "bg-slate-900 text-white border-slate-900"
                  : isDarkMode
                    ? `bg-slate-700/40 text-slate-300 border-slate-600 ${hoverBg}`
                    : `bg-white text-slate-600 border-[#ede8da] ${hoverBg}`
              }`}
            >
              {v === "table" ? "Table" : v === "pipeline" ? "Pipeline" : "Follow-ups"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPipeline = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          Pipeline Configuration
        </h2>
        <p className={`text-xs mt-1 ${mutedText}`}>
          Manage your sales pipeline stages and deal flow.
        </p>
      </div>

      <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
        {pipelineConfig ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {pipelineConfig.name}
                </p>
                <p className={`text-[11px] ${mutedText}`}>
                  {pipelineConfig.stages.length} stage{pipelineConfig.stages.length !== 1 ? "s" : ""} configured
                </p>
              </div>
              <button
                onClick={onConfigurePipeline}
                className={`h-8 px-3 text-xs rounded-md border transition-colors ${
                  isDarkMode
                    ? "bg-white text-slate-900 border-white hover:bg-slate-100"
                    : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                }`}
              >
                Configure Pipeline
              </button>
            </div>

            {/* Stage list */}
            <div className={`rounded-md border divide-y ${isDarkMode ? "border-slate-600 divide-slate-600" : "border-[#ede8da] divide-[#ede8da]"}`}>
              {pipelineConfig.stages.map((stage, i) => (
                <div
                  key={stage.id}
                  className={`flex items-center gap-3 px-3 py-2 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  <span className={`text-[10px] font-mono ${mutedText}`}>{i + 1}</span>
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="flex-1">{stage.name}</span>
                  <span className={`text-[10px] ${mutedText}`}>{stage.probability}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <GitBranch size={24} className={`mx-auto mb-2 ${mutedText}`} />
            <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              No pipeline configured yet
            </p>
            <p className={`text-[11px] mb-3 ${mutedText}`}>
              Set up stages to track your deals through the sales process.
            </p>
            <button
              onClick={onConfigurePipeline}
              className={`h-8 px-4 text-xs rounded-md transition-colors ${
                isDarkMode
                  ? "bg-white text-slate-900 hover:bg-slate-100"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              Configure Pipeline
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderTags = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Tags
          </h2>
          <p className={`text-xs mt-1 ${mutedText}`}>
            Manage tags used across your contacts. {customTags.length} tag{customTags.length !== 1 ? "s" : ""} total.
          </p>
        </div>
        {!isAddingTag && (
          <button
            onClick={() => setIsAddingTag(true)}
            className={`h-8 px-3 text-xs rounded-md border transition-colors flex items-center gap-1.5 ${
              isDarkMode
                ? "bg-white text-slate-900 border-white hover:bg-slate-100"
                : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
            }`}
          >
            <Plus size={13} />
            Add Tag
          </button>
        )}
      </div>

      {/* Add tag form */}
      {isAddingTag && (
        <div className={`rounded-lg border p-3 flex items-center gap-2 ${cardBg} ${cardBorder}`}>
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
            className={`flex-1 h-8 px-3 text-sm rounded-md border outline-none focus:ring-1 focus:ring-slate-400 ${inputBg}`}
            placeholder="Tag name…"
            autoFocus
          />
          <button
            onClick={handleAddTag}
            disabled={!newTagName.trim()}
            className="h-8 w-8 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-40"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setIsAddingTag(false); setNewTagName(""); }}
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${isDarkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tag list */}
      <div className={`rounded-lg border divide-y ${cardBg} ${cardBorder} ${isDarkMode ? "divide-slate-700" : "divide-[#ede8da]"}`}>
        {customTags.length === 0 ? (
          <div className={`px-4 py-8 text-center text-xs ${mutedText}`}>
            No tags defined. Click &quot;Add Tag&quot; to create one.
          </div>
        ) : (
          customTags.map((tag, index) => {
            const inUse = tagsInUse.has(tag.name);
            const isEditing = editingTagIndex === index;

            return (
              <div
                key={`${tag.name}-${index}`}
                className={`flex items-center gap-3 px-4 py-2.5 group ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
              >
                {/* Color dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />

                {/* Name / edit input */}
                {isEditing ? (
                  <input
                    type="text"
                    value={editingTagName}
                    onChange={(e) => setEditingTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEditTag();
                      if (e.key === "Escape") handleCancelEditTag();
                    }}
                    className={`flex-1 h-7 px-2 text-xs rounded border outline-none focus:ring-1 focus:ring-slate-400 ${inputBg}`}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-xs">{tag.name}</span>
                )}

                {/* Usage count */}
                {!isEditing && (
                  <span className={`text-[10px] ${mutedText}`}>
                    {inUse
                      ? `${customers.filter((c) => c.tags.includes(tag.name)).length} contact${customers.filter((c) => c.tags.includes(tag.name)).length !== 1 ? "s" : ""}`
                      : "unused"}
                  </span>
                )}

                {/* Actions */}
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSaveEditTag}
                      className="h-7 w-7 flex items-center justify-center rounded text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={handleCancelEditTag}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${isDarkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-400 hover:bg-slate-100"}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEditTag(index)}
                      className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}
                      title="Rename tag"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(index)}
                      className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete tag"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderDataManagement = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          Data Management
        </h2>
        <p className={`text-xs mt-1 ${mutedText}`}>
          Overview of your CRM data and bulk operations.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className={mutedText} />
            <span className={`text-[10px] uppercase tracking-wider font-medium ${mutedText}`}>
              Total Contacts
            </span>
          </div>
          <p className={`text-2xl font-semibold tabular-nums ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {customers.length}
          </p>
        </div>

        <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
          <div className="flex items-center gap-2 mb-1">
            <Tag size={14} className={mutedText} />
            <span className={`text-[10px] uppercase tracking-wider font-medium ${mutedText}`}>
              Tags Defined
            </span>
          </div>
          <p className={`text-2xl font-semibold tabular-nums ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {customTags.length}
          </p>
        </div>

        <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={14} className={mutedText} />
            <span className={`text-[10px] uppercase tracking-wider font-medium ${mutedText}`}>
              Statuses
            </span>
          </div>
          <p className={`text-2xl font-semibold tabular-nums ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {Object.keys(statusBreakdown).length}
          </p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
        <h3 className={`text-xs font-medium mb-3 ${labelText}`}>Contacts by Status</h3>
        {Object.keys(statusBreakdown).length === 0 ? (
          <p className={`text-xs ${mutedText}`}>No contacts yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(statusBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`text-xs w-32 truncate ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                      {status}
                    </span>
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDarkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                      <div
                        className={`h-full rounded-full ${isDarkMode ? "bg-slate-400" : "bg-slate-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] tabular-nums w-12 text-right ${mutedText}`}>
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`rounded-lg border p-4 ${cardBg} ${cardBorder}`}>
        <h3 className={`text-xs font-medium mb-3 ${labelText}`}>Bulk Operations</h3>
        <div className="flex gap-2">
          <button
            onClick={onExportAll}
            className={`h-8 px-3 text-xs rounded-md border transition-colors flex items-center gap-1.5 ${
              isDarkMode
                ? "bg-white text-slate-900 border-white hover:bg-slate-100"
                : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
            }`}
          >
            <Download size={13} />
            Export All Contacts
          </button>
          <button
            onClick={onFindDuplicates}
            className={`h-8 px-3 text-xs rounded-md border transition-colors flex items-center gap-1.5 ${
              isDarkMode
                ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                : "border-[#ede8da] text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Copy size={13} />
            Find Duplicates
          </button>
        </div>
      </div>
    </div>
  );

  const renderShortcuts = () => (
    <div className="space-y-6">
      <div>
        <h2 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          Keyboard Shortcuts
        </h2>
        <p className={`text-xs mt-1 ${mutedText}`}>
          Quick reference for navigating the CRM with your keyboard.
        </p>
      </div>

      <div className={`rounded-lg border divide-y ${cardBg} ${cardBorder} ${isDarkMode ? "divide-slate-700" : "divide-[#ede8da]"}`}>
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.keys}
            className={`flex items-center justify-between px-4 py-3`}
          >
            <span className={`text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              {shortcut.description}
            </span>
            <kbd
              className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 text-[11px] font-mono rounded border ${
                isDarkMode
                  ? "bg-slate-700 border-slate-600 text-slate-300"
                  : "bg-slate-50 border-[#ede8da] text-slate-600"
              }`}
            >
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>

      <p className={`text-[11px] ${mutedText}`}>
        Shortcuts are active when no input field is focused.
      </p>
    </div>
  );

  /* ─────────────── SECTION MAP ─────────────── */

  const SECTION_RENDERERS: Record<SettingsSection, () => React.ReactNode> = {
    general: renderGeneral,
    pipeline: renderPipeline,
    tags: renderTags,
    data: renderDataManagement,
    shortcuts: renderShortcuts,
  };

  /* ─────────────── RENDER ─────────────── */

  return (
    <div className="flex w-full h-full min-h-0">
      {/* Left sidebar nav */}
      <nav
        className={`w-[200px] flex-shrink-0 border-r py-4 pr-2 ${
          isDarkMode ? "border-slate-700" : "border-[#ede8da]"
        }`}
      >
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors text-left ${
                  isActive
                    ? isDarkMode
                      ? "bg-slate-700/80 text-white"
                      : "bg-slate-100 text-slate-900"
                    : isDarkMode
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight size={12} className={isDarkMode ? "text-slate-500" : "text-slate-400"} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-4">
        {SECTION_RENDERERS[activeSection]()}
      </main>
    </div>
  );
}
