"use client"

import React from "react"
import { TabKey } from "@/types/appointments"
import type { Branch } from "@/types/branch"
import type { Doctor } from "@/types/patient"

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
  /** Optional: show doctor dropdown when provided */
  doctors?: Doctor[]
  selectedDoctorId?: string | null
  onDoctorChange?: (doctorId: string | null) => void
}

export default function FilterBar({
  activeTab,
  tabs,
  onTabChange,
  branches,
  selectedBranchId,
  onBranchChange,
  loadingBranches,
  doctors,
  selectedDoctorId,
  onDoctorChange,
}: FilterBarProps) {
  const showDoctorDropdown = Boolean(doctors && doctors.length > 0 && onDoctorChange)

  return (
    <div className="border-b border-slate-200 bg-slate-50/80">
      <div className="px-4 sm:px-6 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Segmented pill tabs */}
          <div className="inline-flex items-center rounded-full bg-white/80 border border-slate-200 px-1 py-1 shadow-xs overflow-x-auto max-w-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100/80 text-slate-700 hover:bg-slate-200/80"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{tab.label}</span>
                  {tab.count >= 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 text-xs font-semibold rounded-full ${
                        isActive ? "bg-blue-500 text-white" : "bg-white/80 text-slate-700"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Quick filters on the right */}
          <div className="flex items-center gap-3 justify-end">
            {branches.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Branch
                </span>
                <select
                  id="branch-select"
                  value={selectedBranchId || ""}
                  onChange={(e) => onBranchChange(e.target.value || null)}
                  disabled={loadingBranches}
                  className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-900 shadow-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  aria-label="Select branch"
                >
                  {branches.length > 1 && <option value="">All branches</option>}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showDoctorDropdown && doctors && onDoctorChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Doctor
                </span>
                <select
                  id="doctor-select"
                  value={selectedDoctorId || ""}
                  onChange={(e) => onDoctorChange(e.target.value || null)}
                  className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-900 shadow-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  aria-label="Select doctor"
                >
                  <option value="">All doctors</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.firstName} {doctor.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
