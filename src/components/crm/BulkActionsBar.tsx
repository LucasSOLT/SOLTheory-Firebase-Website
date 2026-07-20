"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { X, Tag, Mail, Download, Trash2, ChevronUp, Check, Users, RefreshCw } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onChangeStatus: (status: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onSendEmail: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  availableTags: string[];
  availableStatuses: string[];
}

function DropUp({ label, icon: Icon, children, variant = "default" }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const btnClass = variant === "danger"
    ? "hover:bg-red-500/20 text-red-300 hover:text-red-200"
    : "hover:bg-white/10 text-slate-300 hover:text-white";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${btnClass}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
        <ChevronUp className={`w-3 h-3 transition-transform ${open ? 'rotate-0' : 'rotate-180'}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl bg-slate-800 border border-slate-600 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-150 z-50">
          <div className="max-h-64 overflow-y-auto p-1.5">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  "Cold Lead": "bg-blue-400",
  "Warm Lead": "bg-orange-400",
  "Interested": "bg-purple-400",
  "Sale Completed": "bg-emerald-400",
};

function BulkActionsBar({
  selectedCount,
  onChangeStatus,
  onAddTag,
  onRemoveTag,
  onSendEmail,
  onExport,
  onDelete,
  onClearSelection,
  availableTags,
  availableStatuses,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/60 shadow-2xl shadow-black/30">
        {/* Count Badge */}
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-slate-700/60">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300">
            <Users className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{selectedCount}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">selected</span>
        </div>

        {/* Status Dropdown */}
        <DropUp label="Status" icon={RefreshCw}>
          {availableStatuses.map(status => (
            <button
              key={status}
              onClick={() => onChangeStatus(status)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-400'}`} />
              {status}
            </button>
          ))}
        </DropUp>

        {/* Add Tag */}
        <DropUp label="Tag" icon={Tag}>
          <div className="px-2 py-1 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add Tag</span>
          </div>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => onAddTag(tag)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <Tag className="w-3 h-3 text-slate-400" />
              {tag}
            </button>
          ))}
        </DropUp>

        {/* Email */}
        <button
          onClick={onSendEmail}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Email</span>
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        {/* Divider + Clear */}
        <div className="pl-1 ml-1 border-l border-slate-700/60">
          <button
            onClick={onClearSelection}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BulkActionsBar);
