"use client"

import React from 'react'
import { TabKey } from '@/types/appointments'
import type { Branch } from '@/types/branch'

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
    <div className="border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  activeTab === tab.key
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                aria-current={activeTab === tab.key ? 'page' : undefined}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Branch Selector */}
          {branches.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="branch-select" className="text-sm text-gray-600">
                Branch:
              </label>
              <select
                id="branch-select"
                value={selectedBranchId || ''}
                onChange={(e) => onBranchChange(e.target.value || null)}
                disabled={loadingBranches}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Select branch"
              >
                <option value="">All Branches</option>
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

