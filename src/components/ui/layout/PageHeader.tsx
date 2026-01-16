/**
 * PageHeader Component
 * Consistent header design for all pages
 * Design: Gradient background with icon and description
 */

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon: string
  gradient?: string
}

export default function PageHeader({ 
  title, 
  subtitle, 
  icon,
  gradient = "from-slate-700 to-slate-800"
}: PageHeaderProps) {
  return (
    <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-white shadow-xl animate-fade-in-up relative overflow-hidden`}>
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-white/5 animate-pulse-slow"></div>
      
      <div className="flex items-center gap-3 sm:gap-4 relative z-10">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg animate-bounce-in">
          {icon}
        </div>
        <div className="animate-slide-in-right flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{title}</h1>
          {subtitle && (
            <p className="text-white/90 text-xs sm:text-sm mt-1 break-words">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

