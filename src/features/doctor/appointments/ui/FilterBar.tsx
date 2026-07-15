"use client"

import React from "react"
import { TabKey } from "@/types/appointments"
import type { Branch } from "@/types/branch"
import type { Doctor } from "@/types/patient"

interface PlanningTab {
  key: TabKey
  label: string
  count: number
}

interface FilterBarProps {
  activeTab: TabKey
  planningTabs?: PlanningTab[]
  onPlanningTabChange?: (tab: TabKey) => void
  branches: Branch[]
  selectedBranchId: string | null
  onBranchChange: (branchId: string | null) => void
  loadingBranches: boolean
  doctors?: Doctor[]
  selectedDoctorId?: string | null
  onDoctorChange?: (doctorId: string | null) => void
}

export default function FilterBar({
  activeTab,
  planningTabs = [],
  onPlanningTabChange,
  branches,
  selectedBranchId,
  onBranchChange,
  loadingBranches,
  doctors,
  selectedDoctorId,
  onDoctorChange,
}: FilterBarProps) {
  const showDoctorDropdown = Boolean(doctors && doctors.length > 0 && onDoctorChange)
  const showPlanning = planningTabs.length > 0 && onPlanningTabChange

  if (!showPlanning && branches.length === 0 && !showDoctorDropdown) {
    return null
  }

  return (
    <div className="border-b border-slate-100 bg-white px-4 sm:px-6 py-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        {showPlanning && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="font-medium uppercase tracking-wider shrink-0">Plan ahead</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <div className="flex flex-wrap items-center gap-1">
              {planningTabs.map((tab, index) => (
                <React.Fragment key={tab.key}>
                  {index > 0 && <span className="text-slate-300">·</span>}
                  <button
                    type="button"
                    onClick={() => onPlanningTabChange(tab.key)}
                    className={`font-medium transition-colors ${
                      activeTab === tab.key
                        ? "text-[var(--color-primary-dark)]"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 tabular-nums text-slate-400">({tab.count})</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 justify-end sm:ml-auto">
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50"
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
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
  )
}
