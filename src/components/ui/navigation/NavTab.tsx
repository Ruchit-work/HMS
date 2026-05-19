"use client"

import { ReactNode } from "react"

export interface NavTabProps {
  active?: boolean
  onClick: () => void
  icon?: ReactNode
  label: string
  className?: string
}

/** Sidebar navigation item — shared across admin, reception, doctor portals */
export function NavTab({ active = false, onClick, icon, label, className = "" }: NavTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
        active
          ? "bg-[var(--color-primary)] text-white shadow-md"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? (
        <div className={`p-1.5 rounded-md shrink-0 ${active ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
          {icon}
        </div>
      ) : null}
      <span className="font-medium text-sm truncate">{label}</span>
    </button>
  )
}
