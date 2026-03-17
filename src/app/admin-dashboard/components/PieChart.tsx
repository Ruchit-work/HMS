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

/** Professional, hospital-friendly palette: calm blues, teals, and slate */
const DEFAULT_COLORS = [
  "#0ea5e9", /* sky-500 */
  "#0d9488", /* teal-600 */
  "#3b82f6", /* blue-500 */
  "#64748b", /* slate-500 */
  "#0891b2", /* cyan-600 */
  "#475569", /* slate-600 */
  "#0284c7", /* sky-600 */
  "#0f766e", /* teal-700 */
  "#6366f1", /* indigo-500 */
  "#334155", /* slate-700 */
]
const DEFAULT_COLORS_ALT = [
  "#0369a1", /* sky-700 */
  "#047857", /* emerald-700 */
  "#0d9488", /* teal-600 */
  "#1e40af", /* blue-800 */
  "#0e7490", /* cyan-700 */
  "#4f46e5", /* indigo-600 */
  "#0ea5e9", /* sky-500 */
  "#059669", /* emerald-600 */
  "#475569", /* slate-600 */
  "#64748b", /* slate-500 */
]

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
          const showLabelOnSlice = percentage >= 6

          return (
            <g key={item.name}>
              <path d={path} fill={colors[index % colors.length]} className="transition-transform duration-300 hover:scale-[1.02]" />
              {showLabelOnSlice && (
                <text
                  x={labelPosition.x}
                  y={labelPosition.y}
                  className="text-[10px] fill-gray-800 font-semibold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {`${percentage.toFixed(1)}%`}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="w-full lg:min-w-[11rem] lg:max-w-[14rem] space-y-2">
        {displayData.map((item, index) => {
          const percentage = (item.value / totalCount) * 100
          const otherItems = item.isOther && item.mergedItems ? item.mergedItems : []
          const otherPreview = otherItems.length > 3
            ? [...otherItems.slice(0, 3), `+${otherItems.length - 3} more`].join(", ")
            : otherItems.join(", ")
          return (
            <div key={item.name} className="flex items-start gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-snug text-slate-600">
                  <span className="font-semibold text-slate-700">
                    {item.isOther
                      ? `Other (${item.mergedItems?.length || 0} items)`
                      : getLabel(item)}
                  </span>{" "}
                  {getCountLabel(item, item.value)} • {percentage.toFixed(1)}%
                </p>
                {item.isOther && otherPreview && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={otherItems.join(", ")}>
                    {otherPreview}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { DEFAULT_COLORS, DEFAULT_COLORS_ALT }

