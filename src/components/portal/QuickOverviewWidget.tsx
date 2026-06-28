"use client";

import { useState, useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { Clock, Users, Bot, CalendarCheck, TrendingUp, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from "@/lib/useDarkMode";
import { useRouter } from "next/navigation";

export function QuickOverviewWidget() {
  const { lang, t } = useTranslation();
  const isDarkMode = useDarkMode();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [contactCount, setContactCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [grantCount, setGrantCount] = useState(0);

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString(lang === "es" ? "es-ES" : "en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
      setCurrentDate(now.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { weekday: "long", month: "long", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lang]);

  // Load live counts
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const unsubs: (() => void)[] = [];

    import("firebase/firestore").then(({ collection, onSnapshot, query, where }) => {
      // Contacts
      const cq = query(collection(firestore, "users", user.uid, "customers"));
      unsubs.push(onSnapshot(cq, (snap) => setContactCount(snap.size), () => {}));

      // Active tasks
      const tq = query(collection(firestore, "action_board_tasks"), where("orgId", "==", "soltheory"));
      unsubs.push(onSnapshot(tq, (snap) => {
        setTaskCount(snap.docs.filter(d => d.data().column !== "done").length);
      }, () => {}));

      // Grants
      const gq = query(collection(firestore, "grants"));
      unsubs.push(onSnapshot(gq, (snap) => setGrantCount(snap.size), () => {}));
    });

    return () => unsubs.forEach(u => u());
  }, [firestore, user?.uid]);

  const quickLinks = [
    { icon: <Users className="w-4 h-4" />, label: lang === "es" ? "CRM" : "CRM", count: contactCount, href: "/portal/dashboard/soltheory/crm", color: "text-violet-500", bgColor: isDarkMode ? "bg-violet-950/40" : "bg-violet-50" },
    { icon: <CalendarCheck className="w-4 h-4" />, label: lang === "es" ? "Tareas" : "Tasks", count: taskCount, href: "/portal/dashboard/soltheory/action-board", color: "text-amber-500", bgColor: isDarkMode ? "bg-amber-950/40" : "bg-amber-50" },
    { icon: <Bot className="w-4 h-4" />, label: lang === "es" ? "Grants" : "Grants", count: grantCount, href: "/portal/dashboard/soltheory/grant-statuses", color: "text-emerald-500", bgColor: isDarkMode ? "bg-emerald-950/40" : "bg-emerald-50" },
  ];

  return (
    <div className="flex flex-col h-full w-full p-4 md:p-5 min-h-0 select-none">
      {/* Live Time Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isDarkMode ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {lang === "es" ? "En vivo" : "Live"}
          </span>
        </div>
        <div className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {currentTime}
        </div>
        <div className={`text-xs font-medium capitalize mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {currentDate}
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {lang === "es" ? "Acceso Rápido" : "Quick Access"}
        </span>
        <div className="flex flex-col gap-2 flex-1">
          {quickLinks.map((link, i) => (
            <button
              key={i}
              onClick={() => router.push(link.href)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600'
                  : 'bg-white/60 border-[#ede8da]/60 hover:bg-white hover:border-[#ede8da] hover:shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${link.bgColor} ${link.color}`}>
                {link.icon}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {link.label}
                </p>
                <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {link.count} {lang === "es" ? "registros" : "records"}
                </p>
              </div>
              <TrendingUp className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className={`mt-3 pt-3 border-t flex items-center justify-between shrink-0 ${isDarkMode ? 'border-slate-700/40' : 'border-slate-200/40'}`}>
        <div className="flex items-center gap-1.5">
          <Zap className={`w-3 h-3 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {lang === "es" ? "Sistema Operativo" : "All Systems Operational"}
          </span>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </div>
    </div>
  );
}
