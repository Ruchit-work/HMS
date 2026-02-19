"use client"

import { useState } from "react"

interface CollapsibleSectionProps {
  title: string
  defaultOpen: boolean
  children: React.ReactNode
  /** Optional: slightly de-emphasize (e.g. for historical sections) */
  subdued?: boolean
  /** Optional extra content in header (e.g. Download PDF button) */
  headerRight?: React.ReactNode
  className?: string
}

export default function CollapsibleSection({
  title,
  defaultOpen,
  children,
  subdued = false,
  headerRight,
  className = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}>
      <div
        className={`px-4 py-3 flex items-center justify-between gap-2 border-b border-slate-200 ${
          subdued ? "bg-slate-50/80" : "bg-blue-50/80"
        } ${!isOpen ? "border-b-0" : ""}`}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex-1 flex items-center justify-between gap-2 text-left min-w-0"
          aria-expanded={isOpen}
        >
          <span className={`font-semibold text-sm ${subdued ? "text-slate-700" : "text-blue-900"}`}>
            {title}
          </span>
          <svg
            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {headerRight && <span className="shrink-0" onClick={(e) => e.stopPropagation()}>{headerRight}</span>}
      </div>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  )
}
