"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

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
      className={cn("rdp", className)}
      classNames={{
        months: "grid grid-cols-1",
        month: "space-y-2",
        table: "w-full border-collapse table-fixed",
        caption: "flex justify-between items-center px-2",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        head_row: "",
        head_cell: "text-center text-xs font-semibold text-gray-500",
        row: "",
        cell: "p-1 text-center align-middle",
        day: "h-10 w-10 text-sm rounded-full flex items-center justify-center hover:bg-gray-200 focus:outline-none",
        day_selected: "bg-blue-600 text-white hover:bg-blue-700",
        day_today: "font-bold text-blue-600",
        day_outside: "text-gray-400",
        day_disabled: "text-gray-300 line-through",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
