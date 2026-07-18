"use client"

import type { ReactNode } from "react"
import { Button } from "@/shared/ui/Button"

export interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
  className?: string
}

/**
 * Block-level empty state (non-table). Uses the same visual language as table empties
 * without forcing HQ / Clinical / PhOps theme classes.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`mx-auto flex max-w-sm flex-col items-center gap-2.5 px-3 py-12 text-center ${className}`}>
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
        {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" variant="outline" className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default EmptyState
