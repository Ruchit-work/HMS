"use client"

import { MutableRefObject, useMemo, useRef, useState } from "react"
import { Button } from '@/shared/components'
import SectionCard from "@/features/receptionist/components/admit-dashboard/SectionCard"
import RequestTable, { RequestRow } from "@/features/receptionist/components/admit-dashboard/RequestTable"
import InpatientTable, { InpatientRow } from "@/features/receptionist/components/admit-dashboard/InpatientTable"
import { StatusPill, AvatarCell } from '@/shared/components'
import type { Admission } from "@/types/patient"

const formatIpdDisplayNo = (ipdNo: string | undefined, admissionId: string) => {
  if (typeof ipdNo === "string" && ipdNo.trim()) return ipdNo.trim()
  const raw = String(admissionId || "").trim()
  if (!raw) return "-"
  return `IPD-${raw.slice(-6).toUpperCase()}`
}

interface AdmissionsDeskSectionProps {
  handleOpenDirectAdmitModal: () => void
  admitRequestsError: string | null
  requestRows: RequestRow[]
  admitRequestsLoading: boolean
  handleAssignFromTable: (requestId: string) => void
  admittedPatientsSectionRef: MutableRefObject<HTMLElement | null>
  handleExportFilteredInpatients: () => void
  setAdmissionsDeskFocusAll: () => void
  admissionsError: string | null
  admissionsDeskFocus: "all" | "doctor_requested_discharge" | "expected_discharge_soon" | "rounds_pending" | "pay_later"
  admissionsDeskFocusLabel: string | null
  filteredInpatientRows: InpatientRow[]
  admissionsLoading: boolean
  handleViewInpatient: (admissionId: string) => void
  handleMoreInpatient: (admissionId: string) => void
  plannedAdmissions: Admission[]
  plannedAdmissionsWithin24h: Admission[]
  onPlannedAction: (admissionId: string, action: "ready_to_admit" | "postpone" | "delete") => void
  onRefreshData?: () => void | Promise<void>
  plannedActionLoadingId?: string | null
  assignDisabled?: boolean
}

