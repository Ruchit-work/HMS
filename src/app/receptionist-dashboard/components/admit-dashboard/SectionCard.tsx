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
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className || ""}`}>
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
      {footer ? <footer className="border-t border-slate-200 px-5 py-3 text-sm">{footer}</footer> : null}
    </section>
  )
}
