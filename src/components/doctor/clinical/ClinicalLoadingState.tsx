"use client"

import React from "react"

interface ClinicalLoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  inline?: boolean
  className?: string
}

export default function ClinicalLoadingState({
  message = "Loading…",
  size = "md",
  inline = false,
  className = "",
}: ClinicalLoadingStateProps) {
  const ringSize = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-10 h-10" : "w-8 h-8"
  const textSize = size === "sm" ? "text-xs" : "text-sm"

  const content = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${ringSize} rounded-full border-2 border-slate-200 border-t-[var(--color-primary)] animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className={`${textSize} text-slate-500 font-medium`}>{message}</p>}
    </div>
  )

  if (inline) {
    return <div className={`flex items-center justify-center py-12 ${className}`}>{content}</div>
  }

  return (
    <div className={`clinical-loading min-h-[40vh] flex items-center justify-center ${className}`}>
      {content}
    </div>
  )
}
