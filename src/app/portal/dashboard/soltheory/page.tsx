"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Building2, Users, Activity, Sparkles, Server, ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, getDocs, doc } from "firebase/firestore";

type TrafficData = { time: string; users: number };

export default function SolTheoryDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [activeUsers, setActiveUsers] = useState(0);
  const [activeOrgs, setActiveOrgs] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<TrafficData[]>([]);

  useEffect(() => {
    if (!firestore) return;

    const fetchCounts = async () => {
      try {
        const uSnap = await getDocs(collection(firestore, "users"));
        setActiveUsers(uSnap.size);
        const oSnap = await getDocs(collection(firestore, "organizations"));
        setActiveOrgs(oSnap.size);
      } catch (err) {
        console.error("Count fetch error:", err);
      }
    };
    fetchCounts();

    const unsubAnalytics = onSnapshot(doc(firestore, "platform_analytics", "traffic"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().history) {
        setAnalyticsData(docSnap.data().history);
      }
    });

    return () => {
      unsubAnalytics();
    };
  }, [firestore]);



  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-2">
            <Sparkles className="w-3 h-3" /> Master Control
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            SOL Theory <span className="text-indigo-600">Hub</span>
          </h1>
          <p className="text-slate-500 text-base max-w-2xl font-medium">
            Global administrative nervous system. Monitor cross-organization analytics, AI agent health, and internal communications.
          </p>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden relative transition-all hover:shadow-md rounded-2xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Active Organizations
            </CardTitle>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 mt-2">{activeOrgs}</div>
            <p className="text-xs text-emerald-600 flex items-center mt-3 font-semibold bg-emerald-50 w-fit px-2 py-1 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-1" /> Bound to live DB
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden relative transition-all hover:shadow-md rounded-2xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Target Clients
            </CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 mt-2 flex items-baseline gap-2">
              {activeUsers.toLocaleString()}
            </div>
            <p className="text-xs text-blue-600 flex items-center mt-3 font-semibold bg-blue-50 w-fit px-2 py-1 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-1" /> Verified Accounts
            </p>
          </CardContent>
        </Card>

        <Link href="/portal/dashboard/soltheory/ai-agents" className="block relative group h-full">
          <Card className="bg-slate-900 border-0 shadow-lg overflow-hidden h-full flex flex-col items-center justify-center transition-transform group-hover:-translate-y-1 rounded-2xl relative">
            <div className="absolute top-0 right-0 p-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            </div>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3 m-0">
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                <Server className="w-8 h-8 text-white" />
              </div>
              <div className="text-xl font-bold text-white tracking-widest uppercase mt-4">Agent Manager</div>
              <p className="text-slate-400 text-xs font-medium">Manage active AI protocols</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Analytics Chart */}
        <Card className="w-full bg-white border-0 shadow-sm ring-1 ring-slate-100 flex flex-col min-h-[400px] rounded-2xl">
          <CardHeader className="border-b border-slate-50 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-slate-900 text-lg font-extrabold flex items-center gap-3">
                  Platform Traffic Analytics
                  {analyticsData.length === 0 && <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse inline-block" />Awaiting data</span>}
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium mt-1">Live active tracking streaming from database.</CardDescription>
              </div>
              <div className="px-3 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">
                Today
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow pt-6 p-6">
            {analyticsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Activity className="w-8 h-8 opacity-50" />
                <span className="font-medium text-sm">Establishing Database Connection...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
