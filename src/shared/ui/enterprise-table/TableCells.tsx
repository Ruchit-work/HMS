"use client"

import type { StatusVariant, AvatarColor } from "./types"

const STATUS_CLS: Record<StatusVariant, string> = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
  cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
}

/** Dot + label status chip — shared across Harmony HMS tables */
export function StatusPill({
  label,
  variant,
  className = "",
}: {
  label: string
  variant: StatusVariant
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLS[variant]} ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  )
}

const AVATAR_CLS: Record<AvatarColor, string> = {
  cyan: "bg-cyan-100 text-cyan-700",
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
}

/** Initials avatar + name + optional sub-text */
export function AvatarCell({
  name,
  sub,
  color = "cyan",
  size = "md",
}: {
  name: string
  sub?: string
  color?: AvatarColor
  size?: "sm" | "md"
}) {
  const parts = (name || "?").trim().split(" ")
  const initials =
    parts.length >= 2
      ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
      : (name || "?").charAt(0).toUpperCase()

  const avatarSize = size === "sm" ? "h-7 w-7 rounded-lg text-[10px]" : "h-8 w-8 rounded-lg text-xs"

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={`shrink-0 flex items-center justify-center font-bold ${avatarSize} ${AVATAR_CLS[color]}`}>
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{name || "—"}</p>
        {sub && <p className="truncate text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}
