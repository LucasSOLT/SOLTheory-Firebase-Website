"use client";

import { useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";

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
      <div className="space-y-6 min-w-0 max-w-7xl mx-auto">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
        </div>

        {/* Redesigned Wireframe Layout (6 Rectangles) */}
        <div className="space-y-5">
          
          {/* Row 1: Top (Left 2:3, Right 16:9) */}
          <div className="flex gap-5 w-full">
            <div className="flex-[3] aspect-[2/3] border border-dashed border-slate-200/60 bg-white/30 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 font-semibold text-xs tracking-wider uppercase transition-all hover:bg-white/50 hover:border-slate-300">
              <span>Slot 1</span>
              <span className="text-[10px] text-slate-300 font-normal mt-1">2:3 Aspect</span>
            </div>
            <div className="flex-[8] aspect-[16/9] border border-dashed border-slate-200/60 bg-white/30 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 font-semibold text-xs tracking-wider uppercase transition-all hover:bg-white/50 hover:border-slate-300">
              <span>Slot 2</span>
              <span className="text-[10px] text-slate-300 font-normal mt-1">16:9 Aspect</span>
            </div>
          </div>

          {/* Row 2: Middle (Left 16:9, Right 16:9) */}
          <div className="flex gap-5 w-full">
            <div className="flex-[1] aspect-[16/9] border border-dashed border-slate-200/60 bg-white/30 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 font-semibold text-xs tracking-wider uppercase transition-all hover:bg-white/50 hover:border-slate-300">
              <span>Slot 3</span>
              <span className="text-[10px] text-slate-300 font-normal mt-1">16:9 Aspect</span>
            </div>
            <div className="flex-[1] aspect-[16/9] border border-dashed border-slate-200/60 bg-white/30 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 font-semibold text-xs tracking-wider uppercase transition-all hover:bg-white/50 hover:border-slate-300">
              <span>Slot 4</span>
              <span className="text-[10px] text-slate-300 font-normal mt-1">16:9 Aspect</span>
            </div>
          </div>

          {/* Row 3: Bottom (Left 16:9, Right 2:3) */}
          <div className="flex gap-5 w-full">
            <div className="flex-[8] aspect-[16/9] border border-dashed border-slate-200/60 bg-white/30 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 font-semibold text-xs tracking-wider uppercase transition-all hover:bg-white/50 hover:border-slate-300">
              <span>Slot 5</span>
              <span className="text-[10px] text-slate-300 font-normal mt-1">16:9 Aspect</span>
            </div>
            <div className="flex-[3] aspect-[2/3] border border-dashed border-slate-200/60 bg-white/30 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 font-semibold text-xs tracking-wider uppercase transition-all hover:bg-white/50 hover:border-slate-300">
              <span>Slot 6</span>
              <span className="text-[10px] text-slate-300 font-normal mt-1">2:3 Aspect</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
