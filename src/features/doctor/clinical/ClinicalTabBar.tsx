"use client"

import React from "react"

export interface ClinicalTabItem<T extends string = string> {
  id: T
  label: string
  count?: number
}

interface ClinicalTabBarProps<T extends string = string> {
  tabs: ClinicalTabItem<T>[]
  activeId: T
  onChange: (id: T) => void
  className?: string
  size?: "sm" | "md"
}

export default function ClinicalTabBar<T extends string = string>({
  tabs,
  activeId,
  onChange,
  className = "",
  size = "md",
}: ClinicalTabBarProps<T>) {
  return (
    <div
      className={`clinical-tab-bar ${size === "sm" ? "clinical-tab-bar--sm" : ""} ${className}`.trim()}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`clinical-tab-bar__tab ${isActive ? "clinical-tab-bar__tab--active" : ""}`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count >= 0 && (
              <span className="clinical-tab-bar__count">{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
