"use client";

import { Suspense } from "react";
import { CalendarView } from "@/components/calendar-view";

export default function NxtChapterCalendarPage() {
  return (
    <div className="flex flex-col h-full w-full py-6">
      <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>}>
        <CalendarView />
      </Suspense>
    </div>
  );
}
