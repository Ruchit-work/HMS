"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface ClinicalPanelProps {
  title: string
  icon?: React.ReactNode
  badge?: string | number
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export default function ClinicalPanel({
  title,
  icon,
  badge,
  actions,
  children,
  className = "",
  bodyClassName = "",
  noPadding = false,
  collapsible = false,
  defaultCollapsed = false,
}: ClinicalPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <section className={`clinical-panel ${className}`.trim()}>
      <div className="clinical-panel__header">
        <div className="clinical-panel__header-main">
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="clinical-panel__collapse-btn"
              aria-expanded={!collapsed}
            >
              {icon && <span className="clinical-panel__icon">{icon}</span>}
              <h3 className="clinical-panel__title">{title}</h3>
              {badge !== undefined && (
                <span className="clinical-panel__badge">{badge}</span>
              )}
              {collapsed ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>
          ) : (
            <>
              {icon && <span className="clinical-panel__icon">{icon}</span>}
              <h3 className="clinical-panel__title">{title}</h3>
              {badge !== undefined && (
                <span className="clinical-panel__badge">{badge}</span>
              )}
            </>
          )}
        </div>
        {actions && <div className="clinical-panel__actions">{actions}</div>}
      </div>
      {(!collapsible || !collapsed) && (
        <div
          className={`clinical-panel__body ${noPadding ? "clinical-panel__body--flush" : ""} ${bodyClassName}`.trim()}
        >
          {children}
        </div>
      )}
    </section>
  )
}
