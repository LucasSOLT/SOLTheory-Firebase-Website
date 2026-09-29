"use client";

import React from "react";
import { Smile } from "lucide-react";

export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface ReactionBarProps {
  onReact: (emoji: string) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export function QuickReactionPicker({
  onReact,
  onClose,
  isDarkMode = false,
}: ReactionBarProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-2xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 z-50 ${
        isDarkMode
          ? "bg-slate-800/95 border-slate-700 text-white"
          : "bg-white/95 border-slate-200 text-slate-900"
      }`}
    >
      {DEFAULT_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onReact(emoji);
            if (onClose) onClose();
          }}
          className="text-lg p-1 rounded-full hover:scale-130 active:scale-95 transition-transform cursor-pointer"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

interface ReactionBadgesProps {
  reactions?: Record<string, string[]>;
  currentEmail?: string;
  onToggle: (emoji: string) => void;
  isDarkMode?: boolean;
}

export function ReactionBadges({
  reactions = {},
  currentEmail,
  onToggle,
  isDarkMode = false,
}: ReactionBadgesProps) {
  const activeEntries = Object.entries(reactions).filter(
    ([_, users]) => users && users.length > 0
  );

  if (activeEntries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1 -mb-1">
      {activeEntries.map(([emoji, users]) => {
        const hasReacted = currentEmail && users.includes(currentEmail);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(emoji);
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold transition-all border shadow-xs ${
              hasReacted
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
                : isDarkMode
                ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title={users.join(", ")}
          >
            <span>{emoji}</span>
            {users.length > 1 && <span className="text-[10px]">{users.length}</span>}
          </button>
        );
      })}
    </div>
  );
}
