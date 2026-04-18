"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Building2, Users, Activity, Sparkles, Server, ArrowUpRight, Settings, MessageSquare, Coins
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

type TrafficData = { time: string; users: number };

export default function SolTheoryDashboard() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const [activeUsers, setActiveUsers] = useState(0);
  const [activeOrgs, setActiveOrgs] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<TrafficData[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [monthlyData, setMonthlyData] = useState<{month: string; users: number}[]>([]);
  
  const [liveOccupancy, setLiveOccupancy] = useState(0);
  const liveOccupancyRef = useRef(0);

  useEffect(() => {
    liveOccupancyRef.current = liveOccupancy;
  }, [liveOccupancy]);

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    updateDoc(userRef, { currentDashboard: "soltheory" }).catch(() => {});

    const handleBeforeUnload = () => {
      updateDoc(userRef, { currentDashboard: null }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      updateDoc(userRef, { currentDashboard: null }).catch(() => {});
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [firestore, user?.uid]);

  useEffect(() => {
    if (!firestore) return;

    const fetchCounts = async () => {
      try {
        const uSnap = await getDocs(collection(firestore, "users"));
        setActiveUsers(uSnap.size);
        const oSnap = await getDocs(collection(firestore, "organizations"));
        setActiveOrgs(oSnap.size);

        const monthlyCounts: Record<string, number> = {};
        uSnap.forEach(doc => {
          const data = doc.data();
          if (data.createdAt) {
             let date;
             if (data.createdAt.toDate) date = data.createdAt.toDate();
             else date = new Date(data.createdAt);
             const month = date.toLocaleString('default', { month: 'short' });
             monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
          }
        });
        
        if (Object.keys(monthlyCounts).length > 0) {
           const formatData = Object.keys(monthlyCounts).map(m => ({ month: m, users: monthlyCounts[m] }));
           setMonthlyData(formatData);
        } else {
           setMonthlyData([]);
        }
      } catch (err) {
        console.error("Count fetch error:", err);
      }
    };
    fetchCounts();

    try {
      let totalChars = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('st_agent_sessions_') || key.startsWith('agent_sessions_'))) {
          const sessions = JSON.parse(localStorage.getItem(key) || '[]');
          sessions.forEach((s: any) => {
            s.messages?.forEach((m: any) => {
              if (m.text) totalChars += m.text.length;
              if (m.hiddenContext) totalChars += m.hiddenContext.length;
            });
          });
        }
      }
      const tokens = Math.floor(totalChars / 4);
      setEstimatedCost((tokens / 1_000_000) * 0.70);
    } catch(e) {}

    const q = query(collection(firestore, "users"), where("currentDashboard", "==", "soltheory"));
    const unsubPresence = onSnapshot(q, (snap) => {
      setLiveOccupancy(snap.size);
    });

    return () => unsubPresence();
  }, [firestore]);

  useEffect(() => {
    const defaultData = Array.from({length: 20}, (_, i) => ({
      time: new Date(Date.now() - (19 - i) * 5000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      users: 0
    }));
    setAnalyticsData(defaultData);

    const interval = setInterval(() => {
      setAnalyticsData(prev => {
        const next = [...prev.slice(1)];
        next.push({
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          users: liveOccupancyRef.current
        });
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            {t.solTheoryHub} <span className="text-indigo-600">Hub</span>
          </h1>
          <p className="text-slate-500 text-base max-w-2xl font-medium">
            {t.solTheoryHubDesc}
          </p>
        </div>
        
        <div className="flex items-center shrink-0">
          <Link href="/portal/dashboard/soltheory/settings" className="w-14 h-14 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all group">
            <Settings className="w-7 h-7 group-hover:rotate-90 transition-transform duration-500" />
          </Link>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden relative transition-all hover:shadow-md rounded-2xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Estimated Token Cost
            </CardTitle>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Coins className="w-4 h-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 mt-2">
              ${estimatedCost.toFixed(4)}
            </div>
            <p className="text-xs text-emerald-600 flex items-center mt-3 font-semibold bg-emerald-50 w-fit px-2 py-1 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-1" /> Groq API Equivalency
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm ring-1 ring-slate-100 overflow-hidden relative transition-all hover:shadow-md rounded-2xl">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wide">
              Unread Messages
            </CardTitle>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900 mt-2 flex items-baseline gap-2">
              {unreadMessages}
            </div>
            <p className="text-xs text-indigo-600 flex items-center mt-3 font-semibold bg-indigo-50 w-fit px-2 py-1 rounded-md">
              <ArrowUpRight className="w-3 h-3 mr-1" /> @Messages Feature
            </p>
          </CardContent>
        </Card>

        <Link href="/portal/dashboard/soltheory/ai-agents/jarvis" className="block relative group h-full">
          <Card className="bg-slate-100 border-0 shadow-lg overflow-hidden h-full flex flex-col items-center justify-center transition-transform group-hover:-translate-y-1 rounded-2xl relative">
            <div className="absolute top-0 right-0 p-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            </div>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3 m-0">
              <div className="p-4 bg-white rounded-2xl backdrop-blur-md border border-slate-200">
                <Server className="w-8 h-8 text-slate-700" />
              </div>
              <div className="text-xl font-bold text-slate-900 tracking-widest uppercase mt-4">{t.agentManager}</div>
              <p className="text-slate-500 text-xs font-medium">{t.manageActiveProtocols}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Analytics Chart */}
        <Card className="w-full bg-white border-0 shadow-sm ring-1 ring-slate-100 flex flex-col min-h-[400px] rounded-2xl">
          <CardHeader className="border-b border-slate-50 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-slate-900 text-lg font-extrabold flex items-center gap-3">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  {t.platformTrafficAnalytics}
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium mt-1">Live dashboard occupancy</CardDescription>
              </div>
              <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-md text-xs font-bold text-indigo-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> {liveOccupancy} Connected
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow pt-6 p-6">
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
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Unique Users Chart */}
        <Card className="w-full bg-white border-0 shadow-sm ring-1 ring-slate-100 flex flex-col min-h-[400px] rounded-2xl">
          <CardHeader className="border-b border-slate-50 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-slate-900 text-lg font-extrabold flex items-center gap-3">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Monthly Unique Users
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium mt-1">Aggregated platform log-ins</CardDescription>
              </div>
              <div className="px-3 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">
                LTM
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow pt-6 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                />
                <Bar dataKey="users" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
