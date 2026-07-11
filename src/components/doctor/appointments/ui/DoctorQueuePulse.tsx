"use client"

import React from "react"
import type { QueueView, TabKey } from "@/types/appointments"
import {
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  History,
  RotateCcw,
} from "lucide-react"

export interface DoctorQueueStat {
  label: string
  value: number
  tab: TabKey
  queueView: QueueView
  hint?: string
}

interface DoctorQueuePulseProps {
  stats: DoctorQueueStat[]
  activeTab: TabKey
  queueView: QueueView
  onSelect: (tab: TabKey, queueView: QueueView) => void
}

const STAT_ICONS: Record<string, React.ReactNode> = {
  Today: <CalendarClock className="w-4 h-4" />,
  Pending: <ClipboardCheck className="w-4 h-4" />,
  Completed: <CalendarCheck className="w-4 h-4" />,
  "Follow-ups": <RotateCcw className="w-4 h-4" />,
  History: <History className="w-4 h-4" />,
}

export default function DoctorQueuePulse({
  stats,
  activeTab,
  queueView,
  onSelect,
}: DoctorQueuePulseProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
      {stats.map((stat) => {
        const isActive = activeTab === stat.tab && queueView === stat.queueView
        return (
          <button
            key={`${stat.label}-${stat.tab}-${stat.queueView}`}
            type="button"
            onClick={() => onSelect(stat.tab, stat.queueView)}
            className={`doctor-queue-pulse ${isActive ? "doctor-queue-pulse--active" : ""}`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="shrink-0">{STAT_ICONS[stat.label]}</span>
              {stat.label}
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums leading-none text-slate-900">
              {stat.value}
            </p>
            {stat.hint && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-1">{stat.hint}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
