"use client"

interface NotificationBadgeProps {
  count: number
  maxCount?: number
  size?: 'sm' | 'md' | 'lg'
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange'
  animate?: boolean
  className?: string
}

export default function NotificationBadge({
  count,
  maxCount = 99,
  size = 'md',
  position = 'top-right',
  color = 'red',
  animate = true,
  className = ''
}: NotificationBadgeProps) {
  if (count <= 0) return null

  const sizeClasses = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm'
  }

  const positionClasses = {
    'top-right': '-top-1 -right-1',
    'top-left': '-top-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
    'bottom-left': '-bottom-1 -left-1'
  }

  const colorClasses = {
    red: 'bg-red-500 text-white border-red-600',
    blue: 'bg-blue-500 text-white border-blue-600',
    green: 'bg-green-500 text-white border-green-600',
    yellow: 'bg-yellow-500 text-white border-yellow-600',
    purple: 'bg-purple-500 text-white border-purple-600',
    orange: 'bg-orange-500 text-white border-orange-600'
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()

  return (
    <span
      className={`
        absolute ${positionClasses[position]} ${sizeClasses[size]} ${colorClasses[color]}
        rounded-full flex items-center justify-center font-bold
        border-2 border-white shadow-lg z-10
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {displayCount}
    </span>
  )
}
