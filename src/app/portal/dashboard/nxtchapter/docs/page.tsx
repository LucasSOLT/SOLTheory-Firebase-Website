"use client";

import { Suspense } from "react";
import { DriveMockupView } from "@/components/drive-mockup-view";

export default function NxtChapterDocsPage() {
  return (
    <div className="flex flex-col h-full w-full py-6">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}>
        <DriveMockupView type="docs" />
      </Suspense>
    </div>
  );
}
