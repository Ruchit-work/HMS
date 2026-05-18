"use client"

import { ReactNode } from "react"

interface SectionCardProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  footer,
  className,
}: SectionCardProps) {
  return (
    <section className={`hms-surface rounded-2xl ${className || ""}`}>
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="hms-heading text-base">{title}</h3>
          {subtitle ? <p className="text-sm hms-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
      {footer ? <footer className="border-t border-slate-200 px-5 py-3 text-sm">{footer}</footer> : null}
    </section>
  )
}
