import { ReactNode } from "react"
import NotificationBadge from "@/components/ui/feedback/NotificationBadge"
import { NavTab } from "@/components/ui/navigation/NavTab"

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
  badgeProps = {},
}: TabButtonProps) {
  return (
    <div className="relative">
      <NavTab active={activeTab === id} onClick={onClick} icon={icon} label={label} />
      {badgeCount !== undefined ? (
        <NotificationBadge count={badgeCount} position="top-right" {...badgeProps} />
      ) : null}
    </div>
  )
}
