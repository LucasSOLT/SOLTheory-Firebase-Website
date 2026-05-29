"use client";

import { useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Users, Activity, TrendingUp, CalendarDays, Smile, Percent, Zap } from "lucide-react";

export default function SolTheoryDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  /* presence tracking (keep existing logic) */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    updateDoc(userRef, { currentDashboard: "soltheory" }).catch(() => {});
    const handleBeforeUnload = () => updateDoc(userRef, { currentDashboard: null }).catch(() => {});
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      updateDoc(userRef, { currentDashboard: null }).catch(() => {});
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [firestore, user?.uid]);

  return (
    <div className="w-full mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10 px-4 sm:px-8 focus:outline-none" tabIndex={-1}>
      <div className="space-y-6 min-w-0 w-full">
        {/* Dashboard Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.displayName || "Lucas"}.
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Here is your week at a glance.
          </p>
        </div>

        {/* Redesigned Infographics Grid Layout */}
        <div className="space-y-5">
          
          {/* Row 1: Top (Left 2:3 stacked, Right 16:9 split) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 1: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards */}
            <div className="flex-[3] aspect-[2/3] flex flex-col gap-5">
              {/* Card 1A: Top Performing Agents */}
              <div className="flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Performing Agents</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  {[
                    { name: "Lucas S.", role: "CTO / Super Admin", score: 98, color: "bg-indigo-500", initials: "LS" },
                    { name: "Steve M.", role: "Creative Lead", score: 94, color: "bg-violet-500", initials: "SM" },
                    { name: "Sarah F.", role: "Operations Specialist", score: 89, color: "bg-emerald-500", initials: "SF" },
                  ].map((agent, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${agent.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {agent.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{agent.name}</p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${agent.color} rounded-full`} style={{ width: `${agent.score}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-700 shrink-0 ml-1">{agent.score}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 1B: Action Board Timeline */}
              <div className="flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Board Activity Timeline</span>
                  <Activity className="w-4 h-4 text-slate-400" />
                </div>
                <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                  {[
                    { title: "Design Phase Complete", time: "10m ago", active: false, done: true },
                    { title: "Firestore Integration", time: "1h ago", active: false, done: true },
                    { title: "Vercel Deployment", time: "Active", active: true, done: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full border-2 ${step.active ? "border-indigo-500 bg-white" : step.done ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"}`} />
                        {i < 2 && <div className="w-px h-6 bg-slate-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${step.active ? "text-indigo-600 font-bold" : "text-slate-700"}`}>{step.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{step.time}</p>
                      </div>
                      {step.active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Slot 2: Aspect 16:9 (Wide, Large) -> Custom Grid of 3 Infographics */}
            <div className="flex-[8] aspect-[16/9] grid grid-cols-2 grid-rows-[auto_1fr] gap-5">
              {/* KPI Card A: Conversion Rate */}
              <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Conversion Rate</span>
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-xl font-extrabold text-slate-800">4.82%</span>
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center">▲ +12%</span>
                  </div>
                  {/* Miniature SVG Sparkline */}
                  <div className="w-full h-8 mt-2 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grad-kpi-1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 25 Q 20 15 40 20 T 80 5 T 100 20 L 100 30 L 0 30 Z" fill="url(#grad-kpi-1)" />
                      <path d="M 0 25 Q 20 15 40 20 T 80 5 T 100 20" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* KPI Card B: Active Users */}
                <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Active Users</span>
                    <Users className="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-xl font-extrabold text-slate-800">1,248</span>
                    <span className="text-[10px] text-indigo-500 font-bold flex items-center">▲ +8.4%</span>
                  </div>
                  {/* Miniature SVG Sparkline */}
                  <div className="w-full h-8 mt-2 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grad-kpi-2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 28 Q 20 20 40 10 T 80 18 T 100 5 L 100 30 L 0 30 Z" fill="url(#grad-kpi-2)" />
                      <path d="M 0 28 Q 20 20 40 10 T 80 18 T 100 5" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

              {/* Bottom Row: Full-width Area Chart */}
              <div className="col-span-2 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Revenue Analytics</span>
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-white text-slate-700 shadow-sm">1W</span>
                    <span className="px-2 py-0.5 text-[9px] font-bold text-slate-500">1M</span>
                  </div>
                </div>
                {/* Large SVG Area Chart */}
                <div className="flex-1 w-full min-h-0 relative mt-2">
                  <svg className="w-full h-full" viewBox="0 0 500 130" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="grad-area-large" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="32.5" x2="500" y2="32.5" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="65" x2="500" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="97.5" x2="500" y2="97.5" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <path d="M 0 110 Q 70 80 140 95 T 280 40 T 420 60 T 500 20 L 500 130 L 0 130 Z" fill="url(#grad-area-large)" />
                    <path d="M 0 110 Q 70 80 140 95 T 280 40 T 420 60 T 500 20" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="280" cy="40" r="4.5" fill="#4f46e5" stroke="white" strokeWidth="1.5" className="animate-pulse" />
                    <circle cx="500" cy="20" r="4" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Middle (Left 16:9 Bar Chart, Right 16:9 Donut + Sparkline) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 3: Left (Aspect 16:9) -> Single Full-Height detailed SVG Bar Chart */}
            <div className="flex-1 aspect-[16/9] bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Performance Analysis</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Category Growth</span>
              </div>
              {/* Detailed SVG Bar Chart */}
              <div className="flex-1 w-full min-h-0 flex items-end gap-5 px-3 py-1 relative">
                {[
                  { label: "CRM", value: 85, color: "bg-indigo-500" },
                  { label: "DRiVE", value: 62, color: "bg-blue-500" },
                  { label: "BI", value: 92, color: "bg-emerald-500" },
                  { label: "ERP", value: 45, color: "bg-amber-500" },
                  { label: "AI", value: 78, color: "bg-violet-500" },
                ].map((bar, i) => (
                  <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                    <div className="w-full flex-1 flex flex-col justify-end relative">
                      <div className={`w-full ${bar.color} rounded-t-lg transition-all duration-1000`} style={{ height: `${bar.value}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">{bar.label}</span>
                    <span className="text-[9px] text-slate-400 font-bold leading-none">{bar.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Slot 4: Right (Aspect 16:9) -> Split vertically 2/3 and 1/3 */}
            <div className="flex-1 aspect-[16/9] flex flex-col gap-5">
              {/* Card 4A (2/3 Height): Donut Chart Breakdown */}
              <div className="flex-[2] bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">User Demographics Breakdown</span>
                  <span className="text-[10px] text-indigo-500 font-bold">4 Categories</span>
                </div>
                {/* SVG Donut and Legend Row */}
                <div className="flex items-center justify-around flex-1 gap-4 min-h-0">
                  <div className="w-24 h-24 shrink-0 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#4f46e5" strokeWidth="4.2" strokeDasharray="40 100" strokeDashoffset="0" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#8b5cf6" strokeWidth="4.2" strokeDasharray="30 100" strokeDashoffset="-40" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4.2" strokeDasharray="20 100" strokeDashoffset="-70" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4.2" strokeDasharray="10 100" strokeDashoffset="-90" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-[11px] font-black text-slate-800">100%</span>
                      <span className="text-[8px] text-slate-400 uppercase font-bold">Total</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[10px] font-semibold text-slate-500">
                    {[
                      { label: "CRM Members", val: "40%", color: "bg-indigo-500" },
                      { label: "BI Analytics", val: "30%", color: "bg-violet-500" },
                      { label: "Action Board", val: "20%", color: "bg-emerald-500" },
                      { label: "Administrators", val: "10%", color: "bg-amber-500" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                        <span>{item.label}:</span>
                        <span className="font-bold text-slate-700 ml-auto">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 4B (1/3 Height): Micro-Trend Sparkline & Status */}
              <div className="flex-[1] bg-white border border-slate-200/80 shadow-sm rounded-2xl px-5 py-3.5 flex items-center justify-between hover:shadow-md transition-shadow min-h-0">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Real-time Latency</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-black text-slate-800">12ms Response</span>
                  </div>
                </div>
                <div className="w-36 h-8 overflow-hidden shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M 0 15 L 10 12 L 20 18 L 30 5 L 40 10 L 50 14 L 60 4 L 70 12 L 80 6 L 90 10 L 100 3" fill="none" stroke="#10b981" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Bottom (Left 16:9 KPI/Line Grid, Right 2:3 Stacked Milestones/Uptime) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 5: Aspect 16:9 (Wide, Large) -> Custom Grid of 3 Infographics */}
            <div className="flex-[8] aspect-[16/9] grid grid-cols-2 grid-rows-[auto_1fr] gap-5">
              {/* KPI Card A: Retention Rate */}
              <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Retention Rate</span>
                    <Percent className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-xl font-extrabold text-slate-800">92.4%</span>
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center">▲ +1.2%</span>
                  </div>
                  {/* Miniature SVG Sparkline */}
                  <div className="w-full h-8 mt-2 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grad-kpi-3" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 20 Q 20 8 40 18 T 80 5 T 100 12 L 100 30 L 0 30 Z" fill="url(#grad-kpi-3)" />
                      <path d="M 0 20 Q 20 8 40 18 T 80 5 T 100 12" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                {/* KPI Card B: Satisfaction Score (CSAT) */}
                <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Satisfaction CSAT</span>
                    <Smile className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-xl font-extrabold text-slate-800">4.9 / 5.0</span>
                    <span className="text-[10px] text-amber-500 font-bold flex items-center">★★★★★</span>
                  </div>
                  {/* Miniature SVG Sparkline */}
                  <div className="w-full h-8 mt-2 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grad-kpi-4" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 10 Q 20 22 40 8 T 80 15 T 100 4 L 100 30 L 0 30 Z" fill="url(#grad-kpi-4)" />
                      <path d="M 0 10 Q 20 22 40 8 T 80 15 T 100 4" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

              {/* Bottom Row: Full-width Operations Line Chart */}
              <div className="col-span-2 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">API Response Uptime (24h)</span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="font-semibold text-slate-700">99.98% Uptime</span>
                  </div>
                </div>
                {/* Large SVG Line Chart */}
                <div className="flex-1 w-full min-h-0 relative mt-2">
                  <svg className="w-full h-full" viewBox="0 0 500 130" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="grad-line-large" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="32.5" x2="500" y2="32.5" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="65" x2="500" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="97.5" x2="500" y2="97.5" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <path d="M 0 50 L 50 48 L 100 52 L 150 42 L 200 45 L 250 51 L 300 40 L 350 43 L 400 41 L 450 38 L 500 35 L 500 130 L 0 130 Z" fill="url(#grad-line-large)" />
                    <path d="M 0 50 L 50 48 L 100 52 L 150 42 L 200 45 L 250 51 L 300 40 L 350 43 L 400 41 L 450 38 L 500 35" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="300" cy="40" r="4.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
                    <circle cx="500" cy="35" r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Slot 6: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards */}
            <div className="flex-[3] aspect-[2/3] flex flex-col gap-5">
              {/* Card 6A: Upcoming Milestones */}
              <div className="flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upcoming Milestones</span>
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                </div>
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  {[
                    { title: "Q3 Strategy Align", time: "In 2 hours", label: "Meeting", color: "text-amber-600 bg-amber-50 border-amber-100" },
                    { title: "Action Board V1", time: "Tomorrow", label: "Milestone", color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                    { title: "Database Audit", time: "Jun 04", label: "Task", color: "text-slate-600 bg-slate-50 border-slate-100" },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between gap-2.5 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{m.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{m.time}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${m.color}`}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 6B: System Status / Health Uptime */}
              <div className="flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">System Health Uptime</span>
                  <Zap className="w-4 h-4 text-slate-400" />
                </div>
                {/* Glowing Radial Uptime gauge */}
                <div className="flex-1 flex items-center justify-around gap-2 min-h-0">
                  <div className="w-20 h-20 relative flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.2" strokeDasharray="99.98 100" strokeDashoffset="0" />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-slate-800">99.9%</span>
                      <span className="text-[7px] text-emerald-500 uppercase font-bold tracking-wide">Uptime</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-[9px] font-bold text-slate-500 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>API: 12ms</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>DB: Active</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>SSL: Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
