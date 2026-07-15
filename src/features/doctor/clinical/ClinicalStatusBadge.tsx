"use client"

import React from "react"

export type ClinicalStatus =
  | "confirmed"
  | "completed"
  | "pending"
  | "cancelled"
  | "no_show"
  | "admitted"
  | "prebooked"
  | "discharged"
  | "active"
  | "inactive"

const STATUS_CONFIG: Record<
  ClinicalStatus,
  { label: string; container: string; dot: string }
> = {
  confirmed: {
    label: "Confirmed",
    container: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  completed: {
    label: "Completed",
    container: "bg-teal-50 text-teal-800 border-teal-200",
    dot: "bg-teal-500",
  },
  pending: {
    label: "Pending",
    container: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  cancelled: {
    label: "Cancelled",
    container: "bg-rose-50 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
  no_show: {
    label: "Skipped",
    container: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  admitted: {
    label: "Admitted",
    container: "bg-cyan-50 text-cyan-900 border-cyan-200",
    dot: "bg-cyan-500",
  },
  prebooked: {
    label: "Pre-booked",
    container: "bg-violet-50 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
  },
  discharged: {
    label: "Discharged",
    container: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  },
  active: {
    label: "Active",
    container: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  inactive: {
    label: "Inactive",
    container: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
}

interface ClinicalStatusBadgeProps {
  status: ClinicalStatus | string
  label?: string
  size?: "sm" | "md"
  showDot?: boolean
  className?: string
}

export default function ClinicalStatusBadge({
  status,
  label,
  size = "sm",
  showDot = true,
  className = "",
}: ClinicalStatusBadgeProps) {
  const config = STATUS_CONFIG[status as ClinicalStatus] ?? {
    label: label || String(status),
    container: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  }

  const sizeClasses = size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses} ${config.container} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} aria-hidden />
      )}
      {label || config.label}
    </span>
  )
}
