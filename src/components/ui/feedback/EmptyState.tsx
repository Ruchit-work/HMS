"use client"

import Link from "next/link"

interface EmptyStateProps {
  icon?: string | React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
  illustration?: "appointments" | "patients" | "doctors" | "documents" | "billing" | "default"
}

/**
 * Enhanced empty state component with better design, contextual suggestions, and actionable CTAs
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
  illustration = "default"
}: EmptyStateProps) {
  // Default icons based on illustration type
  const defaultIcons: Record<string, string> = {
    appointments: "📅",
    patients: "👥",
    doctors: "👨‍⚕️",
    documents: "📄",
    billing: "💰",
    default: "📭"
  }

  const displayIcon = icon || defaultIcons[illustration]

  // SVG illustrations for better visual appeal
  const getIllustration = () => {
    if (typeof displayIcon !== 'string') return displayIcon
    
    const iconSize = "w-20 h-20"
    const iconColor = "text-slate-400"
    
    switch (illustration) {
      case "appointments":
        return (
          <svg className={`${iconSize} ${iconColor} mx-auto`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case "patients":
        return (
          <svg className={`${iconSize} ${iconColor} mx-auto`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )
      case "doctors":
        return (
          <svg className={`${iconSize} ${iconColor} mx-auto`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case "documents":
        return (
          <svg className={`${iconSize} ${iconColor} mx-auto`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case "billing":
        return (
          <svg className={`${iconSize} ${iconColor} mx-auto`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return <div className="text-6xl mb-4">{displayIcon}</div>
    }
  }

  const ActionButton = ({ action, isPrimary = true }: { action: NonNullable<EmptyStateProps['action']>, isPrimary?: boolean }) => {
    const baseClasses = isPrimary
      ? "px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-sm hover:shadow-md"
      : "px-6 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-all font-medium"

    if (action.href) {
      return (
        <Link href={action.href} className={baseClasses}>
          {action.label}
        </Link>
      )
    }

    return (
      <button onClick={action.onClick} className={baseClasses}>
        {action.label}
      </button>
    )
  }

  return (
    <div className={`text-center py-16 px-4 ${className}`}>
      <div className="mb-6 flex justify-center">
        {getIllustration()}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
      {description && (
        <p className="text-sm text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">{description}</p>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {action && <ActionButton action={action} isPrimary={true} />}
        {secondaryAction && <ActionButton action={secondaryAction} isPrimary={false} />}
      </div>
    </div>
  )
}

