"use client"

interface PieChartData {
  name: string
  value: number
  isOther?: boolean
  mergedItems?: string[]
}

interface PieChartProps {
  data: PieChartData[]
  colors?: string[]
  maxSlices?: number
  emptyMessage?: string
  getLabel?: (item: PieChartData) => string
  getCountLabel?: (item: PieChartData, count: number) => string
}

const DEFAULT_COLORS = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#6b7280"]
const DEFAULT_COLORS_ALT = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#6b7280"]

const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians)
  }
}

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
  return ["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "Z"].join(" ")
}

export default function PieChart({ 
  data, 
  colors = DEFAULT_COLORS, 
  maxSlices = 6,
  emptyMessage = "No data available",
  getLabel = (item) => item.name,
  getCountLabel = (item, count) => `${count}`
}: PieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.value - a.value)
  const primary = sorted.slice(0, maxSlices)
  const remaining = sorted.slice(maxSlices)

  const displayData: (PieChartData & { isOther?: boolean; mergedItems?: string[] })[] = [...primary]
  if (remaining.length > 0) {
    const otherCount = remaining.reduce((sum, item) => sum + item.value, 0)
    if (otherCount > 0) {
      displayData.push({
        name: "Other",
        value: otherCount,
        isOther: true,
        mergedItems: remaining.map(item => item.name)
      })
    }
  }

  const totalCount = displayData.reduce((sum, item) => sum + item.value, 0)
  if (totalCount === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  const center = 110
  const radius = 100
  let currentAngle = 0

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-between gap-6 lg:gap-8 h-full">
      <svg className="w-72 h-72 sm:w-80 sm:h-80" viewBox="0 0 220 220">
        <circle cx={center} cy={center} r={radius} fill="#f1f5f9" />
        {displayData.map((item, index) => {
          const sliceAngle = (item.value / totalCount) * 360
          if (sliceAngle === 0) return null
          
          const startAngle = currentAngle
          const endAngle = currentAngle + sliceAngle
          currentAngle = endAngle

          const path = describeArc(center, center, radius, startAngle, endAngle)
          const midAngle = startAngle + sliceAngle / 2
          const labelPosition = polarToCartesian(center, center, radius * 0.6, midAngle)
          const percentage = (item.value / totalCount) * 100

          return (
            <g key={item.name}>
              <path d={path} fill={colors[index % colors.length]} className="transition-transform duration-300 hover:scale-[1.02]" />
              <text
                x={labelPosition.x}
                y={labelPosition.y}
                className="text-[10px] fill-gray-800 font-semibold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {`${Math.round(percentage)}%`}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="w-full lg:w-56 space-y-1">
        {displayData.map((item, index) => {
          const percentage = (item.value / totalCount) * 100
          return (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <p className="text-[11px] leading-tight text-slate-600">
                <span className="font-semibold text-slate-700">
                  {item.isOther
                    ? `Other (${item.mergedItems?.length || 0} items)`
                    : getLabel(item)}
                </span>{" "}
                {getCountLabel(item, item.value)} • {percentage.toFixed(1)}%
                {item.isOther && item.mergedItems && item.mergedItems.length > 0 && (
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {item.mergedItems.join(", ")}
                  </span>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { DEFAULT_COLORS, DEFAULT_COLORS_ALT }

