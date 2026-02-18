/**
 * DashboardCard Component
 * Reusable card for displaying statistics and metrics
 * Design: Modern, clean with gradient accents
 */

interface DashboardCardProps {
  title: string
  value: string | number
  icon: string
  iconBgColor?: string
  subtitle?: string
  trend?: {
    value: string
    isPositive: boolean
  }
  onClick?: () => void
}

export default function DashboardCard({
  title,
  value,
  icon,
  iconBgColor = "bg-teal-100",
  subtitle,
  trend,
  onClick
}: DashboardCardProps) {
  return (
    <div 
      className={`
        bg-white border border-slate-200 rounded-xl p-4 sm:p-6 
        card-hover transition-all
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBgColor} rounded-xl flex items-center justify-center shadow-sm`}>
          <span className="text-lg sm:text-2xl">{icon}</span>
        </div>
        {trend && (
          <span className={`
            text-xs font-semibold px-2 py-1 rounded-full
            ${trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          `}>
            {trend.value}
          </span>
        )}
      </div>
      
      <div>
        <p className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">{value}</p>
        <p className="text-xs sm:text-sm text-slate-600 font-medium leading-tight">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1 leading-tight">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

