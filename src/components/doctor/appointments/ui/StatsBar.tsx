"use client"

import React from "react"
import { Calendar, CalendarClock, CalendarRange, History } from "lucide-react"
import type { TabKey } from "@/types/appointments"

interface Stat {
  label: string
  value: number
}

interface StatsBarProps {
  stats: Stat[]
  /** When provided, cards are clickable and switch to this tab */
  activeTab?: TabKey
  onTabChange?: (tab: TabKey) => void
}

const LABEL_TO_TAB: Record<string, TabKey> = {
  Today: "today",
  Tomorrow: "tomorrow",
  "This Week": "thisWeek",
  History: "history",
}

const STAT_CONFIG: Record<
  string,
  { color: string; accent: string; icon: React.ReactNode; hoverBg: string }
> = {
  Today: {
    color: "text-blue-700",
    accent: "bg-blue-500",
    icon: <Calendar className="w-4 h-4 text-blue-600" />,
    hoverBg: "hover:bg-blue-50/80",
  },
  Tomorrow: {
    color: "text-emerald-700",
    accent: "bg-emerald-500",
    icon: <CalendarClock className="w-4 h-4 text-emerald-600" />,
    hoverBg: "hover:bg-emerald-50/80",
  },
  "This Week": {
    color: "text-violet-700",
    accent: "bg-violet-500",
    icon: <CalendarRange className="w-4 h-4 text-violet-600" />,
    hoverBg: "hover:bg-violet-50/80",
  },
  History: {
    color: "text-slate-600",
    accent: "bg-slate-400",
    icon: <History className="w-4 h-4 text-slate-500" />,
    hoverBg: "hover:bg-slate-50",
  },
}

export default function StatsBar({ stats, activeTab, onTabChange }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const config = STAT_CONFIG[stat.label] ?? STAT_CONFIG.History
        const tabKey = LABEL_TO_TAB[stat.label]
        const isActive = activeTab !== undefined && tabKey === activeTab
        const isClickable = Boolean(onTabChange && tabKey)

        return (
          <button
            key={index}
            type="button"
            onClick={() => {
              if (isClickable && tabKey && onTabChange) {
                onTabChange(tabKey)
              }
            }}
            disabled={!isClickable}
            className={`
              group relative w-full rounded-xl border bg-white p-5 text-left overflow-hidden
              shadow-sm transition-all duration-200
              ${isClickable ? "cursor-pointer" : "cursor-default"}
              ${isClickable ? config.hoverBg : ""}
              ${isClickable ? "hover:shadow-md hover:-translate-y-0.5" : ""}
              ${isActive ? "ring-2 ring-sky-400/50 ring-offset-2" : ""}
              border-slate-200/90
            `}
            style={{
              boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
            }}
          >
            {/* Colored left indicator */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${config.accent}`}
              aria-hidden
            />
            <div className="pl-3">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0" aria-hidden>
                  {config.icon}
                </span>
                <p className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                  {stat.label}
                </p>
              </div>
              <p className="mt-2 text-[32px] font-bold tabular-nums text-slate-900 leading-none">
                {stat.value}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
