"use client"

import React from "react"

interface Stat {
  label: string
  value: number
}

interface StatsBarProps {
  stats: Stat[]
}

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="pb-4">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 -mt-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 flex flex-col justify-between text-slate-100 shadow-sm"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-200/90 flex items-center gap-2">
                {stat.label}
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

