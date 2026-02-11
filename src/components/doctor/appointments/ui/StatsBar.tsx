"use client"

import React from "react"

interface Stat {
  label: string
  value: number
}

interface StatsBarProps {
  stats: Stat[]
}

const statColors = [
  "bg-blue-50 border-blue-100 text-blue-800",
  "bg-teal-50 border-teal-100 text-teal-800",
  "bg-slate-50 border-slate-200 text-slate-800",
  "bg-indigo-50 border-indigo-100 text-indigo-800",
]

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`rounded-xl border px-4 py-3 ${statColors[index % statColors.length]}`}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-inherit">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
