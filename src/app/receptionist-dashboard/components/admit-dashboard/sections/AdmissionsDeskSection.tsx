"use client"

import { MutableRefObject } from "react"
import SectionCard from "@/app/receptionist-dashboard/components/admit-dashboard/SectionCard"
import RequestTable, { RequestRow } from "@/app/receptionist-dashboard/components/admit-dashboard/RequestTable"
import InpatientTable, { InpatientRow } from "@/app/receptionist-dashboard/components/admit-dashboard/InpatientTable"

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
}: AdmissionsDeskSectionProps) {
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
    </div>
  )
}
