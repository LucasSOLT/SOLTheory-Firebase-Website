"use client";

import { useState, useEffect, useRef } from "react";

import { IntegrationColumn } from "@/components/portal/IntegrationPicker";
import { DailyDigest } from "@/components/portal/DailyDigest";
import { RecentPlaces } from "@/components/portal/RecentPlaces";
import { RadialGraphs } from "@/components/portal/RadialGraphs";
import { useTranslation } from "@/lib/i18n";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  Eye, DollarSign, TrendingDown, ArrowUpRight, Filter, ArrowDownUp,
  Settings, CalendarDays, ChevronDown, Download
} from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

/* ───── static mock data to match the reference design ───── */
const salesData = [
  { month: "Oct", china: 2988, uk: 1200, usa: 900, canada: 600, other: 400 },
  { month: "Nov", china: 1765, uk: 1400, usa: 800, canada: 700, other: 350 },
  { month: "Dec", china: 4005, uk: 1600, usa: 1100, canada: 500, other: 500 },
];

const subscriberData = [
  { day: "Sun", value: 1800 },
  { day: "Mon", value: 2200 },
  { day: "Tue", value: 3874 },
  { day: "Wed", value: 2400 },
  { day: "Thu", value: 2800 },
  { day: "Fri", value: 1900 },
  { day: "Sat", value: 2100 },
];

const distributionData = [
  { label: "Website", value: 374.82, pct: 55 },
  { label: "Mobile App", value: 241.60, pct: 35 },
  { label: "Other", value: 213.42, pct: 10 },
];

const integrations = [
  { app: "Stripe", type: "Finance", rate: 40, profit: "$650.00" },
  { app: "Zapier", type: "CRM", rate: 80, profit: "$720.56" },
  { app: "Shopify", type: "Marketplace", rate: 20, profit: "$432.25" },
];

