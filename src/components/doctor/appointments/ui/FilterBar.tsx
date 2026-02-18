"use client"

import React from "react"
import { TabKey } from "@/types/appointments"
import type { Branch } from "@/types/branch"

interface TabItem {
  key: TabKey
  label: string
  count: number
}

interface FilterBarProps {
  activeTab: TabKey
  tabs: TabItem[]
  onTabChange: (tab: TabKey) => void
  branches: Branch[]
  selectedBranchId: string | null
  onBranchChange: (branchId: string | null) => void
  loadingBranches: boolean
}

export default function FilterBar({
  activeTab,
  tabs,
  onTabChange,
  branches,
  selectedBranchId,
  onBranchChange,
  loadingBranches,
}: FilterBarProps) {
  return (
    <div className="border-b border-slate-200 bg-blue-50/60">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/90 border border-slate-200/80"
                }`}
                aria-current={activeTab === tab.key ? "page" : undefined}
              >
                <span className="mr-2">{tab.label}</span>
                {tab.count >= 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full ${
                      activeTab === tab.key ? "bg-white/25 text-white" : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {branches.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <label htmlFor="branch-select" className="text-sm font-medium text-slate-600">
                Branch
              </label>
              <select
                id="branch-select"
                value={selectedBranchId || ""}
                onChange={(e) => onBranchChange(e.target.value || null)}
                disabled={loadingBranches}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                aria-label="Select branch"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
