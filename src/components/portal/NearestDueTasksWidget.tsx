"use client";

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { AlertCircle, Loader2, CheckCircle2, ExternalLink, X, CalendarDays, Clock, User, Flag, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation, dictionaries } from '@/lib/i18n';
import { useDarkMode } from '@/lib/useDarkMode';

interface ActionBoardTask {
  id: string;
  title: string;
  description?: string;
  assignedToName: string | null;
  assignedToEmail?: string;
  createdByName?: string;
  createdByEmail?: string;
  column: string;
  priority?: string;
  dueDate: any;
  startDate?: any;
  createdAt?: any;
  comments?: { text: string; authorName: string; createdAt: any }[];
}

type TranslationDict = typeof dictionaries['en'];

function formatDueLabel(dueDate: any, t: TranslationDict) {
  if (!dueDate) return t.noDueDate;
  const now = Date.now();
  const dueMs = typeof dueDate.toMillis === "function" ? dueDate.toMillis() : new Date(dueDate).getTime();
  const diff = dueMs - now;
  const isOverdue = diff < 0;
  const absDiff = Math.abs(diff);

  const mins = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (isOverdue) {
    if (days > 0) return `${t.overdue} · ${days}${t.day}`;
    if (hours > 0) return `${t.overdue} · ${hours}${t.hour}`;
    if (mins > 0) return `${t.overdue} · ${mins}${t.minute}`;
    return t.overdue;
  } else {
    if (days > 0) return `${t.dueIn} ${days}${t.day}`;
    if (hours > 0) return `${t.dueIn} ${hours}${t.hour}`;
    if (mins > 0) return `${t.dueIn} ${mins}${t.minute}`;
    return t.dueNow;
  }
}

function formatTimestamp(ts: any): string {
  if (!ts) return "—";
  try {
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-rose-50 text-rose-600 border-rose-200/60",
  Medium: "bg-amber-50 text-amber-600 border-amber-200/60",
  Low: "bg-sky-50 text-sky-600 border-sky-200/60",
};

// Urgency-based color palette: yellowish-red (most urgent) -> reddish-yellow (less urgent)
function getUrgencyColor(dueDate: any, isDark: boolean) {
  const now = Date.now();
  const dueMs = typeof dueDate?.toMillis === "function" ? dueDate.toMillis() : new Date(dueDate).getTime();
  const hoursUntilDue = (dueMs - now) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) {
    // Overdue — warmest red
    return {
      bg: isDark ? "rgba(239,68,68,0.10)" : "rgba(220,38,38,0.07)",
      border: isDark ? "rgb(239,68,68)" : "rgb(220,38,38)",
      bar: isDark ? "bg-red-400" : "bg-red-500",
      badge: isDark ? "bg-red-950/60 text-red-400 border border-red-800/60" : "bg-red-50 text-red-600 border border-red-200",
    };
  } else if (hoursUntilDue < 24) {
    // Due within 1 day — red-amber
    return {
      bg: isDark ? "rgba(249,115,22,0.10)" : "rgba(234,88,12,0.06)",
      border: isDark ? "rgb(249,115,22)" : "rgb(234,88,12)",
      bar: isDark ? "bg-orange-400" : "bg-orange-500",
      badge: isDark ? "bg-orange-950/60 text-orange-400 border border-orange-800/60" : "bg-orange-50 text-orange-600 border border-orange-200",
    };
  } else if (hoursUntilDue < 72) {
    // Due within 3 days — warm amber
    return {
      bg: isDark ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.05)",
      border: isDark ? "rgb(245,158,11)" : "rgb(217,119,6)",
      bar: isDark ? "bg-amber-400" : "bg-amber-500",
      badge: isDark ? "bg-amber-950/60 text-amber-400 border border-amber-800/60" : "bg-amber-50 text-amber-600 border border-amber-200",
    };
  } else if (hoursUntilDue < 168) {
    // Due within 7 days — amber-yellow
    return {
      bg: isDark ? "rgba(234,179,8,0.06)" : "rgba(234,179,8,0.04)",
      border: isDark ? "rgb(234,179,8)" : "rgb(202,138,4)",
      bar: isDark ? "bg-yellow-400" : "bg-yellow-500",
      badge: isDark ? "bg-yellow-950/60 text-yellow-400 border border-yellow-800/60" : "bg-yellow-50 text-yellow-600 border border-yellow-200",
    };
  } else {
    // More than 7 days — soft warm yellow
    return {
      bg: isDark ? "rgba(250,204,21,0.04)" : "rgba(250,204,21,0.03)",
      border: isDark ? "rgb(250,204,21)" : "rgb(161,130,0)",
      bar: isDark ? "bg-yellow-300/60" : "bg-yellow-400/60",
      badge: isDark ? "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40" : "bg-yellow-50/80 text-yellow-700 border border-yellow-200/60",
    };
  }
}

