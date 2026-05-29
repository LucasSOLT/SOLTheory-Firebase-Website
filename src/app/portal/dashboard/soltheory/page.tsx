"use client";

import { useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Clock } from "lucide-react";
import { WeeklyTimesheetChart } from "@/components/portal/WeeklyTimesheetChart";
import { NearestDueTasksWidget } from "@/components/portal/NearestDueTasksWidget";

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

        {/* Uniform Grid Layout with Solid White Structural Tiles & Hover Bookmarks */}
        <div className="space-y-5">
          
          {/* Row 1: Top (Left 2:3 stacked, Right 16:9 split) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 1: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards */}
            <div className="flex-[3] aspect-[2/3] flex flex-col gap-5">
              {/* Card 1A: Weekly Timesheet Hours (Real QuickBooks data!) */}
              <div className="relative group flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col hover:shadow-md transition-shadow min-h-0">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 1
                </div>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Hours Worked</span>
                  <Clock className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <WeeklyTimesheetChart />
                </div>
              </div>

              {/* Card 1B: Nearest Due Tasks Priority Widget (Real Action Board data!) */}
              <div className="relative group flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col hover:shadow-md transition-shadow min-h-0">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 2
                </div>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nearest Due Tasks</span>
                  <Clock className="w-4 h-4 text-rose-500" />
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <NearestDueTasksWidget />
                </div>
              </div>
            </div>

            {/* Slot 2: Aspect 16:9 (Wide, Large) -> Custom Grid of 3 Infographics (Blank Solid White Cards) */}
            <div className="flex-[8] aspect-[16/9] grid grid-cols-2 grid-rows-[auto_1fr] gap-5">
              {/* Card 2A: Conversion Rate (Left KPI - Blank White Card) */}
              <div className="relative group bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 3
                </div>
              </div>

              {/* Card 2B: Active Users (Right KPI - Blank White Card) */}
              <div className="relative group bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-955 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 4
                </div>
              </div>

              {/* Card 2C: Weekly Revenue Analytics (Bottom span-2 - Blank White Card) */}
              <div className="relative group col-span-2 bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[100px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 5
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Middle (Left 16:9 Bar Chart, Right 16:9 Donut + Sparkline) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 3: Left (Aspect 16:9) -> Single Full-Height (Blank White Card) */}
            <div className="relative group flex-1 aspect-[16/9] bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                Tile 6
              </div>
            </div>

            {/* Slot 4: Right (Aspect 16:9) -> Split vertically 2/3 and 1/3 (Blank White Cards) */}
            <div className="flex-1 aspect-[16/9] flex flex-col gap-5">
              {/* Card 4A (2/3 Height): User Demographics (Blank White Card) */}
              <div className="relative group flex-[2] bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-0">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 7
                </div>
              </div>

              {/* Card 4B (1/3 Height): Real-time Latency (Blank White Card) */}
              <div className="relative group flex-[1] bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-0">
                <div className="absolute top-0 left-0 bg-slate-955 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 8
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Bottom (Left 16:9 KPI/Line Grid, Right 2:3 Stacked Milestones/Uptime) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 5: Aspect 16:9 (Wide, Large) -> Custom Grid of 3 Infographics (Blank White Cards) */}
            <div className="flex-[8] aspect-[16/9] grid grid-cols-2 grid-rows-[auto_1fr] gap-5">
              {/* Card 5A: Retention Rate (Left KPI - Blank White Card) */}
              <div className="relative group bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 9
                </div>
              </div>

              {/* Card 5B: Satisfaction CSAT (Right KPI - Blank White Card) */}
              <div className="relative group bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-955 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 10
                </div>
              </div>

              {/* Card 5C: Uptime Line Chart (Bottom span-2 - Blank White Card) */}
              <div className="relative group col-span-2 bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[100px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 11
                </div>
              </div>
            </div>

            {/* Slot 6: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards (Blank White Cards) */}
            <div className="flex-[3] aspect-[2/3] flex flex-col gap-5">
              {/* Card 6A: Upcoming Milestones (Blank White Card) */}
              <div className="relative group flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 bg-slate-955 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 12
                </div>
              </div>

              {/* Card 6B: System Status / Health (Blank White Card) */}
              <div className="relative group flex-1 bg-white border border-slate-200/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 13
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
