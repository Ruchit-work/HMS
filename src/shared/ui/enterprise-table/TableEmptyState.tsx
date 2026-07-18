"use client"

import { memo, type ReactNode } from "react"

interface TableEmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
  colSpan: number
}

function TableEmptyState({
  title = "No records found",
  description = "There are no records to display.",
  icon,
  action,
  colSpan,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 transition-transform duration-150 hover:-translate-y-0.5">
            {icon ?? (
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-800">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-1 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
            >
              {action.label}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default memo(TableEmptyState)
