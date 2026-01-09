import { ReactNode } from "react"
import NotificationBadge from "@/components/ui/NotificationBadge"

interface TabButtonProps {
  id: string
  activeTab: string
  onClick: () => void
  icon: ReactNode
  label: string
  badgeCount?: number
  badgeProps?: {
    size?: "sm" | "md" | "lg"
    color?: "red" | "blue" | "green" | "yellow" | "purple" | "orange"
    animate?: boolean
  }
}

export default function TabButton({
  id,
  activeTab,
  onClick,
  icon,
  label,
  badgeCount,
  badgeProps = {}
}: TabButtonProps) {
  const isActive = activeTab === id
  
  return (
    <div className="relative">
      <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
          isActive
            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <div className={`p-1.5 rounded-md ${isActive ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
          {icon}
        </div>
        <span className="font-medium text-sm">{label}</span>
      </button>
      {badgeCount !== undefined && (
        <NotificationBadge 
          count={badgeCount}
          position="top-right"
          {...badgeProps}
        />
      )}
    </div>
  )
}

