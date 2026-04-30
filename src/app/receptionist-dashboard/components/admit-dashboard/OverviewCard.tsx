"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

interface OverviewMetric {
  label: string
  value: number
  accentClass: string
}

interface OverviewCardProps {
  metrics: OverviewMetric[]
  occupancyPercent: number
  occupiedBeds: number
  totalBeds: number
}

export default function OverviewCard({
  metrics,
  occupancyPercent,
  occupiedBeds,
  totalBeds,
}: OverviewCardProps) {
  const chartData = [
    { name: "Occupied", value: occupiedBeds, color: "#7c3aed" },
    { name: "Available", value: Math.max(totalBeds - occupiedBeds, 0), color: "#e2e8f0" },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-600">{metric.label}</p>
            <p className={`text-sm font-semibold ${metric.accentClass}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-700">Occupancy</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="h-24 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={28} outerRadius={42} dataKey="value" strokeWidth={0}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{occupancyPercent}%</p>
            <p className="text-xs text-slate-500">
              {occupiedBeds} / {totalBeds} beds occupied
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { OverviewMetric }
