"use client"

import type { ReactNode } from "react"

export type GroupedNavItem<T extends string = string> = {
  id: T
  label: string
  badge?: number | string
  icon?: ReactNode
}

export type GroupedNavSection<T extends string = string> = {
  title: string
  items: GroupedNavItem<T>[]
}

interface GroupedNavProps<T extends string = string> {
  sections: GroupedNavSection<T>[]
  activeId: T
  onSelect: (id: T) => void
  variant?: "sidebar" | "pills"
}

export default function GroupedNav<T extends string = string>({
  sections,
  activeId,
  onSelect,
  variant = "sidebar",
}: GroupedNavProps<T>) {
  if (variant === "pills") {
    return (
      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {section.title}
            </span>
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeId === item.id
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
                {item.badge != null ? (
                  <span className="ml-1.5 inline-flex min-w-[18px] justify-center rounded-full bg-white/20 px-1 text-[10px]">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = activeId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {item.icon ? (
                      <span className={`shrink-0 ${isActive ? "text-[var(--color-primary)]" : "text-slate-400"}`}>
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge != null ? (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
