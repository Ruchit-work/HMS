"use client"

import type { ReactNode } from "react"

/** Dense filter / search / CTA bar under the page header */
export function HqToolbar({
  leading,
  trailing,
  children,
}: {
  /** Search + filters */
  leading?: ReactNode
  /** Primary actions */
  trailing?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="hq-ds-toolbar">
      <div className="hq-ds-toolbar-leading min-w-0 flex-1">
        {leading}
        {children}
      </div>
      {trailing ? <div className="hq-ds-toolbar-trailing">{trailing}</div> : null}
    </div>
  )
}