export default function AdmissionsDeskSection({
  handleOpenDirectAdmitModal,
  admitRequestsError,
  requestRows,
  admitRequestsLoading,
  handleAssignFromTable,
  admittedPatientsSectionRef,
  handleExportFilteredInpatients,
  setAdmissionsDeskFocusAll,
  admissionsError,
  admissionsDeskFocus,
  admissionsDeskFocusLabel,
  filteredInpatientRows,
  admissionsLoading,
  handleViewInpatient,
  handleMoreInpatient,
  plannedAdmissions,
  plannedAdmissionsWithin24h,
  onPlannedAction,
  onRefreshData,
  plannedActionLoadingId,
  assignDisabled = false,
}: AdmissionsDeskSectionProps) {
  const pendingRequestsRef = useRef<HTMLElement | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [plannedFilter, setPlannedFilter] = useState<"all" | "within24h" | "doctorMissing" | "readyNow">("all")

  const handleRefresh = async () => {
    if (refreshing || !onRefreshData) return
    setRefreshing(true)
    try {
      await Promise.resolve(onRefreshData())
    } finally {
      setRefreshing(false)
    }
  }
  const filteredPlannedAdmissions = useMemo(() => {
    const now = Date.now()
    return plannedAdmissions.filter((admission) => {
      const plannedAt = new Date(String(admission.plannedAdmitAt || admission.checkInAt || "")).getTime()
      const in24h = Number.isFinite(plannedAt) && plannedAt >= now && plannedAt <= now + 24 * 60 * 60 * 1000
      const doctorMissing = !String(admission.doctorId || "").trim() || String(admission.doctorId || "") === "unassigned"
      const readyNow = String(admission.status || "") === "scheduled" && in24h && !doctorMissing
      if (plannedFilter === "within24h") return in24h
      if (plannedFilter === "doctorMissing") return doctorMissing
      if (plannedFilter === "readyNow") return readyNow
      return true
    })
  }, [plannedAdmissions, plannedFilter])

  return (
    <div className="space-y-6">
      <section ref={pendingRequestsRef}>
        <SectionCard
          title="Pending Admission Requests"
          subtitle="Review and process doctor-submitted admission requests"
          actions={
            <>
              <Button size="sm" onClick={handleOpenDirectAdmitModal}>
                Direct Admit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                loading={refreshing}
                loadingText="Refreshing..."
                disabled={!onRefreshData}
              >
                Refresh
              </Button>
            </>
          }
          footer={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="font-semibold text-[var(--color-primary-dark)]"
              onClick={() => pendingRequestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              View pending requests
            </Button>
          }
        >
          {admitRequestsError ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{admitRequestsError}</div>
          ) : null}
          <RequestTable
            rows={requestRows}
            loading={admitRequestsLoading}
            onAssign={handleAssignFromTable}
            assignDisabled={assignDisabled || refreshing}
          />
        </SectionCard>
      </section>

      <section ref={admittedPatientsSectionRef}>
        <SectionCard
          title="Currently Admitted Patients"
          subtitle="Track active inpatients and their status"
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportFilteredInpatients}>
                Export CSV
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={setAdmissionsDeskFocusAll}>
                View All Inpatients
              </Button>
            </div>
          }
        >
          {admissionsError ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{admissionsError}</div>
          ) : null}
          {admissionsDeskFocus !== "all" ? (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-2 text-xs text-[var(--color-primary-dark)]">
              <span>Active filter: {admissionsDeskFocusLabel}</span>
              <Button type="button" variant="ghost" size="sm" onClick={setAdmissionsDeskFocusAll}>
                Clear
              </Button>
            </div>
          ) : null}
          <InpatientTable
            rows={filteredInpatientRows}
            loading={admissionsLoading}
            onView={handleViewInpatient}
            onMore={handleMoreInpatient}
            focusTag={admissionsDeskFocusLabel}
          />
        </SectionCard>
      </section>

      <section>
        <SectionCard
          title="Pre-Booked Admissions"
          subtitle="Patients scheduled for planned admission"
          footer={<span className="text-xs text-slate-500">Total planned: {filteredPlannedAdmissions.length}</span>}
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              { key: "all" as const, label: "All" },
              { key: "within24h" as const, label: "Within 24h" },
              { key: "doctorMissing" as const, label: "Doctor missing" },
              { key: "readyNow" as const, label: "Ready now" },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setPlannedFilter(filter.key)}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  plannedFilter === filter.key
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {plannedAdmissionsWithin24h.length > 0 ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Reminder: {plannedAdmissionsWithin24h.length} patient(s) are scheduled within the next 24 hours.
            </div>
          ) : null}
          {filteredPlannedAdmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No planned admissions scheduled</p>
              <p className="mt-1 text-xs text-slate-400">Pre-booked admissions will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Patient</th>
                    <th className="px-4 py-3.5">IPD No</th>
                    <th className="px-4 py-3.5">Doctor</th>
                    <th className="px-4 py-3.5">Planned Date / Time</th>
                    <th className="px-4 py-3.5">Room</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPlannedAdmissions.map((admission) => {
                    const plannedIso = String(admission.plannedAdmitAt || admission.checkInAt || "")
                    const plannedDate = new Date(plannedIso)
                    const isScheduled = String(admission.status || "") === "scheduled"
                    const in24h =
                      Number.isFinite(plannedDate.getTime()) &&
                      plannedDate.getTime() >= Date.now() &&
                      plannedDate.getTime() <= Date.now() + 24 * 60 * 60 * 1000
                    const canReadyToAdmit = in24h && isScheduled
                    const isLoading = plannedActionLoadingId === admission.id
                    return (
                      <tr
                        key={admission.id}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3.5">
                          <AvatarCell
                            name={admission.patientName || "Unknown"}
                            color="cyan"
                            size="sm"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs text-slate-500">
                            {formatIpdDisplayNo(admission.ipdNo, admission.id)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-700">
                            {admission.doctorName || (
                              <span className="text-amber-600">To be assigned</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-900">
                            {Number.isFinite(plannedDate.getTime())
                              ? plannedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : "Invalid date"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {Number.isFinite(plannedDate.getTime())
                              ? plannedDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-slate-700">{admission.roomNumber || "—"}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusPill
                            label={in24h ? "Due in 24h" : "Scheduled"}
                            variant={in24h ? "warning" : "cyan"}
                          />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <select
                            defaultValue=""
                            disabled={isLoading}
                            onChange={(e) => {
                              const action = e.target.value as "" | "ready_to_admit" | "postpone" | "delete"
                              if (!action) return
                              onPlannedAction(admission.id, action)
                              e.currentTarget.value = ""
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:opacity-50"
                          >
                            <option value="">Select action…</option>
                            <option value="ready_to_admit" disabled={!canReadyToAdmit}>
                              {canReadyToAdmit ? "Ready to Admit" : "Ready to Admit (24h only)"}
                            </option>
                            <option value="postpone">Postpone Date</option>
                            <option value="delete">Delete Admission</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  )
}
