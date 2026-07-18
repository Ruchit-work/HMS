"use client"

import { memo } from "react"
import type { EnterpriseFilterOption } from "./types"

interface TableFiltersProps {
  options: EnterpriseFilterOption[]
  value: string
  onChange: (id: string) => void
  className?: string
}

function TableFilters({ options, value, onChange, className = "" }: TableFiltersProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              active
                ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span className={active ? "text-cyan-600" : "text-slate-400"}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default memo(TableFilters)
