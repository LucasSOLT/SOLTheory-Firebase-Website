"use client";

import { Suspense } from "react";
import { GoogleAdsDashboard } from "@/components/portal/GoogleAdsDashboard";

export default function NxtChapterGoogleAdsPage() {
  return (
    <div className="flex flex-col h-full w-full py-6">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>}>
        <GoogleAdsDashboard />
      </Suspense>
    </div>
  );
}
