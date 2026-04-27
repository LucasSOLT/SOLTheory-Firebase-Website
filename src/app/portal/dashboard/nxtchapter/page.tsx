"use client";

import { useState, useEffect, useRef } from "react";

import { IntegrationColumn } from "@/components/portal/IntegrationPicker";
import { CollapsibleTile } from "@/components/ui/collapsible-tile";
import { DailyDigest } from "@/components/portal/DailyDigest";
import { RecentPlaces } from "@/components/portal/RecentPlaces";
import { RadialGraphs } from "@/components/portal/RadialGraphs";
import { useTranslation } from "@/lib/i18n";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  Eye, DollarSign, TrendingDown, ArrowUpRight, Filter, ArrowDownUp,
  Settings, CalendarDays, ChevronDown, Download, BarChart3, Users, Zap, Smile, Lock, Wallet, UserPlus, PieChart as PieChartIcon, Blocks, User, Globe, Activity, Database, Mail, HardDrive, Landmark, Clock
} from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart
} from "recharts";

/* ───── static mock data to match the reference design ───── */
const salesData: any[] = [];

const subscriberData = [
  { day: "Sun", value: 0 },
  { day: "Mon", value: 0 },
  { day: "Tue", value: 0 },
  { day: "Wed", value: 0 },
  { day: "Thu", value: 0 },
  { day: "Fri", value: 0 },
  { day: "Sat", value: 0 },
];

const distributionData: any[] = [];

const integrations: any[] = [];

