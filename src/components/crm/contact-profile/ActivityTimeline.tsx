"use client";

import React, { useState, useMemo } from "react";
import { useCRMStore } from "@/stores/crm-store";
import type { CrmActivity } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import {
  MessageSquare, Mail, Phone, Calendar as CalendarIcon, Activity as ActivityIcon,
  User, Send, Check, Brain, Sparkles, Tag, FileText, ArrowRightLeft,
  CheckSquare, Upload, TrendingUp, Filter,
} from "lucide-react";
import ActivityEmailsTab from "./ActivityEmailsTab";
import ActivityItemExpander from "./ActivityItemExpander";

interface ActivityTimelineProps {
  customerId: string;
  onInsightClick?: (activityId: string) => void;
  contactEmail?: string;
}

const ACTIVITY_ICON_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
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

function getDateGroupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const daysAgo = differenceInDays(new Date(), date);
  if (daysAgo <= 7) return "Last 7 Days";
  if (daysAgo <= 30) return "Last 30 Days";
  return "Older";
}

export default function ActivityTimeline({ customerId, onInsightClick, contactEmail }: ActivityTimelineProps) {
  const { isDarkMode } = useTheme();
  const activities = useCRMStore(s => s.activities.filter(a => a.customerId === customerId));
  const addActivity = useCRMStore(s => s.addActivity);
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [logType, setLogType] = useState<"note" | "call" | "meeting">("note");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectFilter = (type: string) => {
    setFilterType(type);
    if (type === "call" || type === "meeting" || type === "note") {
      setLogType(type);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsSubmitting(true);
    await addActivity({
      customerId,
      type: logType,
      content: newNote.trim(),
      createdBy: "user"
    });
    setNewNote("");
    setIsSubmitting(false);
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filterType === "all") return activities;
    return activities.filter(a => a.type === filterType);
  }, [activities, filterType]);

  // Group by date
  const groupedActivities = useMemo(() => {
    const groups: { label: string; items: CrmActivity[] }[] = [];
    const groupMap = new Map<string, CrmActivity[]>();

    for (const activity of filteredActivities) {
      const dateObj = activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date();
      const label = getDateGroupLabel(dateObj);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(activity);
    }

    for (const [label, items] of groupMap) {
      groups.push({ label, items });
    }
    return groups;
  }, [filteredActivities]);

  const filterTypes = ["all", "note", "email", "call", "meeting", "status_change", "insight", "task", "tag_change"];

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case "all": return "All";
      case "note": return "Notes";
      case "email": return "Emails";
      case "call": return "Calls";
      case "meeting": return "Meetings";
      case "status_change": return "Status";
      case "insight": return "Insights";
      case "task": return "Tasks";
      case "tag_change": return "Tags";
      default: return type;
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-xl border overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className={`p-4 border-b flex flex-col gap-2 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Activity Timeline</h3>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
            {filteredActivities.length}
          </span>
        </div>
        {/* Filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <Filter className={`w-3 h-3 shrink-0 mr-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          {filterTypes.map(type => (
            <button
              key={type}
              onClick={() => handleSelectFilter(type)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                filterType === type
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                  : isDarkMode ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
            >
              {getActivityTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Gmail Emails Tab — renders real Gmail data instead of CrmActivity records */}
      {filterType === "email" && contactEmail ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ActivityEmailsTab contactEmail={contactEmail} contactId={customerId} isDarkMode={isDarkMode} />
        </div>
      ) : (
      /* Activity List */
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedActivities.length === 0 ? (
          <div className="text-center py-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <ActivityIcon className={`w-5 h-5 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>No activity yet</p>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Notes, emails, and meetings will appear here.</p>
          </div>
        ) : (
          groupedActivities.map(group => (
            <div key={group.label}>
              {/* Date group label */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{group.label}</span>
                <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
              </div>
              <div className="space-y-2.5">
                {group.items.map((activity) => (
                  <ActivityItemExpander
                    key={activity.id}
                    activity={activity}
                    isDarkMode={isDarkMode}
                    isExpanded={expandedIds.has(activity.id)}
                    onToggle={() => toggleExpand(activity.id)}
                    onInsightClick={onInsightClick}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Activity Input */}
      <div className={`p-4 border-t ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        {/* Log Type Selector */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Log:
          </span>
          {(["note", "call", "meeting"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setLogType(type)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-md capitalize transition-colors cursor-pointer ${
                logType === type
                  ? "bg-indigo-600 text-white shadow-xs font-semibold"
                  : isDarkMode
                    ? "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    : "bg-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={
              logType === "call"
                ? "Log call summary, outcome, or talking points..."
                : logType === "meeting"
                  ? "Log meeting notes, key decisions, or next steps..."
                  : "Log a note..."
            }
            className={`w-full text-sm rounded-xl border resize-none pr-12 p-3 shadow-sm min-h-[80px] focus:ring-2 focus:ring-indigo-500/20 ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500'
                : 'border-slate-300 focus:border-indigo-500'
            }`}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleAddNote(); }}
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim() || isSubmitting}
            className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
          >
            {isSubmitting ? <Check className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Press ⌘+Enter to submit
        </p>
      </div>
    </div>
  );
}