// Keep assignee color for avatar only
const ASSIGNEE_COLORS = [
  { avatar: "bg-indigo-100 text-indigo-700" },
  { avatar: "bg-emerald-100 text-emerald-700" },
  { avatar: "bg-rose-100 text-rose-700" },
  { avatar: "bg-amber-100 text-amber-700" },
  { avatar: "bg-cyan-100 text-cyan-700" },
  { avatar: "bg-purple-100 text-purple-700" },
  { avatar: "bg-pink-100 text-pink-700" },
  { avatar: "bg-green-100 text-green-700" },
];

function getAssigneeAvatar(name: string | null, colorMap: Map<string, number>) {
  if (!name) return "bg-slate-100 text-slate-500";
  const key = name.toLowerCase().trim();
  if (!colorMap.has(key)) {
    colorMap.set(key, colorMap.size % ASSIGNEE_COLORS.length);
  }
  return ASSIGNEE_COLORS[colorMap.get(key)!].avatar;
}



export function NearestDueTasksWidget({ orgId = "soltheory" }: { orgId?: string }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isDarkMode = useDarkMode();

  const COLUMN_LABELS: Record<string, string> = {
    todo: t.toDo,
    doing: t.inProgress,
    done: t.done,
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ActionBoardTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue'>('all');
  const [selectedTask, setSelectedTask] = useState<ActionBoardTask | null>(null);

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    setLoading(true);
    setError(null);

    const tasksRef = collection(firestore, "action_board_tasks");
    const q = query(tasksRef, where("orgId", "==", orgId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetchedTasks: ActionBoardTask[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          fetchedTasks.push({
            id: d.id,
            title: data.title,
            description: data.description || "",
            assignedToName: data.assignedToName || null,
            assignedToEmail: data.assignedToEmail || "",
            createdByName: data.createdByName || "",
            createdByEmail: data.createdByEmail || "",
            column: data.column,
            priority: data.priority || "Medium",
            dueDate: data.dueDate || null,
            startDate: data.startDate || null,
            createdAt: data.createdAt || null,
            comments: data.comments || [],
          });
        });
        setTasks(fetchedTasks);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading tasks:", err);
        setError("FAILED_FETCH_TASKS");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid]);

  // Priority Queue Algorithm
  const displayedTasks = useMemo(() => {
    const now = Date.now();
    
    // 1. Filter: active (non-completed) tasks with valid due dates
    let activeTasks = tasks.filter(t => t.column !== "done" && t.dueDate);

    // Apply filter
    if (filter === 'mine') {
      activeTasks = activeTasks.filter(t => 
        t.assignedToName && user?.displayName && 
        t.assignedToName.toLowerCase().includes(user.displayName.toLowerCase())
      );
    }

    // 2. Sort Overdue Tasks: dueDate < now (ascending)
    const overdueTasks = activeTasks
      .filter((t) => {
        const dueMs = typeof t.dueDate.toMillis === "function" ? t.dueDate.toMillis() : new Date(t.dueDate).getTime();
        return dueMs < now;
      })
      .sort((a, b) => {
        const aMs = typeof a.dueDate.toMillis === "function" ? a.dueDate.toMillis() : new Date(a.dueDate).getTime();
        const bMs = typeof b.dueDate.toMillis === "function" ? b.dueDate.toMillis() : new Date(b.dueDate).getTime();
        return aMs - bMs;
      });

    // 3. Sort Upcoming Tasks: dueDate >= now (ascending)
    const upcomingTasks = activeTasks
      .filter((t) => {
        const dueMs = typeof t.dueDate.toMillis === "function" ? t.dueDate.toMillis() : new Date(t.dueDate).getTime();
        return dueMs >= now;
      })
      .sort((a, b) => {
        const aMs = typeof a.dueDate.toMillis === "function" ? a.dueDate.toMillis() : new Date(a.dueDate).getTime();
        const bMs = typeof b.dueDate.toMillis === "function" ? b.dueDate.toMillis() : new Date(b.dueDate).getTime();
        return aMs - bMs;
      });

    if (filter === 'overdue') return overdueTasks.slice(0, 5);

    // 4. Combine prioritized queue and take exactly first 5
    const prioritized = [...overdueTasks, ...upcomingTasks];
    return prioritized.slice(0, 5);
  }, [tasks, filter, user?.displayName]);

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return tasks.filter(t => {
      if (t.column === "done" || !t.dueDate) return false;
      const dueMs = typeof t.dueDate.toMillis === "function" ? t.dueDate.toMillis() : new Date(t.dueDate).getTime();
      return dueMs < now;
    }).length;
  }, [tasks]);

  // Build a stable color map for all unique assignees
  const assigneeColorMap = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(t => {
      if (t.assignedToName) {
        const key = t.assignedToName.toLowerCase().trim();
        if (!map.has(key)) map.set(key, map.size % ASSIGNEE_COLORS.length);
      }
    });
    return map;
  }, [tasks]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[140px]">
        <Loader2 className={`w-5 h-5 animate-spin ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full w-full flex flex-col items-center justify-center text-center p-5 rounded-2xl border border-dashed min-h-[140px] ${isDarkMode ? 'bg-red-950/40 border-red-800/50' : 'bg-red-50/40 border-red-200/50'}`}>
        <AlertCircle className="w-6 h-6 text-red-400 mb-1.5" />
        <h4 className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{t.failedLoadTasks}</h4>
        <p className={`text-[9px] mt-1 max-w-[180px] ${isDarkMode ? 'text-red-300' : 'text-red-500'}`}>{error === 'FAILED_FETCH_TASKS' ? t.failedFetchTasks : error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full flex flex-col min-h-0">
        {/* Header with title + badge + filter tabs */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500/80 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {overdueCount}
              </span>
            )}
          </div>
          <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {(['all', 'mine', 'overdue'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all cursor-pointer capitalize ${
                  filter === f
                    ? isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-[#faf8f3] text-slate-900 shadow-sm'
                    : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f === 'mine' ? t.assignedToMe : f === 'overdue' ? t.overdue : t.all}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitle */}
        <p className={`text-[11px] font-medium mb-3 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {t.sortedByImpact}
        </p>

        {/* Task List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {displayedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mb-2" />
              <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{t.allCaughtUp}</p>
              <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.noTasksNeedAttention}</p>
            </div>
          ) : (
            displayedTasks.map((task) => {
              const now = Date.now();
              const dueMs = typeof task.dueDate.toMillis === "function" ? task.dueDate.toMillis() : new Date(task.dueDate).getTime();
              const isOverdue = dueMs < now;
              const dueLabel = formatDueLabel(task.dueDate, t);
              const urgency = getUrgencyColor(task.dueDate, isDarkMode);
              const avatarClass = getAssigneeAvatar(task.assignedToName, assigneeColorMap);

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border transition-all group cursor-pointer hover:shadow-sm"
                  style={{
                    backgroundColor: urgency.bg,
                    borderColor: urgency.border,
                    borderLeftWidth: '3px',
                  }}
                >
                  {/* Priority indicator bar */}
                  <div className={`w-1 h-10 rounded-full shrink-0 ${urgency.bar}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold truncate leading-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                      {task.title}
                    </p>
                    <p className={`text-[10px] font-medium mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                      {task.assignedToName || t.unassigned} · {task.column}
                    </p>
                  </div>

                  {/* Due badge */}
                  <span
                    className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 whitespace-nowrap ${urgency.badge}`}
                  >
                    {dueLabel}
                  </span>

                  {/* Assignee avatar */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black uppercase shrink-0 ${avatarClass}`}>
                    {task.assignedToName ? task.assignedToName.charAt(0) : "?"}
                  </div>

                  {/* Open arrow - navigates to action board */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/portal/dashboard/${orgId}/action-board?highlight=${task.id}`);
                    }}
                    className={`text-[10px] font-semibold transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}
                  >
                    {t.open} <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Task Detail Popup */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className={`rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900' : 'bg-[#faf8f3]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-5 border-b flex items-start justify-between shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <div className="flex-1 min-w-0 mr-3">
                <h3 className={`text-lg font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                  {selectedTask.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedTask.priority && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${PRIORITY_COLORS[selectedTask.priority] || PRIORITY_COLORS.Medium}`}>
                      {selectedTask.priority}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {COLUMN_LABELS[selectedTask.column] || selectedTask.column}
                  </span>
                  {(() => {
                    if (!selectedTask.dueDate) return null;
                    const now = Date.now();
                    const dueMs = typeof selectedTask.dueDate.toMillis === "function" ? selectedTask.dueDate.toMillis() : new Date(selectedTask.dueDate).getTime();
                    const isOverdue = dueMs < now;
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${isOverdue ? (isDarkMode ? 'bg-rose-950/50 text-rose-400 border-rose-800/60' : 'bg-rose-50 text-rose-500 border-rose-200/60') : (isDarkMode ? 'bg-indigo-950/50 text-indigo-400 border-indigo-800/60' : 'bg-indigo-50 text-indigo-500 border-indigo-200/60')}`}>
                        {formatDueLabel(selectedTask.dueDate, t)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Description */}
              {selectedTask.description && (
                <div>
                  <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.description}</h4>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{selectedTask.description}</p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Assigned To */}
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDarkMode ? 'bg-indigo-950/50' : 'bg-indigo-50'}`}>
                    <User className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.assignedTo}</p>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{selectedTask.assignedToName || t.unassigned}</p>
                    {selectedTask.assignedToEmail && (
                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{selectedTask.assignedToEmail}</p>
                    )}
                  </div>
                </div>

                {/* Created By */}
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDarkMode ? 'bg-emerald-950/50' : 'bg-emerald-50'}`}>
                    <Flag className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.createdBy}</p>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{selectedTask.createdByName || t.unknown}</p>
                    {selectedTask.createdByEmail && (
                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{selectedTask.createdByEmail}</p>
                    )}
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-start gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDarkMode ? 'bg-amber-950/50' : 'bg-amber-50'}`}>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.dueDate}</p>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{formatTimestamp(selectedTask.dueDate)}</p>
                  </div>
                </div>

                {/* Start Date */}
                {selectedTask.startDate && (
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDarkMode ? 'bg-blue-950/50' : 'bg-blue-50'}`}>
                      <CalendarDays className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.startDate}</p>
                      <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{formatTimestamp(selectedTask.startDate)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              {selectedTask.comments && selectedTask.comments.length > 0 && (
                <div>
                  <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    <MessageSquare className="w-3 h-3" />
                    {t.comments} ({selectedTask.comments.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.comments.map((c, i) => (
                      <div key={i} className={`rounded-xl p-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#faf6ed] border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{c.authorName}</span>
                          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{formatTimestamp(c.createdAt)}</span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <button
                onClick={() => setSelectedTask(null)}
                className={`text-sm font-medium transition-colors cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.close}
              </button>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  router.push(`/portal/dashboard/${orgId}/action-board`);
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer ${isDarkMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                {t.openInActionBoard} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
