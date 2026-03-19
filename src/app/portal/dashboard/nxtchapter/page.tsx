"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Calendar, Bot, BarChart, MessageSquare, FileText } from "lucide-react";
import Link from "next/link";

const ACTIVITIES = [
  "New participant registered from local shelter",
  "Completed module: Transition Planning",
  "Attended weekly group counseling session",
  "Secured housing placement interview",
  "Achieved 30-day sobriety milestone",
  "Resume building workshop completed",
];

const EVENTS = [
  "Job Fair Prep Workshop - Tomorrow, 2:00 PM",
  "Community Support Circle - Thursday, 6:00 PM",
  "Housing Assistance Q&A - Friday, 10:00 AM",
  "Financial Literacy Seminar - Next Monday",
  "Mock Interviews Session - Next Wednesday",
];

const REPORTS = [
  "Q3 Recidivism Reduction Metrics vs Baseline",
  "Monthly Shelter Outreach Engagement Summary",
  "Weekly Participant Progress Overview",
  "Housing Stability Outcome Analysis - October",
  "Employment Integration Success Rates",
];

export default function NxtChapterDashboard() {
  const [activity, setActivity] = useState("--");
  const [event, setEvent] = useState("--");
  const [report1, setReport1] = useState("--");
  const [report2, setReport2] = useState("--");

  useEffect(() => {
    // Randomize on client-side to avoid hydration mismatch
    setActivity(ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)]);
    setEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
    
    // Pick two random distinct reports
    const shuffledReports = [...REPORTS].sort(() => 0.5 - Math.random());
    setReport1(shuffledReports[0]);
    setReport2(shuffledReports[1]);

    // Optional: Make it change every once in a while (e.g., every 30 seconds)
    const interval = setInterval(() => {
      setActivity(ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)]);
      setEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
      const newShuffled = [...REPORTS].sort(() => 0.5 - Math.random());
      setReport1(newShuffled[0]);
      setReport2(newShuffled[1]);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10] text-slate-200">
      <Header />
      <main className="flex-grow flex items-center justify-center py-8 px-4 md:px-8">
        <div className="w-full max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">NXT Chapter Dashboard</h1>
            <div className="px-4 py-2 bg-slate-800 rounded-md text-sm font-medium text-slate-300">
              Client Portal
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/portal/dashboard/nxtchapter/ai-agents" className="block">
              <div className="bg-slate-900/50 hover:bg-slate-800 transition-colors p-6 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center h-full shadow-sm">
                <Bot className="w-8 h-8 text-blue-400" />
                <span className="font-semibold text-lg text-slate-200">AI Agents</span>
              </div>
            </Link>
            <Link href="/portal/dashboard/nxtchapter/statistics" className="block">
              <div className="bg-slate-900/50 hover:bg-slate-800 transition-colors p-6 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center h-full shadow-sm">
                <BarChart className="w-8 h-8 text-blue-400" />
                <span className="font-semibold text-lg text-slate-200">Statistics and Analysis</span>
              </div>
            </Link>
            <Link href="/portal/dashboard/nxtchapter/communications" className="block">
              <div className="bg-slate-900/50 hover:bg-slate-800 transition-colors p-6 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center h-full shadow-sm">
                <MessageSquare className="w-8 h-8 text-blue-400" />
                <span className="font-semibold text-lg text-slate-200">Communications</span>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Members</CardTitle>
                <Users className="w-4 h-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">326</div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Recent Activity</CardTitle>
                <Activity className="w-4 h-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-white">{activity}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Upcoming Events</CardTitle>
                <Calendar className="w-4 h-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-white">{event}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="min-h-[300px] bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Recent Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                  <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{report1}</p>
                    <p className="text-xs text-slate-500">Generated today</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                  <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{report2}</p>
                    <p className="text-xs text-slate-500">Generated yesterday</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-h-[300px] bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Link href="/portal/dashboard/nxtchapter/manage-users" className="block text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-800">
                  Manage Users
                </Link>
                <Link href="/portal/dashboard/nxtchapter/settings" className="block text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-800">
                  Settings
                </Link>
                <Link href="/portal/dashboard/nxtchapter/support-tickets" className="block text-slate-300 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-800">
                  Support Tickets
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
