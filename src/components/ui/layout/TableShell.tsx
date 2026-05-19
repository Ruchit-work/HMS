import { ReactNode } from "react"

interface TableShellProps {
  children: ReactNode
  className?: string
  /** Show fade hint on right edge when table scrolls (mobile) */
  scrollHint?: boolean
}

/**
 * Responsive table wrapper: horizontal scroll on small screens, sticky header support inside table.
 */
export function TableShell({ children, className = "", scrollHint = true }: TableShellProps) {
  return (
    <div
      className={[
        "hms-surface overflow-hidden",
        scrollHint ? "hms-table-scroll" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="hms-table-scroll-inner overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  )
}
