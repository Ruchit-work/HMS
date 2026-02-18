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
    <div className={`flex items-center justify-between p-3 ${bgColor} rounded-lg border ${borderColor}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-600">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

