"use client"

import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: number
  subtitle?: string
  icon: LucideIcon
  accentClass: string
}

export default function StatsCard({ title, value, subtitle, icon: Icon, accentClass }: StatsCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <span className="rounded-lg bg-slate-50 p-2 text-slate-500">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1 min-h-5 text-xs text-slate-500">{subtitle || " "}</p>
      <div className={`mt-3 h-1 w-full rounded-full ${accentClass}`} />
    </article>
  )
}
