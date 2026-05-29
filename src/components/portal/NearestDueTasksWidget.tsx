"use client";

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Clock, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

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
    if (days > 0) return `Overdue by ${days} ${days === 1 ? "day" : "days"}`;
    if (hours > 0) return `Overdue by ${hours} ${hours === 1 ? "hour" : "hours"}`;
    if (mins > 0) return `Overdue by ${mins} ${mins === 1 ? "min" : "mins"}`;
    return "Overdue now";
  } else {
    if (days > 0) return `Due in ${days} ${days === 1 ? "day" : "days"}`;
    if (hours > 0) return `Due in ${hours} ${hours === 1 ? "hour" : "hours"}`;
    if (mins > 0) return `Due in ${mins} ${mins === 1 ? "min" : "mins"}`;
    return "Due now";
  }
}

export function NearestDueTasksWidget() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ActionBoardTask[]>([]);

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
    const activeTasks = tasks.filter(t => t.column !== "done" && t.dueDate);

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

    // 4. Combine prioritized queue and take exactly first 5
    const prioritized = [...overdueTasks, ...upcomingTasks];
    return prioritized.slice(0, 5);
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

  if (displayedTasks.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60 min-h-[140px]">
        <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1.5" />
        <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">All Caught Up!</h4>
        <p className="text-[9px] text-slate-500 mt-1 max-w-[180px]">
          No active tasks with due dates in the database.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0 justify-center">
      <div className="space-y-2 max-h-full overflow-y-auto pr-1">
        {displayedTasks.map((task) => {
          const now = Date.now();
          const dueMs = typeof task.dueDate.toMillis === "function" ? task.dueDate.toMillis() : new Date(task.dueDate).getTime();
          const isOverdue = dueMs < now;
          const dueLabel = formatDueLabel(task.dueDate);

          return (
            <div
              key={task.id}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isOverdue
                  ? "bg-rose-50/40 border-rose-100/60 text-rose-800 hover:bg-rose-50/60"
                  : "bg-slate-50/60 border-slate-100/80 text-slate-800 hover:bg-slate-50/90"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black uppercase shrink-0 ${
                    isOverdue
                      ? "bg-rose-100 text-rose-700"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {task.assignedToName ? task.assignedToName.charAt(0) : "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate leading-tight">{task.title}</p>
                  <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">
                    {task.assignedToName || "Unassigned"}
                  </p>
                </div>
              </div>
              <span
                className={`text-[8px] font-black px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wide ${
                  isOverdue
                    ? "bg-rose-100/60 border-rose-200 text-rose-700"
                    : "bg-indigo-100/60 border-indigo-200 text-indigo-700"
                }`}
              >
                {dueLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