/* ───── component ───── */
export default function NxtChapterDashboard() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();

  /* presence tracking (keep existing logic) */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    updateDoc(userRef, { currentDashboard: "nxtchapter" }).catch(() => {});
    const handleBeforeUnload = () => updateDoc(userRef, { currentDashboard: null }).catch(() => {});
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      updateDoc(userRef, { currentDashboard: null }).catch(() => {});
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [firestore, user?.uid]);

  return (
    <div className="w-full mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr_220px] gap-5 items-stretch">
        {/* Left Integration Slots */}
        <div className="hidden xl:flex flex-col gap-5 h-full">
          <IntegrationColumn side="left" />
          <div className="flex-1 flex flex-col min-h-0">
            <RecentPlaces />
          </div>
        </div>

        {/* Center Dashboard Content */}
        <div className="space-y-6 min-w-0">

      {/* ─── Dashboard Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <CalendarDays className="w-3.5 h-3.5" /> Oct 18 – Nov 18
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            Monthly <ChevronDown className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* ─── Top 3 Metric Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Page Views */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <Eye className="w-4 h-4" /> Page Views
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800 tracking-tight">12,450</span>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">15.8% ↑</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <DollarSign className="w-4 h-4" /> Total Revenue
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800 tracking-tight">$ 363.95</span>
            <span className="text-xs font-semibold text-red-400 bg-red-50 px-1.5 py-0.5 rounded">34.0% ↓</span>
          </div>
        </div>

        {/* Bounce Rate */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <TrendingDown className="w-4 h-4" /> Bounce Rate
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800 tracking-tight">86.5%</span>
            <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">24.2% ↑</span>
          </div>
        </div>
      </div>

      {/* ─── Middle Row: Sales Overview + Total Subscribers ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Sales Overview — 3 cols */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-700">Sales Overview</h3>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                <Filter className="w-3 h-3" /> Filter
              </button>
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                <ArrowDownUp className="w-3 h-3" /> Sort
              </button>
              <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                •••
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-bold text-slate-800">$ 9,257.51</span>
          </div>
          <div className="flex items-center gap-4 mb-5 text-xs text-slate-400 font-medium">
            <span className="text-emerald-500">15.6% ↑</span>
            <span>+ $143.50 increased</span>
          </div>

          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  cursor={{ fill: 'rgba(99,102,241,0.04)' }}
                />
                <Bar dataKey="china" stackId="a" fill="#c7d2fe" radius={[0, 0, 0, 0]} />
                <Bar dataKey="uk" stackId="a" fill="#a5b4fc" />
                <Bar dataKey="usa" stackId="a" fill="#818cf8" />
                <Bar dataKey="canada" stackId="a" fill="#6366f1" />
                <Bar dataKey="other" stackId="a" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {[
              { label: "China", color: "#c7d2fe" },
              { label: "UK", color: "#a5b4fc" },
              { label: "USA", color: "#818cf8" },
              { label: "Canada", color: "#6366f1" },
              { label: "Other", color: "#4f46e5" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-400 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total Subscribers — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-700">Total Subscriber</h3>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              Weekly <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-bold text-slate-800">24,473</span>
          </div>
          <div className="flex items-center gap-3 mb-5 text-xs text-slate-400 font-medium">
            <span className="text-emerald-500">8.3% ↑</span>
            <span>+ 749 increased</span>
          </div>

          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subscriberData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  cursor={{ fill: 'rgba(99,102,241,0.04)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {subscriberData.map((entry, index) => (
                    <Cell key={index} fill={entry.day === "Tue" ? "#6366f1" : "#e0e7ff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Sales Distribution + List of Integration ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sales Distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-700">Sales Distribution</h3>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              Monthly <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {distributionData.map((d) => (
              <div key={d.label} className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{d.label}</span>
                <span className="text-lg font-bold text-slate-800">$ {d.value.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Horizontal Bars */}
          <div className="space-y-4">
            {distributionData.map((d) => (
              <div key={d.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{d.label}</span>
                  <span className="text-slate-400">{d.pct}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.pct}%`, background: "linear-gradient(90deg, #c7d2fe, #818cf8)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* List of Integration */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-700">List of Integration</h3>
            <button className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
              See All
            </button>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">
            <span>Application</span>
            <span>Type</span>
            <span>Rate</span>
            <span className="text-right">Profit</span>
          </div>

          {/* Table Rows */}
          <div className="space-y-4">
            {integrations.map((item) => (
              <div key={item.app} className="grid grid-cols-4 gap-4 items-center px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-500">{item.app.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{item.app}</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">{item.type}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-300 rounded-full" style={{ width: `${item.rate}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{item.rate}%</span>
                </div>
                <span className="text-sm font-semibold text-slate-700 text-right">{item.profit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Row 4: Mock Box + Daily Digest ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Team Activity (mock) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-700">Team Activity</h3>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              This Week <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {[
              { name: "Lucas M.", role: "Admin", status: "Active", color: "bg-emerald-500" },
              { name: "Jarvis AI", role: "Agent", status: "Online", color: "bg-indigo-500" },
              { name: "Morpheus AI", role: "Agent", status: "Standby", color: "bg-amber-400" },
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{m.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{m.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{m.role}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${m.color}`} />
                  <span className="text-[10px] text-slate-500 font-medium">{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Digest */}
        <DailyDigest />
      </div>

      {/* ─── Row 5: Two more mock boxes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Events (mock) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-700">Upcoming Events</h3>
            <button className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">View Calendar</button>
          </div>
          <div className="space-y-3">
            {[
              { title: "Weekly Team Sync", time: "10:00 AM", day: "Today", accent: "border-l-indigo-500 bg-indigo-50/30" },
              { title: "Client Strategy Call", time: "2:30 PM", day: "Today", accent: "border-l-emerald-500 bg-emerald-50/30" },
              { title: "Sprint Review", time: "9:00 AM", day: "Tomorrow", accent: "border-l-fuchsia-500 bg-fuchsia-50/30" },
            ].map((e) => (
              <div key={e.title} className={`flex items-center gap-3 p-3 rounded-xl border-l-[3px] ${e.accent}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{e.title}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{e.day} · {e.time}</p>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions (mock) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-700">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Compose Email", icon: "✉️", bg: "bg-blue-50 hover:bg-blue-100" },
              { label: "New Document", icon: "📄", bg: "bg-green-50 hover:bg-green-100" },
              { label: "Schedule Meeting", icon: "📅", bg: "bg-purple-50 hover:bg-purple-100" },
              { label: "Ask Jarvis", icon: "🤖", bg: "bg-amber-50 hover:bg-amber-100" },
            ].map((a) => (
              <button key={a.label} className={`flex items-center gap-2.5 p-3.5 rounded-xl text-left transition-colors cursor-pointer ${a.bg} border border-transparent`}>
                <span className="text-lg">{a.icon}</span>
                <span className="text-xs font-semibold text-slate-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
        </div>

        {/* Right Integration Slots */}
        <div className="hidden xl:flex flex-col gap-5 h-full">
          <IntegrationColumn side="right" />
          <div className="flex-1 flex flex-col min-h-0">
            <RadialGraphs />
          </div>
        </div>
      </div>
    </div>
  );
}
