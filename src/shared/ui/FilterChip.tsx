"use client"

import { ButtonHTMLAttributes } from "react"

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  count?: number
}

/** Pill filter for status tabs, tags, and segmented controls */
export function FilterChip({
  active = false,
  count,
  children,
  className = "",
  type = "button",
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-[var(--color-primary)] bg-cyan-50 text-[var(--color-primary-dark)] shadow-sm"
          : "border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <span>{children}</span>
      {count !== undefined ? (
        <span
          className={[
            "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
            active ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}
