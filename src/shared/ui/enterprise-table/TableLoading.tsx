"use client"

import { memo } from "react"

interface TableLoadingProps {
  colSpan: number
  rows?: number
  message?: string
  /** Prefer skeleton rows; spinner opt-in kept for API compatibility */
  variant?: "spinner" | "skeleton"
}

function TableLoading({
  colSpan,
  rows = 6,
}: TableLoadingProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td colSpan={colSpan} className="px-3 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-slate-100" />
                <div className="h-2.5 w-1/4 rounded bg-slate-50" />
              </div>
              <div className="hidden h-6 w-16 rounded-full bg-slate-100 sm:block" />
              <div className="h-7 w-16 rounded-lg bg-slate-100" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

export default memo(TableLoading)
