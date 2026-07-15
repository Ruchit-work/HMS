"use client"

import React from "react"
import { TabSkeleton } from '@/shared/components'
interface ClinicalLoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  inline?: boolean
  className?: string
  /** Prefer skeleton layout for page-level waits; spinner only for tiny inline cues */
  variant?: "skeleton" | "spinner"
}

/**
 * Page-level waits use soft skeletons (no blocking spinner).
 * Inline + spinner variant keeps a compact cue for long-running actions.
 */
export default function ClinicalLoadingState({
  message = "Loading…",
  size = "md",
  inline = false,
  className = "",
  variant = "skeleton",
}: ClinicalLoadingStateProps) {
  if (!inline && variant !== "spinner") {
    return (
      <div className={`clinical-loading ${className}`} role="status" aria-label={message}>
        <TabSkeleton variant="generic" />
      </div>
    )
  }

  if (inline && variant !== "spinner") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 py-10 ${className}`}
        role="status"
        aria-label={message}
      >
        <div className="h-2 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="h-2 w-28 animate-pulse rounded-full bg-slate-100" />
        {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      </div>
    )
  }

  const ringSize = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-8 h-8" : "w-6 h-6"
  const textSize = size === "sm" ? "text-xs" : "text-sm"

  const content = (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${ringSize} rounded-full border-2 border-slate-200 border-t-[var(--color-primary)] animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className={`${textSize} text-slate-500 font-medium`}>{message}</p>}
    </div>
  )

  if (inline) {
    return <div className={`flex items-center justify-center py-8 ${className}`}>{content}</div>
  }

  return (
    <div className={`clinical-loading min-h-[40vh] flex items-center justify-center ${className}`}>
      {content}
    </div>
  )
}
