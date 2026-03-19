"use client";

import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Activity, Users, Home, TrendingUp, TrendingDown, Clock, MoveRight } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function StatisticsPage() {
  const recentPlacements = [
    { id: "P-1049", name: "J. Doe", type: "Transitional Housing", date: "Oct 24, 2026", status: "Successful" },
    { id: "P-1048", name: "M. Smith", type: "Permanent Supportive", date: "Oct 22, 2026", status: "Successful" },
    { id: "P-1047", name: "R. Johnson", type: "Emergency Shelter", date: "Oct 21, 2026", status: "Pending Review" },
    { id: "P-1046", name: "A. Williams", type: "Transitional Housing", date: "Oct 19, 2026", status: "Successful" },
    { id: "P-1045", name: "T. Brown", type: "Rapid Re-housing", date: "Oct 18, 2026", status: "Successful" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10] text-slate-200">
      <Header />
      <main className="flex-grow py-8 pt-24 px-4 md:px-8">
        <div className="w-full max-w-6xl mx-auto space-y-6 pb-12">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard/nxtchapter" className="p-2 hover:bg-slate-800 rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-3xl font-bold text-white">Statistics and Analysis</h1>
          </div>

          {/* Top KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Participants</CardTitle>
                <Users className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">842</div>
                <p className="text-xs text-emerald-500 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> +12% from last month
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Housing Placements</CardTitle>
                <Home className="w-4 h-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">156</div>
                <p className="text-xs text-emerald-500 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> +5% from last month
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Recidivism Rate</CardTitle>
                <Activity className="w-4 h-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">8.4%</div>
                <p className="text-xs text-emerald-500 flex items-center mt-1">
                  <TrendingDown className="w-3 h-3 mr-1" /> -2.1% from last year
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Avg Job Retention</CardTitle>
                <Clock className="w-4 h-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">14 mo</div>
                <p className="text-xs text-slate-500 flex items-center mt-1">
                  Unchanged from last quarter
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Middle Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-900/50 border-slate-800 min-h-[400px]">
              <CardHeader>
                <CardTitle className="text-lg text-white">Monthly Intake vs Graduation</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-end justify-between gap-2 pt-4">
                {/* Simulated Bar Chart */}
                {[
                  { m: "Jan", i: 60, g: 30 },
                  { m: "Feb", i: 40, g: 35 },
                  { m: "Mar", i: 70, g: 45 },
                  { m: "Apr", i: 55, g: 50 },
                  { m: "May", i: 45, g: 60 },
                  { m: "Jun", i: 65, g: 55 },
                ].map((data, idx) => (
                  <div key={idx} className="flex flex-col items-center justify-end h-full gap-2 w-full">
                    <div className="flex items-end gap-1 w-full h-[80%]">
                      <div className="bg-blue-500/80 w-1/2 rounded-t-sm transition-all hover:bg-blue-400" style={{ height: `${data.i}%` }} title={`Intake: ${data.i}`}></div>
                      <div className="bg-emerald-500/80 w-1/2 rounded-t-sm transition-all hover:bg-emerald-400" style={{ height: `${data.g}%` }} title={`Graduation: ${data.g}`}></div>
                    </div>
                    <span className="text-xs text-slate-400">{data.m}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 min-h-[400px]">
              <CardHeader>
                <CardTitle className="text-lg text-white">Demographics Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center pt-8">
                {/* Simulated Pie Chart / Donut Chart using CSS */}
                <div className="relative w-56 h-56 rounded-full border-[24px] border-slate-800 shadow-inner"
                     style={{
                       background: 'conic-gradient(from 0deg, #3b82f6 0% 40%, #10b981 40% 70%, #8b5cf6 70% 90%, #f59e0b 90% 100%)'
                     }}>
                  <div className="absolute inset-0 m-auto w-36 h-36 bg-[#0a0c10] rounded-full flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <div className="text-center mt-2">
                      <span className="block text-3xl font-bold text-white">842</span>
                      <span className="block text-xs text-slate-400 uppercase tracking-wider mt-1">Total Active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Section (Scrollable expansion) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900/50 border-slate-800 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg text-white">Recent Placements</CardTitle>
                <button className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View All <MoveRight className="w-4 h-4" />
                </button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800/50">
                      <TableRow className="border-slate-800 hover:bg-slate-800/50">
                        <TableHead className="text-slate-400">Participant ID</TableHead>
                        <TableHead className="text-slate-400">Placement Type</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-right text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPlacements.map((placement, idx) => (
                        <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/30">
                          <TableCell className="font-medium text-slate-300">{placement.id}</TableCell>
                          <TableCell className="text-slate-400">{placement.type}</TableCell>
                          <TableCell className="text-slate-400">{placement.date}</TableCell>
                          <TableCell className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              placement.status === 'Successful' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {placement.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Monthly Engagement Focus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Simulated Line Chart using staggered bars/dots to symbolize trend */}
                  <div className="h-48 flex items-end justify-between px-2 pt-4 border-b border-l border-slate-800 relative">
                    <svg className="absolute inset-0 h-full w-full opacity-30" preserveAspectRatio="none">
                      <polyline points="0,150 50,110 100,120 150,80 200,90 250,40 300,50" fill="none" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke"></polyline>
                      <polyline points="0,180 50,140 100,160 150,120 200,130 250,90 300,100" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5,5" vectorEffect="non-scaling-stroke"></polyline>
                    </svg>
                    {[1, 2, 3, 4, 5, 6, 7].map((_, i) => (
                       <div key={i} className="flex flex-col items-center z-10">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] mb-2"></div>
                       </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 px-2 mt-2">
                    <span>M1</span>
                    <span>M2</span>
                    <span>M3</span>
                    <span>M4</span>
                    <span>M5</span>
                    <span>M6</span>
                    <span>Current</span>
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
                      <span>Job Skills Workshops</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <div className="w-3 h-3 rounded-full border-2 border-emerald-500 shrink-0 border-dashed"></div>
                      <span>Financial Counseling</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
