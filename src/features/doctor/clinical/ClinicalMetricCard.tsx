"use client"

import React from "react"

interface ClinicalMetricCardProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export default function ClinicalMetricCard({
  label,
  value,
  icon,
  footer,
  className = "",
}: ClinicalMetricCardProps) {
  return (
    <div className={`clinical-metric-card ${className}`.trim()}>
      {icon && <div className="clinical-metric-card__icon">{icon}</div>}
      <p className="clinical-metric-card__label">{label}</p>
      <p className="clinical-metric-card__value">{value}</p>
      {footer && <div className="clinical-metric-card__footer">{footer}</div>}
    </div>
  )
}
