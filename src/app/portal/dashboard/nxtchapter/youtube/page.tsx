"use client";

import { Suspense } from "react";
import { YouTubeDashboard } from "@/components/portal/YouTubeDashboard";

export default function NxtChapterYouTubePage() {
  return (
    <div className="flex flex-col h-full w-full py-6">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full" /></div>}>
        <YouTubeDashboard />
      </Suspense>
    </div>
  );
}
