"use client";

import { Calendar, ChevronRight, AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from "@/lib/useDarkMode";
import { useRouter } from "next/navigation";

export function UpcomingDeadlinesWidget() {
  const { lang } = useTranslation();
  const isDarkMode = useDarkMode();
  const router = useRouter();

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
          onClick={() => router.push("/portal/dashboard/soltheory/calendar")}
          className={`text-[9px] font-semibold flex items-center gap-0.5 hover:underline cursor-pointer ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}
        >
          {lang === "es" ? "Calendario" : "Calendar"}
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Deadlines Empty State */}
      <div className={`flex-1 flex flex-col items-center justify-center border p-4 rounded-xl text-center ${
        isDarkMode ? 'bg-slate-900/20 border-slate-800/60' : 'bg-[#fefcf6]/50 border-[#ede8da]/50'
      }`}>
        <AlertCircle className="w-6 h-6 text-slate-500 mb-1.5 animate-pulse" />
        <span className="text-[10px] font-semibold text-slate-450">
          {lang === "es" ? "No hay vencimientos próximos" : "No upcoming deadlines"}
        </span>
      </div>
    </div>
  );
}
