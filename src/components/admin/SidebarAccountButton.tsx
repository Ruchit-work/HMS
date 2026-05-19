"use client"

interface SidebarAccountButtonProps {
  active: boolean
  onClick: () => void
  displayName: string
  roleLabel: string
  initial: string
}

/** Sidebar footer — profile row doubles as My Account navigation */
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
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 mb-1.5 group",
        active
          ? "bg-[var(--color-primary)] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      ].join(" ")}
    >
      <div
        className={[
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-bold text-[10px]",
          active ? "bg-white/20 text-white" : "bg-gradient-to-br from-cyan-600 to-teal-600 text-white",
        ].join(" ")}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0 text-left leading-tight">
        <p className={`text-xs font-semibold truncate ${active ? "text-white" : "text-slate-900"}`}>
          {displayName}
        </p>
        <p className={`text-[10px] truncate ${active ? "text-white/70" : "text-slate-500"}`}>{roleLabel}</p>
      </div>
      <svg
        className={`w-3 h-3 shrink-0 ${active ? "text-white/70" : "text-slate-400 group-hover:text-slate-600"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
