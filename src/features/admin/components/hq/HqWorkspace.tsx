"use client"

import type { ReactNode } from "react"

/** Two-column HQ layout: primary + rail (xl+) */
export function HqWorkspace({
  primary,
  rail,
}: {
  primary: ReactNode
  rail?: ReactNode
}) {
  return (
    <div className={`hq-ds-workspace ${rail ? "hq-ds-workspace--split" : ""}`.trim()}>
      <div className="hq-ds-workspace-primary min-w-0">{primary}</div>
      {rail ? <aside className="hq-ds-workspace-rail min-w-0 flex flex-col gap-3">{rail}</aside> : null}
    </div>
  )
}
