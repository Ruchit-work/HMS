"use client"

import { useState } from "react"

const HEALTHCARE_COLORS = ["#2563EB", "#14B8A6", "#22C55E", "#8B5CF6", "#F59E0B", "#EF4444", "#64748B"]

export interface DonutItem {
  name: string
  value: number
}

interface MedicinesDonutChartProps {
  data: DonutItem[]
  emptyMessage?: string
  maxSlices?: number
}

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Donut segment: outer arc from start to end, then inner arc back from end to start */
function describeDonutSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startDeg)
  const outerEnd = polarToCartesian(cx, cy, outerR, endDeg)
  const innerEnd = polarToCartesian(cx, cy, innerR, endDeg)
  const innerStart = polarToCartesian(cx, cy, innerR, startDeg)
  const large = endDeg - startDeg <= 180 ? "0" : "1"
  return [
    "M", outerStart.x, outerStart.y,
    "A", outerR, outerR, 0, large, 0, outerEnd.x, outerEnd.y,
    "L", innerEnd.x, innerEnd.y,
    "A", innerR, innerR, 0, large, 1, innerStart.x, innerStart.y,
    "Z"
  ].join(" ")
}

export default function MedicinesDonutChart({
  data,
  emptyMessage = "No medicine data available",
  maxSlices = 8
}: MedicinesDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxSlices)
  const total = sorted.reduce((s, d) => s + d.value, 0)

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[16rem] text-slate-500 rounded-lg bg-slate-50/50">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  const cx = 100
  const cy = 100
  const outerR = 88
  const innerR = 52
  let currentAngle = 0

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8 w-full">
      <div className="relative flex-shrink-0">
        <svg className="w-52 h-52 sm:w-56 sm:h-56" viewBox="0 0 200 200">
          <circle cx={cx} cy={cy} r={outerR} fill="#f1f5f9" />
          {sorted.map((item, index) => {
            const sliceAngle = (item.value / total) * 360
            if (sliceAngle <= 0) return null
            const startAngle = currentAngle
            const endAngle = currentAngle + sliceAngle
            currentAngle = endAngle

            const color = HEALTHCARE_COLORS[index % HEALTHCARE_COLORS.length]
            const isHovered = hoveredIndex === index
            const path = describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle)

            return (
              <path
                key={item.name}
                d={path}
                fill={color}
                className="transition-opacity duration-150"
                style={{ opacity: hoveredIndex !== null && !isHovered ? 0.45 : 1 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            )
          })}
          <circle cx={cx} cy={cy} r={innerR} fill="#ffffff" />
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="text-[11px] font-semibold fill-slate-500"
          >
            Total
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            className="text-lg font-bold fill-slate-800"
          >
            {total.toLocaleString()}
          </text>
          <text
            x={cx}
            y={cy + 26}
            textAnchor="middle"
            className="text-[10px] fill-slate-500"
          >
            Prescriptions
          </text>
        </svg>
      </div>

      <div className="w-full lg:min-w-[11rem] space-y-2 flex-1">
        {sorted.map((item, index) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          const color = HEALTHCARE_COLORS[index % HEALTHCARE_COLORS.length]
          const isHovered = hoveredIndex === index

          return (
            <div
              key={item.name}
              className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors ${isHovered ? "bg-slate-100" : ""}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-700 truncate" title={item.name}>
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {item.value} prescriptions · {pct.toFixed(1)}%
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
