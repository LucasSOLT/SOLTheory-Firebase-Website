"use client";

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AlertCircle, Loader2, CheckCircle2, ExternalLink } from "lucide-react";

interface ActionBoardTask {
  id: string;
  title: string;
  assignedToName: string | null;
  column: string;
  dueDate: any;
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

export function NearestDueTasksWidget() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ActionBoardTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine' | 'overdue'>('all');

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
            assignedToName: data.assignedToName || null,
            column: data.column,
            dueDate: data.dueDate || null,
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
                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors group"
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

                {/* Open arrow */}
                <button className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 cursor-pointer">
                  Open <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
