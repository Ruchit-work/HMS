"use client"

import type { ReactNode } from "react"

/** Root wrapper for every Super Admin / Platform HQ page */
export function HqShell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`hq-ds hq-ds-fade-in ${className}`.trim()}>{children}</div>
}
