"use client"

import { MutableRefObject, useMemo, useState } from "react"
import SectionCard from "@/app/receptionist-dashboard/components/admit-dashboard/SectionCard"
import RequestTable, { RequestRow } from "@/app/receptionist-dashboard/components/admit-dashboard/RequestTable"
import InpatientTable, { InpatientRow } from "@/app/receptionist-dashboard/components/admit-dashboard/InpatientTable"
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
  plannedActionLoadingId?: string | null
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
  plannedActionLoadingId,
}: AdmissionsDeskSectionProps) {
  const [plannedFilter, setPlannedFilter] = useState<"all" | "within24h" | "doctorMissing" | "readyNow">("all")
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
      <section>
        <SectionCard
          title="Pending Admission Requests"
          subtitle="Review and process doctor-submitted admission requests"
          actions={
            <>
              <button
                onClick={handleOpenDirectAdmitModal}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Direct Admit
              </button>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                Auto Refresh
              </button>
            </>
          }
          footer={<button className="font-semibold text-violet-700 hover:text-violet-800">View All Requests</button>}
        >
          {admitRequestsError ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{admitRequestsError}</div>
          ) : null}
          <RequestTable rows={requestRows} loading={admitRequestsLoading} onAssign={handleAssignFromTable} />
        </SectionCard>
      </section>

      <section ref={admittedPatientsSectionRef}>
        <SectionCard
          title="Currently Admitted Patients"
          subtitle="Track active inpatients and their status"
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportFilteredInpatients}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                Export CSV
              </button>
              <button
                onClick={setAdmissionsDeskFocusAll}
                className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100"
              >
                View All Inpatients
              </button>
            </div>
          }
        >
          {admissionsError ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{admissionsError}</div>
          ) : null}
          {admissionsDeskFocus !== "all" ? (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <span>Active filter: {admissionsDeskFocusLabel}</span>
              <button onClick={setAdmissionsDeskFocusAll} className="font-semibold text-violet-700 hover:text-violet-900">
                Clear
              </button>
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
          <div className="mb-3 flex flex-wrap gap-2">
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
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  plannedFilter === filter.key
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              No planned admissions are currently scheduled.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Patient</th>
                    <th className="px-3 py-2">IPD No</th>
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2">Planned Date/Time</th>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {filteredPlannedAdmissions.map((admission) => {
                    const plannedIso = String(admission.plannedAdmitAt || admission.checkInAt || "")
                    const plannedDate = new Date(plannedIso)
                    const isScheduled = String(admission.status || "") === "scheduled"
                    const in24h =
                      Number.isFinite(plannedDate.getTime()) &&
                      plannedDate.getTime() >= Date.now() &&
                      plannedDate.getTime() <= Date.now() + 24 * 60 * 60 * 1000
                    const canReadyToAdmit = in24h && isScheduled
                    return (
                      <tr key={admission.id}>
                        <td className="px-3 py-2 font-medium">{admission.patientName || "Unknown patient"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{formatIpdDisplayNo(admission.ipdNo, admission.id)}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-slate-700">{admission.doctorName || "To be assigned"}</span>
                        </td>
                        <td className="px-3 py-2">
                          {Number.isFinite(plannedDate.getTime()) ? plannedDate.toLocaleString() : "Invalid date"}
                        </td>
                        <td className="px-3 py-2">{admission.roomNumber || "-"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              in24h ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"
                            }`}
                          >
                            {in24h ? "Due in 24h" : "Scheduled"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <select
                              defaultValue=""
                              disabled={plannedActionLoadingId === admission.id}
                              onChange={(e) => {
                                const action = e.target.value as "" | "ready_to_admit" | "postpone" | "delete"
                                if (!action) return
                                onPlannedAction(admission.id, action)
                                e.currentTarget.value = ""
                              }}
                              className="w-44 min-w-[11rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                            >
                              <option value="">Select action</option>
                              <option value="ready_to_admit" disabled={!canReadyToAdmit}>
                                {canReadyToAdmit ? "Ready to Admit" : "Ready to Admit (24h only)"}
                              </option>
                              <option value="postpone">Postpone Date</option>
                              <option value="delete">Delete Admission</option>
                            </select>
                          </div>
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
