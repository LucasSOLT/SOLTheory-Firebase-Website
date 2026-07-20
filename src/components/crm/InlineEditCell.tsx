"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Check, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldDef {
  id: string;
  label: string;
  type: string;
  options?: string[];
}

interface InlineEditCellProps {
  field: FieldDef;
  value: any;
  contactId: string;
  isDarkMode: boolean;
  /** RBAC — if false, cell is display-only */
  canEdit: boolean;
  onSave: (contactId: string, fieldId: string, newValue: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Lead-status pill colour map (matches BulkActionsBar / PipelineBoard)
// ---------------------------------------------------------------------------

const LEAD_STATUS_STYLES: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  "Cold Lead":       { bg: "bg-blue-100",    text: "text-blue-700",    darkBg: "bg-blue-900/30",    darkText: "text-blue-300" },
  "Warm Lead":       { bg: "bg-amber-100",   text: "text-amber-700",   darkBg: "bg-amber-900/30",   darkText: "text-amber-300" },
  "Interested":      { bg: "bg-violet-100",  text: "text-violet-700",  darkBg: "bg-violet-900/30",  darkText: "text-violet-300" },
  "Sale Completed":  { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "bg-emerald-900/30", darkText: "text-emerald-300" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as $X,XXX.XX */
function formatCurrency(val: any): string {
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return "—";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format an ISO / timestamp to "Mon DD, YYYY" */
function formatDate(val: any): string {
  if (!val) return "—";
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Convert a value to a plain string for the input */
function toInputDateString(val: any): string {
  if (!val) return "";
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InlineEditCell = React.memo(function InlineEditCell({
  field,
  value,
  contactId,
  isDarkMode,
  canEdit,
  onSave,
  className = "",
  style,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<any>(value);
  // Brief green flash after a successful save
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Sync external value changes when not editing
  useEffect(() => {
    if (!isEditing) setEditValue(value);
  }, [value, isEditing]);

  // Auto-focus the input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select text for text-like inputs
      if (inputRef.current instanceof HTMLInputElement && inputRef.current.type !== "checkbox" && inputRef.current.type !== "date") {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // ------- Handlers -------

  const handleEnterEdit = useCallback(() => {
    if (!canEdit) return;
    // Tags are too complex for inline edit
    if (field.type === "tags") return;
    setEditValue(value);
    setIsEditing(true);
  }, [canEdit, field.type, value]);

  const commitSave = useCallback(() => {
    setIsEditing(false);
    let newVal = editValue;

    // Coerce types
    if (field.type === "number" || field.type === "currency") {
      newVal = newVal === "" || newVal == null ? 0 : parseFloat(newVal);
      if (isNaN(newVal)) newVal = 0;
    }
    if (field.type === "date" && typeof newVal === "string" && newVal) {
      newVal = new Date(newVal + "T00:00:00").toISOString();
    }

    // Only fire onSave when the value actually changed
    const prev = field.type === "date" ? toInputDateString(value) : value;
    const next = field.type === "date" ? toInputDateString(newVal) : newVal;
    if (String(prev ?? "") !== String(next ?? "")) {
      onSave(contactId, field.id, newVal);
      // Brief green flash
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 600);
    }
  }, [editValue, value, field, contactId, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [commitSave, handleCancel],
  );

  // ------- Display rendering -------

  const renderDisplay = () => {
    // Empty / null / undefined → mdash
    if (value == null || value === "") {
      return <span className={isDarkMode ? "text-slate-600" : "text-slate-300"}>—</span>;
    }

    switch (field.type) {
      case "currency": {
        const num = typeof value === "number" ? value : parseFloat(value);
        return (
          <span className={`text-right w-full block tabular-nums ${num > 0 ? (isDarkMode ? "text-emerald-400" : "text-emerald-600") : ""}`}>
            {formatCurrency(value)}
          </span>
        );
      }

      case "date":
        return <span className="tabular-nums">{formatDate(value)}</span>;

      case "boolean":
        return value ? (
          <Check className={`w-4 h-4 ${isDarkMode ? "text-emerald-400" : "text-emerald-500"}`} />
        ) : (
          <Minus className={`w-4 h-4 ${isDarkMode ? "text-slate-600" : "text-slate-300"}`} />
        );

      case "select": {
        // Lead-status pill badge
        if (field.id === "leadStatus") {
          const s = LEAD_STATUS_STYLES[value as string];
          if (s) {
            return (
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                  isDarkMode ? `${s.darkBg} ${s.darkText}` : `${s.bg} ${s.text}`
                }`}
              >
                {value}
              </span>
            );
          }
        }
        return <span>{String(value)}</span>;
      }

      case "tags":
        if (Array.isArray(value) && value.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((tag: string) => (
                <span
                  key={tag}
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    isDarkMode
                      ? "bg-slate-700 text-slate-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          );
        }
        return <span className={isDarkMode ? "text-slate-600" : "text-slate-300"}>—</span>;

      default: {
        // text, email, phone, url, number — plain string
        const isBoldName = (field.id === "firstName" || field.id === "lastName") && field.type === "text";
        return <span className={isBoldName ? "font-semibold" : ""}>{String(value)}</span>;
      }
    }
  };

  // ------- Edit rendering -------

  const renderEdit = () => {
    const sharedInputClasses = `w-full bg-transparent outline-none text-sm ${
      isDarkMode ? "text-white placeholder-slate-500" : "text-slate-900 placeholder-slate-400"
    }`;

    switch (field.type) {
      case "select":
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue ?? ""}
            onChange={(e) => {
              setEditValue(e.target.value);
              // Immediately commit on select change for better UX
              setIsEditing(false);
              const newVal = e.target.value;
              if (String(value ?? "") !== newVal) {
                onSave(contactId, field.id, newVal);
                setJustSaved(true);
                setTimeout(() => setJustSaved(false), 600);
              }
            }}
            onBlur={handleCancel}
            onKeyDown={handleKeyDown}
            className={`${sharedInputClasses} cursor-pointer`}
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="checkbox"
            checked={!!editValue}
            onChange={(e) => {
              const newVal = e.target.checked;
              setEditValue(newVal);
              // Commit immediately on toggle
              setIsEditing(false);
              if (value !== newVal) {
                onSave(contactId, field.id, newVal);
                setJustSaved(true);
                setTimeout(() => setJustSaved(false), 600);
              }
            }}
            onKeyDown={handleKeyDown}
            className="w-4 h-4 accent-indigo-500 cursor-pointer"
          />
        );

      case "currency":
        return (
          <div className="flex items-center gap-1 w-full">
            <span className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>$</span>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              step="0.01"
              value={editValue ?? ""}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitSave}
              onKeyDown={handleKeyDown}
              className={`${sharedInputClasses} text-right`}
            />
          </div>
        );

      case "date":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={toInputDateString(editValue)}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            className={sharedInputClasses}
          />
        );

      case "number":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            className={sharedInputClasses}
          />
        );

      case "email":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="email"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            className={sharedInputClasses}
          />
        );

      case "phone":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="tel"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            className={sharedInputClasses}
          />
        );

      case "url":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="url"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            className={sharedInputClasses}
          />
        );

      // text (default) — covers firstName, lastName, companyName, etc.
      default:
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue ?? ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitSave}
            onKeyDown={handleKeyDown}
            className={sharedInputClasses}
          />
        );
    }
  };

  // ------- Cell class composition -------

  const baseCellClasses = `px-3 py-3 border-r text-sm transition-all duration-200 ${
    isDarkMode ? "border-slate-700/60" : "border-slate-200"
  }`;

  const editableClasses = canEdit && field.type !== "tags"
    ? "cursor-pointer"
    : "";

  const editingRingClasses = isEditing
    ? "ring-2 ring-indigo-500/30 ring-inset z-10 relative"
    : "";

  const savedFlashClasses = justSaved
    ? isDarkMode
      ? "bg-emerald-900/20"
      : "bg-emerald-50"
    : "";

  return (
    <td
      className={`${baseCellClasses} ${editableClasses} ${editingRingClasses} ${savedFlashClasses} ${className}`}
      style={style}
      onClick={!isEditing ? handleEnterEdit : undefined}
    >
      {isEditing ? renderEdit() : renderDisplay()}
    </td>
  );
});

InlineEditCell.displayName = "InlineEditCell";

export default InlineEditCell;
