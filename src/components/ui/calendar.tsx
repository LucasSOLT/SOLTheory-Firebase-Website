"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white text-slate-900", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold text-slate-800",
        nav: "space-x-1 flex items-center",
        nav_button:
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-slate-500 rounded-md w-9 font-medium text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-indigo-50 [&:has([aria-selected])]:bg-indigo-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: "h-9 w-9 p-0 font-normal inline-flex items-center justify-center rounded-md text-slate-800 hover:bg-slate-100 transition-colors aria-selected:opacity-100 cursor-pointer",
        day_range_end: "day-range-end",
        day_selected:
          "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-600 focus:text-white",
        day_today: "bg-slate-100 text-slate-900 font-bold",
        day_outside:
          "day-outside text-slate-400 aria-selected:bg-indigo-50 aria-selected:text-slate-500",
        day_disabled: "text-slate-300",
        day_range_middle:
          "aria-selected:bg-indigo-50 aria-selected:text-indigo-700",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }: any) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }: any) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      } as any}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
