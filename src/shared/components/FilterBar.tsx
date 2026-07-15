"use client"

import type { ReactNode } from "react"

export interface FilterBarProps {
  children: ReactNode
  className?: string
}

/** Horizontal filter / toolbar row used above data tables. */
export function FilterBar({ children, className = "" }: FilterBarProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      {children}
    </div>
  )
}

export default FilterBar
