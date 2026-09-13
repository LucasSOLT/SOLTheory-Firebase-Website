/**
 * ScopeToggle — Chat context scope switcher
 *
 * Two-segment pill toggle between:
 *   👤 My Assistant  (private user context)
 *   🏢 Org Hub       (shared organization context)
 */

"use client";

import { User, Users } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import type { ChatScope } from "@/types/chat";

interface ScopeToggleProps {
  isDarkMode: boolean;
  orgName?: string;
  orgId: string;
}

export default function ScopeToggle({ isDarkMode, orgName, orgId }: ScopeToggleProps) {
  const scope = useChatStore((s) => s.scope);
  const setScope = useChatStore((s) => s.setScope);
  const loadSessions = useChatStore((s) => s.loadSessions);

  const handleToggle = (newScope: ChatScope) => {
    if (newScope === scope) return;
    setScope(newScope);
    // Reload sessions for the new scope
    loadSessions(orgId);
  };

  return (
    <div
      className={`flex rounded-xl p-1 gap-1 ${
        isDarkMode
          ? "bg-slate-800/80 border border-slate-700"
          : "bg-slate-200/60 border border-slate-200"
      }`}
    >
      {/* User Scope Button */}
      <button
        onClick={() => handleToggle("user")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          scope === "user"
            ? isDarkMode
              ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-900/30"
              : "bg-indigo-500 text-white shadow-md shadow-indigo-200"
            : isDarkMode
              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
      >
        <User className="w-3.5 h-3.5" />
        <span>My Assistant</span>
      </button>

      {/* Org Scope Button */}
      <button
        onClick={() => handleToggle("org")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          scope === "org"
            ? isDarkMode
              ? "bg-emerald-600/90 text-white shadow-md shadow-emerald-900/30"
              : "bg-emerald-500 text-white shadow-md shadow-emerald-200"
            : isDarkMode
              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Users className="w-3.5 h-3.5" />
        <span>{orgName || "Org Hub"}</span>
      </button>
    </div>
  );
}
