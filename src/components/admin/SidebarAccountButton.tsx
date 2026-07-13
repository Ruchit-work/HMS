"use client"

interface SidebarAccountButtonProps {
  active: boolean
  onClick: () => void
  displayName: string
  roleLabel: string
  initial: string
}

/** Sidebar footer — profile row doubles as My Account navigation (rx-sidebar style) */
export default function SidebarAccountButton({
  active,
  onClick,
  displayName,
  roleLabel,
  initial,
}: SidebarAccountButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "w-full flex items-center gap-2.5 px-1.5 py-2 rounded-lg mb-1 transition-colors text-left",
        active ? "bg-slate-100" : "hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="w-7 h-7 rounded-md bg-cyan-600 flex items-center justify-center shrink-0">
        <span className="text-white text-xs font-bold">{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
        <p className="text-xs text-slate-400 truncate">{roleLabel}</p>
      </div>
    </button>
  )
}
