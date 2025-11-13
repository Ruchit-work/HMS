/**
 * Refresh Button Component
 * 
 * Reusable refresh button with loading state and spinner animation.
 * 
 * @example
 * <RefreshButton
 *   onClick={fetchData}
 *   loading={loading}
 *   variant="outline"
 *   label="Refresh"
 * />
 */

"use client"

import React from 'react'

type RefreshButtonVariant = 'outline' | 'primary' | 'gray' | 'purple' | 'sky'

interface RefreshButtonProps {
  onClick: () => void
  loading: boolean
  disabled?: boolean
  variant?: RefreshButtonVariant
  label?: string
  loadingLabel?: string
  className?: string
  title?: string
}

export default function RefreshButton({
  onClick,
  loading,
  disabled = false,
  variant = 'outline',
  label = 'Refresh',
  loadingLabel = 'Refreshing…',
  className = '',
  title,
}: RefreshButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60'
  
  const variantClasses = {
    outline: 'border border-slate-200 bg-white/80 text-slate-700 hover:border-blue-200 hover:text-slate-900',
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    gray: 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200',
    purple: 'border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100',
    sky: 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  }

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${className}`.trim()

  return (
    <button
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
      title={title || (loading ? loadingLabel : label)}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      {loading ? loadingLabel : label}
    </button>
  )
}

