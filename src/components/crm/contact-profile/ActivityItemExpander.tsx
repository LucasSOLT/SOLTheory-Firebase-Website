"use client";

import React, { useState } from "react";
import type { CrmActivity } from "@/stores/crm-store";
import { format } from "date-fns";
import {
  MessageSquare, Mail, Phone, Calendar as CalendarIcon, Activity as ActivityIcon,
  User, Brain, Sparkles, Tag, FileText, ArrowRightLeft,
  CheckSquare, Upload, TrendingUp, ChevronDown, ChevronUp, Copy, Check, ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const ACTIVITY_ICON_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  note: { icon: MessageSquare, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
  email: { icon: Mail, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
  call: { icon: Phone, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  meeting: { icon: CalendarIcon, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  status_change: { icon: ArrowRightLeft, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40" },
  insight: { icon: Brain, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  task: { icon: CheckSquare, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
  field_update: { icon: FileText, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
  tag_change: { icon: Tag, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40" },
  deal_update: { icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40" },
  file_upload: { icon: Upload, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800" },
};

interface ActivityItemExpanderProps {
  activity: CrmActivity;
  isDarkMode: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onInsightClick?: (activityId: string) => void;
}

export default function ActivityItemExpander({
  activity,
  isDarkMode,
  isExpanded,
  onToggle,
  onInsightClick,
}: ActivityItemExpanderProps) {
  const [copied, setCopied] = useState(false);

  const dateObj = activity.timestamp?.toDate
    ? activity.timestamp.toDate()
    : (activity.timestamp ? new Date(activity.timestamp) : new Date());
  
  const isInsight = activity.type === "insight";
  const iconConfig = ACTIVITY_ICON_MAP[activity.type] || ACTIVITY_ICON_MAP.note;
  const IconComp = iconConfig.icon;

  // Non-insight items are expandable if content is long or multiline
  const isContentLong = activity.content.length > 140 || activity.content.includes("\n");
  const canExpand = isInsight || isContentLong;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(activity.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSecondaryInsightClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInsightClick) {
      onInsightClick(activity.id);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        isInsight
          ? isDarkMode
            ? "bg-indigo-950/30 border-indigo-800/50 hover:border-indigo-700/80 shadow-sm"
            : "bg-indigo-50/50 border-indigo-200 hover:border-indigo-300 shadow-sm"
          : isDarkMode
            ? "bg-slate-800/50 border-slate-700/60 hover:border-slate-600 shadow-sm"
            : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
      }`}
    >
      {/* Clickable Header / Card Row */}
      <div
        onClick={canExpand ? onToggle : undefined}
        className={`p-3.5 ${canExpand ? "cursor-pointer select-none" : ""}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${iconConfig.bg}`}>
              <IconComp className={`w-4 h-4 ${iconConfig.color}`} />
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isInsight
                  ? isDarkMode ? "text-indigo-400" : "text-indigo-600"
                  : isDarkMode ? "text-slate-400" : "text-slate-400"
              }`}
            >
              {isInsight ? "Insight Report" : activity.type.replace(/_/g, " ")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {format(dateObj, "MMM d, h:mm a")}
            </span>
            {canExpand && (
              <span className={`p-1 rounded transition-colors ${isDarkMode ? "hover:bg-slate-700/50 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Content Area */}
        {!isExpanded ? (
          <div>
            <p
              className={`text-sm leading-relaxed ${
                isInsight
                  ? isDarkMode ? "text-indigo-200/90 line-clamp-2" : "text-indigo-900/90 line-clamp-2"
                  : isDarkMode ? "text-slate-300 line-clamp-3" : "text-slate-700 line-clamp-3"
              }`}
            >
              {isInsight
                ? activity.content.replace(/\*\*/g, "").slice(0, 130) + "..."
                : activity.content}
            </p>

            {/* Collapsed prompts */}
            {isInsight && (
              <div className="mt-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase tracking-wider hover:text-indigo-400 transition-colors">
                  <Sparkles className="w-3 h-3" /> Click to read full report inline
                </span>
                {onInsightClick && (
                  <button
                    type="button"
                    onClick={handleSecondaryInsightClick}
                    className={`text-[10px] font-medium underline underline-offset-2 flex items-center gap-1 transition-colors ${
                      isDarkMode ? "text-slate-400 hover:text-indigo-300" : "text-slate-500 hover:text-indigo-600"
                    }`}
                  >
                    Open in Insights tab
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )}

            {!isInsight && isContentLong && (
              <span className={`mt-1.5 inline-block text-[10px] font-semibold ${isDarkMode ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                Show more...
              </span>
            )}
          </div>
        ) : (
          /* Expanded Content Area */
          <div className="mt-2 pt-2 border-t border-dashed border-slate-200/20">
            {isInsight ? (
              <div className={`text-sm leading-relaxed rounded-lg p-3 ${isDarkMode ? "bg-slate-900/60" : "bg-white/80"}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className={`text-sm font-bold mt-2 mb-1.5 ${isDarkMode ? "text-white" : "text-indigo-950"}`}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className={`text-xs font-bold uppercase tracking-wider mt-2 mb-1 ${isDarkMode ? "text-indigo-300" : "text-indigo-900"}`}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className={`text-xs font-semibold mt-1.5 mb-1 ${isDarkMode ? "text-indigo-400" : "text-indigo-700"}`}>
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className={`text-xs leading-relaxed mb-2 ${isDarkMode ? "text-indigo-100/90" : "text-indigo-950/90"}`}>
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 mb-2 text-xs pl-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 mb-2 text-xs pl-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className={`text-xs leading-relaxed ${isDarkMode ? "text-indigo-200/90" : "text-indigo-900/90"}`}>
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className={`font-semibold ${isDarkMode ? "text-white" : "text-indigo-950"}`}>
                        {children}
                      </strong>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors inline-flex items-center gap-0.5 break-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {children}
                        <ExternalLink className="w-2.5 h-2.5 shrink-0 inline-block ml-0.5" />
                      </a>
                    ),
                    code: ({ children }) => (
                      <code className={`text-[11px] px-1 py-0.5 rounded font-mono ${isDarkMode ? "bg-indigo-900/50 text-indigo-300" : "bg-indigo-100 text-indigo-800"}`}>
                        {children}
                      </code>
                    ),
                  }}
                >
                  {activity.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                {activity.content}
              </p>
            )}

            {/* Action Bar when expanded */}
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                    copied
                      ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                      : isDarkMode
                        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy text"}
                </button>

                {isInsight && onInsightClick && (
                  <button
                    type="button"
                    onClick={handleSecondaryInsightClick}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors ${
                      isDarkMode
                        ? "text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40"
                        : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    }`}
                  >
                    Open in Insights tab
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onToggle}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                  isDarkMode
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                <ChevronUp className="w-3 h-3" />
                Collapse
              </button>
            </div>
          </div>
        )}

        {/* Creator Badges */}
        <div className="mt-2 flex items-center gap-2">
          {activity.createdBy === "jarvis" && !isInsight && (
            <div
              className={`flex items-center gap-1.5 text-[10px] font-semibold w-fit px-2 py-0.5 rounded-md ${
                isDarkMode ? "text-indigo-400 bg-indigo-950/40" : "text-indigo-600 bg-indigo-50"
              }`}
            >
              <User className="w-2.5 h-2.5" />
              Jarvis
            </div>
          )}

          {activity.createdBy === "system" && (
            <div
              className={`flex items-center gap-1.5 text-[10px] font-semibold w-fit px-2 py-0.5 rounded-md ${
                isDarkMode ? "text-slate-400 bg-slate-800" : "text-slate-500 bg-slate-50"
              }`}
            >
              <ActivityIcon className="w-2.5 h-2.5" />
              System
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
