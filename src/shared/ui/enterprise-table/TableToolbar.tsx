"use client"

import { memo, type ReactNode } from "react"
import type { EnterpriseToolbarAction } from "./types"

interface TableToolbarProps {
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  filters?: ReactNode
  actions?: EnterpriseToolbarAction[]
  trailing?: ReactNode
  children?: ReactNode
}

function actionClass(variant: EnterpriseToolbarAction["variant"] = "secondary") {
  if (variant === "primary") {
    return "border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700"
  }
  if (variant === "ghost") {
    return "border-transparent bg-transparent text-slate-600 hover:bg-slate-100"
  }
  return "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
}

function TableToolbar({ search, filters, actions = [], trailing, children }: TableToolbarProps) {
  if (children) {
    return <div className="border-b border-slate-100 px-4 py-3 sm:px-5">{children}</div>
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {search && (
          <div className="relative w-full sm:max-w-xs">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || "Search…"}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        )}
        {filters}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${actionClass(action.variant)}`}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
        {trailing}
      </div>
    </div>
  )
}

export default memo(TableToolbar)
