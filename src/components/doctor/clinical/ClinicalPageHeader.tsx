"use client"

import React from "react"

interface ClinicalPageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  stats?: React.ReactNode
  className?: string
}

export default function ClinicalPageHeader({
  title,
  subtitle,
  icon,
  badge,
  actions,
  stats,
  className = "",
}: ClinicalPageHeaderProps) {
  return (
    <header className={`clinical-page-header ${className}`}>
      <div className="clinical-page-header__main">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="clinical-page-header__icon shrink-0" aria-hidden>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="clinical-page-header__title">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="clinical-page-header__subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="clinical-page-header__actions">{actions}</div>}
      </div>
      {stats && <div className="clinical-page-header__stats">{stats}</div>}
    </header>
  )
}
