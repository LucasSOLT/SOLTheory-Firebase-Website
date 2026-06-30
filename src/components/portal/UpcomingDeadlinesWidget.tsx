"use client";

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Calendar, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from "@/lib/useDarkMode";
import { useRouter } from "next/navigation";

interface DeadlineTask {
  id: string;
  title: string;
  column: string;
  dueDate: any;
}

function getDueMs(dueDate: any): number {
  if (!dueDate) return Infinity;
  return typeof dueDate.toMillis === "function"
    ? dueDate.toMillis()
    : new Date(dueDate).getTime();
}

function formatDueLabel(dueDate: any, lang: string): string {
  const now = Date.now();
  const dueMs = getDueMs(dueDate);
  const diff = dueMs - now;
  const absDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
  const absHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));

  if (diff < 0) {
    // Overdue
    if (absDays > 0) {
      return lang === "es" ? `Vencido · ${absDays}d` : `Overdue · ${absDays}d`;
    }
    if (absHours > 0) {
      return lang === "es" ? `Vencido · ${absHours}h` : `Overdue · ${absHours}h`;
    }
    return lang === "es" ? "Vencido" : "Overdue";
  }

  // Upcoming
  if (absDays === 0) {
    if (absHours <= 1) return lang === "es" ? "Vence ahora" : "Due now";
    return lang === "es" ? `Vence en ${absHours}h` : `Due in ${absHours}h`;
  }
  if (absDays === 1) return lang === "es" ? "Vence mañana" : "Due tomorrow";
  return lang === "es" ? `Vence en ${absDays}d` : `Due in ${absDays}d`;
}

type DotColor = "red" | "amber" | "green";

function getDotColor(dueDate: any): DotColor {
  const now = Date.now();
  const dueMs = getDueMs(dueDate);
  const diff = dueMs - now;
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 0) return "red";       // overdue
  if (days <= 2) return "amber";     // due within 2 days
  return "green";                    // due within 7 days
}

const DOT_CLASSES: Record<DotColor, { light: string; dark: string }> = {
  red:   { light: "bg-rose-500",   dark: "bg-rose-400" },
  amber: { light: "bg-amber-500",  dark: "bg-amber-400" },
  green: { light: "bg-emerald-500", dark: "bg-emerald-400" },
};

const LABEL_CLASSES: Record<DotColor, { light: string; dark: string }> = {
  red:   { light: "text-rose-600",    dark: "text-rose-400" },
  amber: { light: "text-amber-700",   dark: "text-amber-400" },
  green: { light: "text-emerald-700", dark: "text-emerald-400" },
};

export function UpcomingDeadlinesWidget({ orgId = "soltheory" }: { orgId?: string }) {
  const { lang } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isDarkMode = useDarkMode();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<DeadlineTask[]>([]);

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    setLoading(true);

    const tasksRef = collection(firestore, "action_board_tasks");
    const q = query(
      tasksRef,
      where("orgId", "==", orgId),
      where("column", "!=", "done")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched: DeadlineTask[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.dueDate) {
            fetched.push({
              id: d.id,
              title: data.title || "",
              column: data.column,
              dueDate: data.dueDate,
            });
          }
        });
        setTasks(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("UpcomingDeadlinesWidget: error loading tasks:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid, orgId]);

  // Filter to tasks due within 7 days (or already overdue), sort ascending, take 5
  const displayedTasks = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return tasks
      .filter((t) => {
        const dueMs = getDueMs(t.dueDate);
        return dueMs - now <= sevenDaysMs; // includes overdue (negative diff)
      })
      .sort((a, b) => getDueMs(a.dueDate) - getDueMs(b.dueDate))
      .slice(0, 5);
  }, [tasks]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="flex flex-col h-full w-full min-h-0 select-none justify-between">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {lang === "es" ? "Próximos Vencimientos" : "Upcoming Deadlines"}
            </h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className={`w-5 h-5 animate-spin ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 select-none justify-between">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center gap-1.5">
          <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            {lang === "es" ? "Próximos Vencimientos" : "Upcoming Deadlines"}
          </h3>
        </div>
        <button
          onClick={() => router.push(`/portal/dashboard/${orgId}/calendar`)}
          className={`text-[9px] font-semibold flex items-center gap-0.5 hover:underline cursor-pointer ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}
        >
          {lang === "es" ? "Calendario" : "Calendar"}
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Task list or empty state */}
      {displayedTasks.length === 0 ? (
        /* --- Empty State --- */
        <div className={`flex-1 flex flex-col items-center justify-center border p-4 rounded-xl text-center ${
          isDarkMode ? 'bg-slate-900/20 border-slate-800/60' : 'bg-[#faf8f3]/50 border-[#ede8da]/50'
        }`}>
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1.5" />
          <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-450'}`}>
            {lang === "es" ? "No hay vencimientos próximos" : "No upcoming deadlines"}
          </span>
        </div>
      ) : (
        /* --- Task Items --- */
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {displayedTasks.map((task) => {
            const dotColor = getDotColor(task.dueDate);
            const dueLabel = formatDueLabel(task.dueDate, lang);
            const dotCls = isDarkMode ? DOT_CLASSES[dotColor].dark : DOT_CLASSES[dotColor].light;
            const labelCls = isDarkMode ? LABEL_CLASSES[dotColor].dark : LABEL_CLASSES[dotColor].light;

            return (
              <button
                key={task.id}
                onClick={() => router.push(`/portal/dashboard/${orgId}/action-board?highlight=${task.id}`)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all group cursor-pointer hover:shadow-sm text-left ${
                  isDarkMode
                    ? 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/60'
                    : 'bg-[#faf8f3] border-[#ede8da] hover:bg-[#f5f0e5]'
                }`}
              >
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />

                {/* Title */}
                <span className={`flex-1 min-w-0 text-[12px] font-semibold truncate leading-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                  {task.title}
                </span>

                {/* Due label */}
                <span className={`text-[9px] font-bold shrink-0 whitespace-nowrap ${labelCls}`}>
                  {dueLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
