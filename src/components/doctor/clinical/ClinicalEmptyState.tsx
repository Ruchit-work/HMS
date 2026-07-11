"use client"

import React from "react"
import Link from "next/link"
import { Calendar, FileText, Stethoscope, Users } from "lucide-react"
import { Button } from "@/components/ui/Button"

type Illustration = "appointments" | "patients" | "documents" | "consultation" | "default"

const ILLUSTRATIONS: Record<Illustration, React.ReactNode> = {
  appointments: <Calendar className="w-7 h-7 text-slate-400" />,
  patients: <Users className="w-7 h-7 text-slate-400" />,
  documents: <FileText className="w-7 h-7 text-slate-400" />,
  consultation: <Stethoscope className="w-7 h-7 text-slate-400" />,
  default: <Stethoscope className="w-7 h-7 text-slate-400" />,
}

interface ClinicalEmptyStateProps {
  title: string
  description?: string
  illustration?: Illustration
  icon?: React.ReactNode
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  compact?: boolean
  className?: string
}

export default function ClinicalEmptyState({
  title,
  description,
  illustration = "default",
  icon,
  action,
  compact = false,
  className = "",
}: ClinicalEmptyStateProps) {
  const displayIcon = icon ?? ILLUSTRATIONS[illustration]

  return (
    <div
      className={`clinical-empty flex flex-col items-center justify-center text-center px-6 ${
        compact ? "clinical-empty--compact py-8" : "py-16"
      } ${className}`}
    >
      <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4">
        {displayIcon}
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link href={action.href}>
              <Button type="button" variant="primary" size="sm">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button type="button" variant="primary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