/* ───── component ───── */
export default function NxtChapterDashboard() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isQuickBooksLinked, setIsQuickBooksLinked] = useState(false);

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
        <CollapsibleTile id="st-page-views" title="Page Views" icon={<Eye className="w-4 h-4 text-indigo-500" />} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Page Views</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800 tracking-tight">0</span>
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">0%</span>
          </div>
        </CollapsibleTile>

        {/* Transactions */}
        <CollapsibleTile id="nc-transactions" title="Transactions" icon={<DollarSign className="w-4 h-4 text-indigo-500" />} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Transactions</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          {!isQuickBooksLinked ? (
            <div className="flex flex-col items-center justify-center py-2 text-slate-400">
               <Lock className="w-5 h-5 mb-1 opacity-50" />
               <span className="text-[10px] font-medium text-center leading-tight">Connect QuickBooks<br/>to view transactions</span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs font-medium text-slate-400">No recent transactions</span>
            </div>
          )}
        </CollapsibleTile>

        {/* Survey Response Temperature */}
        <CollapsibleTile id="st-survey-response" title="Survey Response Temperature" icon={<Smile className="w-4 h-4 text-indigo-500" />} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                <Smile className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Response Temperature</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800 tracking-tight text-slate-300">N/A</span>
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">0% Avg</span>
          </div>
        </CollapsibleTile>
      </div>

      {/* ─── Middle Row: Sales Overview + Total Subscribers ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Expenses — 3 cols */}
        <CollapsibleTile id="nc-expenses" title="Expenses" icon={<Wallet className="w-4 h-4 text-slate-500" />} className="lg:col-span-3 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Expenses</h3>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                Last 30 days <ChevronDown className="w-3 h-3" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                •••
              </button>
            </div>
          </div>
          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
               <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-5 h-5 text-slate-400" />
               </div>
               <div>
                 <h4 className="text-sm font-semibold text-slate-700">QuickBooks Not Linked</h4>
                 <p className="text-xs text-slate-500 mt-1">Connect your QuickBooks account to view expenses.</p>
               </div>
             </div>
          ) : (
            <div className="flex flex-col mt-4">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl font-bold text-slate-800">$0</span>
                <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                   <TrendingDown className="w-3 h-3" /> 0%
                </span>
              </div>
              <div className="text-xs text-emerald-500 font-medium mb-6">
                ↓ Down 0% from prior 30 days
              </div>
    
              <div className="flex items-center gap-8 min-h-[160px]">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {/* Empty state for categories */}
                  <div className="text-sm text-slate-500">No expenses recorded.</div>
                </div>
              </div>
            </div>
          )}
        </CollapsibleTile>

        {/* Profit & Loss — 2 cols */}
        <CollapsibleTile id="nc-profit-loss" title="Profit & Loss" icon={<Activity className="w-4 h-4 text-slate-500" />} className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Profit & Loss</h3>
            </div>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              This month <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
               <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-5 h-5 text-slate-400" />
               </div>
               <div>
                 <p className="text-xs text-slate-500 mt-1">QuickBooks Required</p>
               </div>
             </div>
          ) : (
            <div className="flex flex-col mt-4">
              <div className="text-xs text-slate-500 font-medium mb-1">Net profit for this month</div>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl font-bold text-slate-800">$0</span>
              </div>
              <div className="text-xs text-amber-500 font-medium mb-6">
                ↓ Down 0% from last month
              </div>
              
              <div className="space-y-6 flex-1 min-h-[160px]">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-800">$0 <span className="font-medium text-slate-500 ml-1">Income</span></span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 overflow-hidden relative" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 50%, #e2e8f0 50%, #e2e8f0 75%, transparent 75%, transparent)' }}>
                     <div className="h-full bg-emerald-500 w-[0%]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-800">$0 <span className="font-medium text-slate-500 ml-1">Expenses</span></span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 overflow-hidden relative" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 50%, #e2e8f0 50%, #e2e8f0 75%, transparent 75%, transparent)' }}>
                     <div className="h-full bg-teal-500 w-[0%]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CollapsibleTile>
      </div>

      {/* ─── Bottom Row: Sales Distribution + List of Integration ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bank Accounts */}
        <CollapsibleTile id="nc-bank-accounts" title="Bank Accounts" icon={<Landmark className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Bank Accounts</h3>
            </div>
            <span className="text-xs font-medium text-slate-500">As of today</span>
          </div>

          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-4 h-4 text-slate-400" />
               </div>
               <div>
                 <p className="text-xs text-slate-500 mt-1">QuickBooks Required</p>
               </div>
             </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-slate-500">
                Today's bank balance
              </div>
              <div className="text-3xl font-bold text-slate-800">$0</div>
              
              <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-4">
                {/* Empty State */}
                <div className="text-sm text-slate-500 text-center py-4">No bank accounts linked.</div>
              </div>
            </div>
          )}
        </CollapsibleTile>

        {/* List of Integration */}
        <CollapsibleTile id="nc-list-int" title="List of Integration" icon={<Blocks className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Blocks className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">List of Integration</h3>
            </div>
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
            {integrations.length === 0 ? (
               <div className="text-xs text-center text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">No active integrations found.</div>
            ) : integrations.map((item) => (
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
        </CollapsibleTile>
      </div>

      {/* ─── Row 4: Mock Box + Daily Digest ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Team Activity (mock) */}
        <CollapsibleTile id="nc-team-activity" title="Team Activity" icon={<User className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-500">
                <User className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Team Activity</h3>
            </div>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              This Week <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {[
              { name: user?.displayName || "You", role: "Admin", status: "Online", color: "bg-emerald-500" }
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{(m.name || "U").charAt(0)}</div>
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
        </CollapsibleTile>

        {/* Team Member Time Cards */}
        <CollapsibleTile id="nc-time-cards" title="Team Member Time Cards" icon={<Clock className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Team Member Time Cards</h3>
            </div>
            <div className="flex items-center gap-2">
               <input type="date" className="px-2 py-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 rounded-md border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500" defaultValue={new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).toISOString().split('T')[0]} />
               <span className="text-xs text-slate-400">-</span>
               <input type="date" className="px-2 py-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 rounded-md border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
          </div>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{(user?.displayName || "U")[0]}</div>
                   <div>
                      <p className="text-sm font-semibold text-slate-700">{user?.displayName || "You"}</p>
                      <p className="text-[10px] text-slate-500">Admin</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-sm font-bold text-slate-800">0h 0m</p>
                   <p className="text-[10px] text-slate-500">This period</p>
                </div>
             </div>
             {/* Other members would map here */}
          </div>
        </CollapsibleTile>
      </div>

      {/* ─── Row 5: Two more mock boxes ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Events (mock) */}
        <CollapsibleTile id="st-upcoming" title="Upcoming Events" icon={<CalendarDays className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Upcoming Events</h3>
            </div>
            <button className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">View Calendar</button>
          </div>
          <div className="space-y-3">
            <div className="text-xs text-center text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">No upcoming events scheduled.</div>
          </div>
        </CollapsibleTile>

        {/* Active Services */}
        <CollapsibleTile id="nc-active-services" title="Active Services" icon={<Activity className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Active Services</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Email Sync", status: "Active", Icon: Mail, color: "text-blue-500", bg: "bg-blue-50" },
              { label: "Drive Indexer", status: "Idle", Icon: HardDrive, color: "text-slate-500", bg: "bg-slate-50" },
              { label: "Cal Sync", status: "Active", Icon: CalendarDays, color: "text-emerald-500", bg: "bg-emerald-50" },
              { label: "Backup", status: "2h ago", Icon: Database, color: "text-amber-500", bg: "bg-amber-50" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>
                  <s.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{s.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{s.status}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleTile>
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
