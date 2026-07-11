"use client"

import React from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"

type AlertVariant = "info" | "success" | "warning" | "error"

const VARIANT_STYLES: Record<
  AlertVariant,
  { container: string; icon: React.ReactNode; title: string }
> = {
  info: {
    container: "border-sky-200 bg-sky-50/80 text-sky-900",
    icon: <Info className="w-4 h-4 text-sky-600 shrink-0" />,
    title: "text-sky-900",
  },
  success: {
    container: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
    title: "text-emerald-900",
  },
  warning: {
    container: "border-amber-200 bg-amber-50/80 text-amber-900",
    icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
    title: "text-amber-900",
  },
  error: {
    container: "border-rose-200 bg-rose-50/80 text-rose-900",
    icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
    title: "text-rose-900",
  },
}

interface ClinicalAlertCardProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function ClinicalAlertCard({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: ClinicalAlertCardProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <div
      className={`clinical-alert rounded-xl border px-4 py-3 flex items-start gap-3 ${styles.container} ${className}`}
      role="alert"
    >
      {styles.icon}
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`text-sm font-semibold mb-0.5 ${styles.title}`}>{title}</p>
        )}
        <div className="text-sm leading-relaxed opacity-90">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
