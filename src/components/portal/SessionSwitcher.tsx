"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2,
  Check, MoreHorizontal, Power, Loader2, Settings, Clock,
  Timer, Play, Pause, Copy, Search,
} from "lucide-react";
import type { GrantSession } from "@/hooks/useGrantSessions";
import { SESSION_COLOR_THEMES, type SessionColor } from "@/hooks/useGrantSessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ═══════════════════════════════════════════════════════════════════
   Session Switcher — Horizontal tab bar for switching between
   independent grant search sessions.
   ═══════════════════════════════════════════════════════════════════ */

interface SessionSwitcherProps {
  sessions: GrantSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, name: string) => void;
  onEditSession?: (sessionId: string) => void;
  onDuplicateSession?: (sessionId: string) => void;
  canCreateMore: boolean;
  loading?: boolean;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

/** Format an interval like {value:1, unit:"days"} into a compact badge label */
function fmtInterval(value: number | undefined, unit: string | undefined): string {
  if (!value || !unit) return "";
  const short: Record<string, string> = {
    minutes: "min",
    hours: "hr",
    days: "d",
    weeks: "wk",
  };
  return `${value}${short[unit] || unit}`;
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function SessionSwitcher({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onEditSession,
  onDuplicateSession,
  canCreateMore,
  loading = false,
}: SessionSwitcherProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Scroll helpers
  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  }
  function scrollRight() {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  }

  // Start inline rename
  function startRename(sessionId: string, currentName: string) {
    setEditingId(sessionId);
    setEditValue(currentName);
  }

  // Save rename
  function commitRename() {
    if (editingId && editValue.trim()) {
      onRenameSession(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-3">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading sessions…</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Search Sessions
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400">
            {sessions.length} / 10
          </span>
          {canCreateMore && (
            <button
              onClick={onCreateSession}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3 h-3" />
              New Session
            </button>
          )}
        </div>
      </div>

      {/* Session Pills — horizontal scrolling */}
      <div className="relative group">
        {/* Scroll arrows */}
        {sessions.length > 4 && (
          <>
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-1 py-1"
        >
          {sessions.map((session, index) => {
            const isActive = session.id === activeSessionId;
            const theme = SESSION_COLOR_THEMES[session.color] || SESSION_COLOR_THEMES.indigo;
            const isEditing = editingId === session.id;
            const agentCount = Object.values(session.agents).filter((a) => a.active).length;

            // Timer info from config
            const cfg = session.config;
            const intervalLabel = fmtInterval(cfg?.intervalValue, cfg?.intervalUnit);

            return (
              <div key={session.id} className="relative shrink-0">
                {/* Pill container — div wraps the clickable area + dots separately */}
                <div
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all select-none ${
                    isActive
                      ? `${theme.pillBg} ${theme.pillBorder} ${theme.pillText} shadow-sm font-bold`
                      : "bg-white/60 border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 font-semibold"
                  }`}
                >
                  {/* Clickable session select area */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!isEditing) onSelectSession(session.id); }}
                    onDoubleClick={(e) => { e.preventDefault(); startRename(session.id, session.name); }}
                    className="flex items-center gap-2 cursor-pointer min-w-0"
                  >
                    <Search className={`w-3.5 h-3.5 drop-shadow-sm shrink-0 ${isActive ? "text-current" : "text-slate-400"}`} />
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                        }}
                        className="text-xs bg-transparent border-none outline-none w-24 font-semibold"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-xs whitespace-nowrap max-w-[120px] truncate">
                        {session.name}
                      </span>
                    )}
                  </div>

                  {/* Timer badge — compact interval indicator */}
                  {intervalLabel && !isEditing && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? `${theme.pillBorder} bg-white/50`
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                      title={`Scan interval: Every ${cfg?.intervalValue} ${cfg?.intervalUnit}`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {intervalLabel}
                    </span>
                  )}

                  {isActive && session.active && (
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                  {!isActive && agentCount > 0 && (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {agentCount}
                    </span>
                  )}

                  {/* Three-dot menu using Radix UI */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 opacity-50 hover:opacity-100 hover:bg-slate-100"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[190px] rounded-xl shadow-2xl border-slate-200 p-1.5">
                      {onEditSession && (
                        <DropdownMenuItem onClick={() => onEditSession(session.id)} className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer rounded-lg p-2">
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          Edit Session
                        </DropdownMenuItem>
                      )}
                      {onDuplicateSession && (
                        <DropdownMenuItem onClick={() => onDuplicateSession(session.id)} className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer rounded-lg p-2">
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          Duplicate Session
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => startRename(session.id, session.name)} className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer rounded-lg p-2">
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100 my-1" />
                      <DropdownMenuItem onClick={() => setConfirmDeleteId(session.id)} className="flex items-center gap-2.5 text-xs font-medium text-red-600 cursor-pointer rounded-lg p-2 focus:bg-red-50 focus:text-red-700">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        Delete Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {/* Empty state: no sessions */}
          {sessions.length === 0 && (
            <button
              onClick={onCreateSession}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-semibold">Create your first search session</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Delete Session?</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This will permanently delete &ldquo;{sessions.find((s) => s.id === confirmDeleteId)?.name}&rdquo; and all its agents.
              Grant discoveries from this session will also be removed.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDeleteSession(confirmDeleteId); setConfirmDeleteId(null); }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-colors cursor-pointer"
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
