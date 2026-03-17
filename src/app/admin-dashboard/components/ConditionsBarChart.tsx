"use client"

import { useState } from "react"

export const HEALTHCARE_COLORS = ["#2563EB", "#14B8A6", "#22C55E", "#8B5CF6", "#F59E0B", "#EF4444", "#64748B"]

export interface BarItem {
  name: string
  value: number
}

interface ConditionsBarChartProps {
  data: BarItem[]
  emptyMessage?: string
  maxBars?: number
}

function formatLabel(name: string): string {
  return name.replace(/_/g, " ").trim() || "—"
}

export default function ConditionsBarChart({
  data,
  emptyMessage = "No condition data available",
  maxBars = 8
}: ConditionsBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxBars)
  const total = sorted.reduce((s, d) => s + d.value, 0)
  const maxVal = Math.max(...sorted.map((d) => d.value), 1)

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[16rem] text-slate-500 rounded-lg bg-white/60">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  const barHeight = 32
  const gap = 8

  return (
    <div className="flex flex-col w-full gap-1">
      {sorted.map((item, index) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0
        const barWidthPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0
        const isHovered = hoveredIndex === index
        const color = HEALTHCARE_COLORS[index % HEALTHCARE_COLORS.length]

        return (
          <div
            key={item.name}
            className="group relative flex items-center gap-3 py-1.5"
            style={{ minHeight: barHeight }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="flex-shrink-0 text-sm text-slate-700 truncate max-w-[8rem] sm:max-w-[10rem]"
              title={formatLabel(item.name)}
            >
              {formatLabel(item.name)}
            </div>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex-1 h-6 min-w-[2rem] rounded-md bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-200 ease-out"
                  style={{
                    width: `${barWidthPct}%`,
                    backgroundColor: color,
                    opacity: isHovered ? 1 : 0.92,
                    boxShadow: isHovered ? "0 2px 6px rgba(0,0,0,0.15)" : "none"
                  }}
                />
              </div>
              <span className="text-sm font-medium text-slate-700 tabular-nums w-8 text-right flex-shrink-0">
                {item.value}
              </span>
              <span className="text-xs text-slate-500 tabular-nums w-12 text-right flex-shrink-0">
                {pct.toFixed(1)}%
              </span>
            </div>
            {isHovered && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-10 px-3 py-2 text-xs rounded-lg shadow-lg border border-slate-200 bg-white"
                role="tooltip"
              >
                <div className="font-semibold text-slate-800">{formatLabel(item.name)}</div>
                <div className="text-slate-600">
                  {item.value} patient{item.value !== 1 ? "s" : ""} · {pct.toFixed(1)}% of total
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
