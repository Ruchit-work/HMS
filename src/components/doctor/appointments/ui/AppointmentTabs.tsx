"use client"

import React from 'react'
import { TabKey } from "@/types/appointments"

interface AppointmentTabsProps {
  activeTab: TabKey
  tabItems: { key: TabKey; label: string; count: number }[]
  onTabChange: (tab: TabKey) => void
}

export default function AppointmentTabs({
  activeTab,
  tabItems,
  onTabChange,
}: AppointmentTabsProps) {
  return (
    <div className="relative flex flex-wrap items-center gap-2 rounded-xl p-2 bg-slate-50/60 mb-4 shadow-sm border border-slate-200">
      <div className="relative flex flex-wrap items-center gap-2 w-full z-10">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 min-w-[80px] ${
              activeTab === tab.key
                ? "bg-slate-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white bg-white/60"
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

