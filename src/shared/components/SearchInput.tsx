"use client"

import type { InputHTMLAttributes } from "react"

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** When false, omits the leading search icon and uses pl-3 instead of pl-9. Default true. */
  showIcon?: boolean
  containerClassName?: string
}

/**
 * Standard search field used across admin/pharmacy filter bars.
 * Default classes match the emerald-focus slate input used in management tables.
 */
export function SearchInput({
  showIcon = true,
  containerClassName = "",
  className = "",
  ...rest
}: SearchInputProps) {
  const inputClass =
    className ||
    `w-full rounded-lg border border-slate-300 bg-white ${showIcon ? "pl-9" : "pl-3"} pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500`

  return (
    <div className={`relative ${containerClassName}`}>
      {showIcon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
      ) : null}
      <input type="text" className={inputClass} {...rest} />
    </div>
  )
}

export default SearchInput
