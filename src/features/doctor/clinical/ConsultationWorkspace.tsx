"use client"

import React, { useState } from "react"
import { ClipboardList, FileText, Stethoscope } from "lucide-react"

type MobileTab = "context" | "clinical" | "orders"

interface ConsultationWorkspaceProps {
  left: React.ReactNode
  center: React.ReactNode
  right?: React.ReactNode
  /** Controlled collapse state for the left panel (2-col only) */
  leftCollapsed?: boolean
  className?: string
}

const MOBILE_TABS_THREE: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  { id: "context", label: "Context", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "clinical", label: "Clinical", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "orders", label: "Orders", icon: <Stethoscope className="w-3.5 h-3.5" /> },
]

const MOBILE_TABS_TWO: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  { id: "context", label: "Summary", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "clinical", label: "Clinical", icon: <FileText className="w-3.5 h-3.5" /> },
]

export default function ConsultationWorkspace({
  left,
  center,
  right,
  leftCollapsed = false,
  className = "",
}: ConsultationWorkspaceProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("clinical")
  const twoColumn = right === undefined || right === null

  const mobileTabs = twoColumn ? MOBILE_TABS_TWO : MOBILE_TABS_THREE

  return (
    <div
      className={`consultation-workspace h-full ${twoColumn ? "consultation-workspace--two-col" : ""} ${twoColumn && leftCollapsed ? "consultation-workspace--left-collapsed" : ""} ${className}`}
    >
      <nav className="consultation-workspace__mobile-tabs" aria-label="Workspace panels">
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={`consultation-workspace__mobile-tab ${
              mobileTab === tab.id ? "consultation-workspace__mobile-tab--active" : ""
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <aside
        className={`consultation-workspace__left ${
          mobileTab === "context" ? "consultation-workspace__panel--mobile-active" : ""
        }`}
      >
        {left}
      </aside>
      <main
        className={`consultation-workspace__center ${
          mobileTab === "clinical" ? "consultation-workspace__panel--mobile-active" : ""
        }`}
      >
        {center}
      </main>
      {!twoColumn && (
        <aside
          className={`consultation-workspace__right ${
            mobileTab === "orders" ? "consultation-workspace__panel--mobile-active" : ""
          }`}
        >
          {right}
        </aside>
      )}
    </div>
  )
}
