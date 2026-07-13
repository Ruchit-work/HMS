"use client"

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  bgColor: string
  borderColor: string
  iconBgColor: string
}

export default function StatCard({ label, value, icon, bgColor, borderColor, iconBgColor }: StatCardProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 ${bgColor} rounded-lg border ${borderColor}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 ${iconBgColor} rounded-md flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500 leading-tight">{label}</p>
          <p className="text-base font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  )
}

