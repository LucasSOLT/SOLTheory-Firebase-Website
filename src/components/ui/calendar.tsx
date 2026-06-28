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
      className={cn("p-4 bg-white text-slate-900 rounded-xl shadow-lg border border-slate-100", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center px-2",
        caption_label: "text-sm font-bold tracking-tight text-slate-800",
        nav: "space-x-1 flex items-center",
        nav_button:
          "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all",
        nav_button_previous: "absolute left-2",
        nav_button_next: "absolute right-2",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-slate-400 rounded-md w-10 font-semibold text-[0.7rem] uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: "h-10 w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:bg-pink-50 [&:has([aria-selected])]:bg-pink-50 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
        day: "h-10 w-10 p-0 font-medium inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-all aria-selected:opacity-100 cursor-pointer text-[13px]",
        day_range_end: "day-range-end",
        day_selected:
          "bg-gradient-to-br from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 hover:text-white focus:from-pink-500 focus:to-purple-500 focus:text-white shadow-md shadow-pink-500/20 font-semibold",
        day_today: "bg-slate-100 text-slate-900 font-bold ring-1 ring-slate-300",
        day_outside:
          "day-outside text-slate-300 aria-selected:bg-pink-50 aria-selected:text-slate-400",
        day_disabled: "text-slate-200 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-pink-50 aria-selected:text-pink-700",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4", className)} {...props} />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
