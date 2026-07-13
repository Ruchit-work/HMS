"use client"

import { memo } from "react"

interface TableLoadingProps {
  colSpan: number
  rows?: number
  message?: string
  /** "spinner" keeps receptionist parity; "skeleton" for denser loading */
  variant?: "spinner" | "skeleton"
}

function TableLoading({
  colSpan,
  rows = 6,
  message = "Loading…",
  variant = "skeleton",
}: TableLoadingProps) {
  if (variant === "spinner") {
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-8 w-8 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-slate-500">{message}</p>
          </div>
        </td>
      </tr>
    )
  }

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
