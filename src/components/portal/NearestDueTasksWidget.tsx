"use client";

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { AlertCircle, Loader2, CheckCircle2, ExternalLink, X, CalendarDays, Clock, User, Flag, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

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

function formatDueLabel(dueDate: any) {
  if (!dueDate) return "No due date";
  const now = Date.now();
  const dueMs = typeof dueDate.toMillis === "function" ? dueDate.toMillis() : new Date(dueDate).getTime();
  const diff = dueMs - now;
  const isOverdue = diff < 0;
  const absDiff = Math.abs(diff);

  const mins = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (isOverdue) {
    if (days > 0) return `Overdue · ${days}d`;
    if (hours > 0) return `Overdue · ${hours}h`;
    if (mins > 0) return `Overdue · ${mins}m`;
    return "Overdue";
  } else {
    if (days > 0) return `Due in ${days}d`;
    if (hours > 0) return `Due in ${hours}h`;
    if (mins > 0) return `Due in ${mins}m`;
    return "Due now";
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
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-blue-100 text-blue-700 border-blue-200",
};

const COLUMN_LABELS: Record<string, string> = {
  todo: "To Do",
  doing: "In Progress",
  done: "Done",
};

export function NearestDueTasksWidget() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

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
    const q = query(tasksRef, where("orgId", "==", "soltheory"));

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
        setError("Failed to fetch tasks");
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

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-5 bg-red-50/40 rounded-2xl border border-dashed border-red-200/50 min-h-[140px]">
        <AlertCircle className="w-6 h-6 text-red-400 mb-1.5" />
        <h4 className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Failed to Load Tasks</h4>
        <p className="text-[9px] text-red-500 mt-1 max-w-[180px]">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full flex flex-col min-h-0">
        {/* Header with title + badge + filter tabs */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
              Needs your attention
            </h3>
            {overdueCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {overdueCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {(['all', 'mine', 'overdue'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all cursor-pointer capitalize ${
                  filter === f
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f === 'mine' ? 'Assigned to me' : f === 'overdue' ? 'Overdue' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[11px] text-slate-400 font-medium mb-3 shrink-0">
          Sorted by impact. Critical first.
        </p>

        {/* Task List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {displayedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mb-2" />
              <p className="text-xs font-semibold text-slate-600">All caught up!</p>
              <p className="text-[10px] text-slate-400 mt-0.5">No tasks need your attention.</p>
            </div>
          ) : (
            displayedTasks.map((task) => {
              const now = Date.now();
              const dueMs = typeof task.dueDate.toMillis === "function" ? task.dueDate.toMillis() : new Date(task.dueDate).getTime();
              const isOverdue = dueMs < now;
              const dueLabel = formatDueLabel(task.dueDate);

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors group cursor-pointer"
                >
                  {/* Priority indicator bar */}
                  <div className={`w-1 h-10 rounded-full shrink-0 ${isOverdue ? 'bg-rose-400' : 'bg-amber-400'}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                      {task.assignedToName || "Unassigned"} · {task.column}
                    </p>
                  </div>

                  {/* Due badge */}
                  <span
                    className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 whitespace-nowrap ${
                      isOverdue
                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                        : "bg-amber-50 text-amber-600 border border-amber-200"
                    }`}
                  >
                    {isOverdue && "🔴 "}{dueLabel}
                  </span>

                  {/* Assignee avatar */}
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-black uppercase shrink-0">
                    {task.assignedToName ? task.assignedToName.charAt(0) : "?"}
                  </div>

                  {/* Open arrow — navigates to action board */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/portal/dashboard/soltheory/action-board");
                    }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 cursor-pointer"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══ Task Detail Popup ══ */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div className="flex-1 min-w-0 mr-3">
                <h3 className="text-lg font-bold text-slate-900 leading-snug" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {selectedTask.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedTask.priority && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${PRIORITY_COLORS[selectedTask.priority] || PRIORITY_COLORS.Medium}`}>
                      {selectedTask.priority}
                    </span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    {COLUMN_LABELS[selectedTask.column] || selectedTask.column}
                  </span>
                  {(() => {
                    if (!selectedTask.dueDate) return null;
                    const now = Date.now();
                    const dueMs = typeof selectedTask.dueDate.toMillis === "function" ? selectedTask.dueDate.toMillis() : new Date(selectedTask.dueDate).getTime();
                    const isOverdue = dueMs < now;
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${isOverdue ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                        {formatDueLabel(selectedTask.dueDate)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Description */}
              {selectedTask.description && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Assigned To */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned to</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedTask.assignedToName || "Unassigned"}</p>
                    {selectedTask.assignedToEmail && (
                      <p className="text-[10px] text-slate-400">{selectedTask.assignedToEmail}</p>
                    )}
                  </div>
                </div>

                {/* Created By */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Flag className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created by</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedTask.createdByName || "Unknown"}</p>
                    {selectedTask.createdByEmail && (
                      <p className="text-[10px] text-slate-400">{selectedTask.createdByEmail}</p>
                    )}
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due date</p>
                    <p className="text-sm font-semibold text-slate-800">{formatTimestamp(selectedTask.dueDate)}</p>
                  </div>
                </div>

                {/* Start Date */}
                {selectedTask.startDate && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <CalendarDays className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start date</p>
                      <p className="text-sm font-semibold text-slate-800">{formatTimestamp(selectedTask.startDate)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              {selectedTask.comments && selectedTask.comments.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    Comments ({selectedTask.comments.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.comments.map((c, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-800">{c.authorName}</span>
                          <span className="text-[10px] text-slate-400">{formatTimestamp(c.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedTask(null)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  router.push("/portal/dashboard/soltheory/action-board");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
              >
                Open in Action Board <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
