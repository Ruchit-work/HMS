"use client"

import type { ReactNode } from "react"

/** Compact horizontal key/value strip inside panels */
export function HqStatStrip({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>
}) {
  return (
    <dl className="hq-ds-stat-strip">
      {items.map((item) => (
        <div key={item.label} className="hq-ds-stat-strip-item">
          <dt className="hq-ds-stat-strip-label">{item.label}</dt>
          <dd className="hq-ds-stat-strip-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
