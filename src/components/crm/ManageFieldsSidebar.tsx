"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, X, GripVertical, Lock, ChevronRight, ChevronDown, Plus, Trash2,
} from "lucide-react";
import type { FieldConfig, ContactFieldDef, FieldCategory, FieldType } from "@/lib/contactFieldTypes";
import { FIELD_CATEGORIES, AVAILABLE_FIELD_TYPES, createCustomField } from "@/lib/contactFieldTypes";

/* ─────────────── PROPS ─────────────── */

interface ManageFieldsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fieldConfig: FieldConfig;
  onApply: (visibleFields: string[], allFields: ContactFieldDef[]) => void;
  isDarkMode: boolean;
}

/* ─────────────── COMPONENT ─────────────── */

export default function ManageFieldsSidebar({
  isOpen,
  onClose,
  fieldConfig,
  onApply,
  isDarkMode,
}: ManageFieldsSidebarProps) {
  /* ── Local staged state ── */
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<ContactFieldDef[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<FieldCategory>>(new Set());

  /* ── Custom field modal state ── */
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<FieldType>("text");
  const [customDefaultValue, setCustomDefaultValue] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customOptions, setCustomOptions] = useState("");

  /* ── Drag state ── */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  /* ── Refs ── */
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Reset local state when sidebar opens ── */
  useEffect(() => {
    if (isOpen) {
      setVisibleFieldIds([...fieldConfig.visibleFields]);
      setAllFields([...fieldConfig.allFields]);
      setSearchQuery("");
      setExpandedCategories(new Set());
      setShowCustomModal(false);
      resetCustomForm();
      // Focus search after mount animation
      setTimeout(() => searchRef.current?.focus(), 350);
    }
  }, [isOpen, fieldConfig]);

  /* ── Reset custom form helper ── */
  const resetCustomForm = useCallback(() => {
    setCustomName("");
    setCustomType("text");
    setCustomDefaultValue("");
    setCustomDescription("");
    setCustomOptions("");
  }, []);

  /* ── Derived data ── */
  const visibleFieldDefs = useMemo(() => {
    return visibleFieldIds
      .map((id) => allFields.find((f) => f.id === id))
      .filter(Boolean) as ContactFieldDef[];
  }, [visibleFieldIds, allFields]);

  const hiddenFields = useMemo(() => {
    const visibleSet = new Set(visibleFieldIds);
    return allFields.filter((f) => !visibleSet.has(f.id));
  }, [visibleFieldIds, allFields]);

  const filteredVisibleFields = useMemo(() => {
    if (!searchQuery.trim()) return visibleFieldDefs;
    const q = searchQuery.toLowerCase();
    return visibleFieldDefs.filter((f) => f.label.toLowerCase().includes(q));
  }, [visibleFieldDefs, searchQuery]);

  const hiddenFieldsByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const map: Record<FieldCategory, ContactFieldDef[]> = {
      contact: [], company: [], general: [], financial: [], pipeline: [], social: [], communication: [], custom: [],
    };
    for (const f of hiddenFields) {
      if (q && !f.label.toLowerCase().includes(q)) continue;
      map[f.category].push(f);
    }
    return map;
  }, [hiddenFields, searchQuery]);

  /* ── Category counts (all hidden, not filtered) ── */
  const categoryTotalCounts = useMemo(() => {
    const map: Record<FieldCategory, number> = {
      contact: 0, company: 0, general: 0, financial: 0, pipeline: 0, social: 0, communication: 0, custom: 0,
    };
    for (const f of hiddenFields) {
      map[f.category]++;
    }
    return map;
  }, [hiddenFields]);

  /* ── Handlers ── */

  const toggleFieldVisibility = useCallback((fieldId: string) => {
    const field = allFields.find((f) => f.id === fieldId);
    if (field?.required) return;

    setVisibleFieldIds((prev) => {
      if (prev.includes(fieldId)) {
        return prev.filter((id) => id !== fieldId);
      } else {
        return [...prev, fieldId];
      }
    });
  }, [allFields]);

  const addFieldToVisible = useCallback((fieldId: string) => {
    setVisibleFieldIds((prev) => {
      if (prev.includes(fieldId)) return prev;
      return [...prev, fieldId];
    });
  }, []);

  const removeFieldFromVisible = useCallback((fieldId: string) => {
    const field = allFields.find((f) => f.id === fieldId);
    if (field?.required) return;
    setVisibleFieldIds((prev) => prev.filter((id) => id !== fieldId));
  }, [allFields]);

  const deleteCustomField = useCallback((fieldId: string) => {
    setAllFields((prev) => prev.filter((f) => f.id !== fieldId));
    setVisibleFieldIds((prev) => prev.filter((id) => id !== fieldId));
  }, []);

  const toggleCategory = useCallback((cat: FieldCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleCreateCustomField = useCallback(() => {
    const trimmed = customName.trim();
    if (!trimmed) return;

    const opts = customType === "select"
      ? customOptions.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const newField = createCustomField(trimmed, customType, opts);
    setAllFields((prev) => [...prev, newField]);
    setVisibleFieldIds((prev) => [...prev, newField.id]);
    resetCustomForm();
    setShowCustomModal(false);
  }, [customName, customType, customOptions, resetCustomForm]);

  const handleApply = useCallback(() => {
    onApply(visibleFieldIds, allFields);
    onClose();
  }, [visibleFieldIds, allFields, onApply, onClose]);

  /* ── Drag & Drop handlers ── */

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragOverIndex(null);
      dragCounter.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      dragCounter.current = 0;
      return;
    }
    setVisibleFieldIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  }, [dragIndex]);

  /* ── Escape key ── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCustomModal) {
          setShowCustomModal(false);
          resetCustomForm();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, showCustomModal, resetCustomForm]);

  /* ── Styles ── */
  const bg = isDarkMode ? "bg-slate-900" : "bg-white";
  const bgSecondary = isDarkMode ? "bg-slate-800" : "bg-[#faf8f3]";
  const borderColor = isDarkMode ? "border-slate-700" : "border-slate-200";
  const textPrimary = isDarkMode ? "text-slate-100" : "text-slate-800";
  const textSecondary = isDarkMode ? "text-slate-400" : "text-slate-500";
  const textMuted = isDarkMode ? "text-slate-500" : "text-slate-400";
  const inputBg = isDarkMode
    ? "bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
    : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400";
  const hoverBg = isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-50";
  const dragOverBg = isDarkMode ? "bg-indigo-950/30" : "bg-indigo-50/60";

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-[90] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />

      {/* ── Sidebar Panel ── */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 z-[95] h-full w-[420px] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${bg} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ─── Header ─── */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${borderColor}`}>
          <h2 className={`text-lg font-semibold ${textPrimary}`}>Manage fields</h2>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${textSecondary} ${hoverBg} transition-colors cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Scrollable Content ─── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Search ── */}
          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${inputBg}`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center ${textMuted} hover:text-slate-600 transition-colors cursor-pointer`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* ── Fields in table ── */}
          <div className="px-5 pt-3 pb-1">
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${textSecondary} mb-2`}>
              Fields in table
              <span className={`ml-2 ${textMuted} font-normal`}>({visibleFieldIds.length})</span>
            </h3>
          </div>

          <div className="px-3">
            {filteredVisibleFields.length === 0 && searchQuery.trim() ? (
              <p className={`text-sm ${textMuted} text-center py-4`}>No matching fields</p>
            ) : (
              filteredVisibleFields.map((field) => {
                const actualIndex = visibleFieldIds.indexOf(field.id);
                const isBeingDragged = dragIndex === actualIndex;
                const isDragOver = dragOverIndex === actualIndex;

                return (
                  <div
                    key={field.id}
                    draggable={!searchQuery.trim()}
                    onDragStart={(e) => handleDragStart(e, actualIndex)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => handleDragEnter(e, actualIndex)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, actualIndex)}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg mb-0.5 select-none transition-colors group ${
                      isBeingDragged ? "opacity-40" : ""
                    } ${isDragOver ? dragOverBg : ""} ${hoverBg}`}
                  >
                    {/* Drag handle */}
                    <div
                      className={`flex-shrink-0 cursor-grab active:cursor-grabbing ${textMuted} transition-colors`}
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Checkbox */}
                    <button
                      onClick={() => toggleFieldVisibility(field.id)}
                      disabled={field.required}
                      className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        field.required
                          ? isDarkMode
                            ? "bg-indigo-500/60 border-indigo-400/60 cursor-not-allowed"
                            : "bg-indigo-400/60 border-indigo-300/60 cursor-not-allowed"
                          : isDarkMode
                            ? "bg-indigo-500 border-indigo-400 cursor-pointer hover:bg-indigo-400"
                            : "bg-indigo-500 border-indigo-500 cursor-pointer hover:bg-indigo-600"
                      }`}
                    >
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {/* Field label */}
                    <span className={`text-[14px] flex-1 truncate ${textPrimary}`}>{field.label}</span>

                    {/* Lock or remove */}
                    {field.required ? (
                      <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${textMuted}`} />
                    ) : (
                      <button
                        onClick={() => removeFieldFromVisible(field.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${textMuted} hover:text-red-500 cursor-pointer`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Add fields section ── */}
          <div className={`px-5 pt-5 pb-1 border-t ${borderColor} mt-3`}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>
              Add fields
            </h3>
          </div>

          <div className="px-3 pb-2">
            {FIELD_CATEGORIES.map((cat) => {
              const isExpanded = expandedCategories.has(cat.id);
              const fields = hiddenFieldsByCategory[cat.id];
              const count = categoryTotalCounts[cat.id];

              return (
                <div key={cat.id} className="mb-0.5">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2.5 w-full px-3 py-3 rounded-xl text-left transition-colors cursor-pointer ${hoverBg}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
                    ) : (
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
                    )}
                    <span className={`text-base font-semibold flex-1 ${textPrimary}`}>{cat.label}</span>
                    <span
                      className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${
                        isDarkMode
                          ? "bg-slate-700/80 text-slate-300"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Expanded fields */}
                  {isExpanded && (
                    <div className="ml-6 mb-1">
                      {fields.length === 0 ? (
                        <p className={`text-[13px] ${textMuted} py-2.5 px-2`}>
                          {searchQuery.trim()
                            ? "No matching fields"
                            : cat.id === "custom"
                              ? "No custom fields yet"
                              : "All fields added"}
                        </p>
                      ) : (
                        fields.map((field) => (
                          <div
                            key={field.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors group ${hoverBg}`}
                          >
                            <span className={`text-[14px] flex-1 truncate ${textSecondary}`}>{field.label}</span>

                            {/* Delete custom field */}
                            {!field.locked && field.category === "custom" && (
                              <button
                                onClick={() => deleteCustomField(field.id)}
                                className={`w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${textMuted} hover:text-red-500 cursor-pointer`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}

                            {/* Add button */}
                            <button
                              onClick={() => addFieldToVisible(field.id)}
                              className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
                                isDarkMode
                                  ? "text-indigo-400 hover:bg-indigo-950/50 hover:text-indigo-300"
                                  : "text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Add custom field button ── */}
          <div className={`px-5 pb-4 border-t ${borderColor} mt-1 pt-3`}>
            <button
              onClick={() => setShowCustomModal(true)}
              className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                isDarkMode
                  ? "text-indigo-400 hover:text-indigo-300"
                  : "text-indigo-600 hover:text-indigo-700"
              }`}
            >
              <Plus className="w-4 h-4" />
              Add custom field
            </button>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className={`flex items-center gap-3 px-5 py-4 border-t ${borderColor}`}>
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
              isDarkMode
                ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>

      {/* ── Custom Field Modal ── */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCustomModal(false);
              resetCustomForm();
            }
          }}
        >
          {/* Modal backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal content */}
          <div
            className={`relative max-w-md w-full mx-4 rounded-2xl shadow-2xl ${
              isDarkMode ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"
            }`}
          >
            {/* Modal header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Create Custom Field</h3>
              <button
                onClick={() => {
                  setShowCustomModal(false);
                  resetCustomForm();
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${textSecondary} ${hoverBg} transition-colors cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Field Name */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>
                  Field Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Referral Source"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className={`w-full px-3 h-11 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${inputBg}`}
                  autoFocus
                />
              </div>

              {/* Field Type */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>
                  Field Type
                </label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as FieldType)}
                  className={`w-full px-3 h-11 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 cursor-pointer ${inputBg}`}
                >
                  {AVAILABLE_FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Options (only for select type) */}
              {customType === "select" && (
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>
                    Dropdown Options
                  </label>
                  <input
                    type="text"
                    placeholder="Option 1, Option 2, Option 3..."
                    value={customOptions}
                    onChange={(e) => setCustomOptions(e.target.value)}
                    className={`w-full px-3 h-11 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${inputBg}`}
                  />
                </div>
              )}

              {/* Default Value */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>
                  Default Value <span className={textMuted}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave blank for no default"
                  value={customDefaultValue}
                  onChange={(e) => setCustomDefaultValue(e.target.value)}
                  className={`w-full px-3 h-11 text-sm rounded-lg border outline-none transition-colors focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${inputBg}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${textPrimary}`}>
                  Description <span className={textMuted}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe what this field is for..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors resize-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${inputBg}`}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${borderColor}`}>
              <button
                onClick={() => {
                  setShowCustomModal(false);
                  resetCustomForm();
                }}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  isDarkMode
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomField}
                disabled={!customName.trim()}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                  customName.trim()
                    ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm"
                    : isDarkMode
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                Create Field
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
