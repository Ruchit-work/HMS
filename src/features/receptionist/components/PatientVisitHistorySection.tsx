"use client"

import { useMemo, useState } from "react"
import { ChevronDown, History } from "lucide-react"
import { Button } from "@/shared/components"
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import ClinicalEmptyState from "@/features/doctor/clinical/ClinicalEmptyState"
import PatientVisitDetailModal from "@/features/receptionist/components/PatientVisitDetailModal"
import type {
  PatientVisitHistoryDetails,
  PatientVisitHistoryItem,
} from "@/features/receptionist/utils/visitHistoryDisplay"
import {
  formatBillingAmount,
  formatVisitDateTime,
  getPaymentStatusClasses,
  getPaymentStatusLabel,
  getPrimaryDiagnosis,
  getVisitStatusLabel,
  normalizeVisitStatus,
} from "@/features/receptionist/utils/visitHistoryDisplay"

export type { PatientVisitHistoryDetails, PatientVisitHistoryItem } from "@/features/receptionist/utils/visitHistoryDisplay"

interface PatientVisitHistorySectionProps {
  details?: PatientVisitHistoryDetails | null
  viewFilter: "all" | "upcoming" | null
  onViewFilterChange: (filter: "all" | "upcoming" | null) => void
}

function isUpcomingVisit(visit: PatientVisitHistoryItem): boolean {
  const today = new Date().toISOString().split("T")[0]
  const isFuture = String(visit.appointmentDate || "") >= today
  const isActiveStatus = ["confirmed", "pending", "whatsapp_pending"].includes(
    String(visit.status || "")
  )
  return isFuture && isActiveStatus
}

function VisitDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
        {label}
      </p>
      <p className="text-sm text-slate-800 leading-snug break-words">{value}</p>
    </div>
  )
}

function VisitHistoryCard({
  visit,
  expanded,
  onToggle,
  onViewFull,
  isLast,
}: {
  visit: PatientVisitHistoryItem
  expanded: boolean
  onToggle: () => void
  onViewFull: () => void
  isLast: boolean
}) {
  const visitStatusLabel = getVisitStatusLabel(visit.status)
  const paymentStatusLabel = getPaymentStatusLabel(visit.paymentStatus)
  const department = visit.department || visit.doctorSpecialization || "—"
  const dateTimeLabel = formatVisitDateTime(visit.appointmentDate, visit.appointmentTime)

  return (
    <div className="clinical-timeline__item">
      <div className="clinical-timeline__rail">
        <div className="clinical-timeline__dot" aria-hidden />
        {!isLast && <div className="clinical-timeline__line" aria-hidden />}
      </div>

      <div className="flex-1 min-w-0">
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="w-full text-left px-3 py-3 sm:px-4 hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="clinical-timeline__date">{dateTimeLabel}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                  {visit.doctorName || "Doctor TBD"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{department}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ClinicalStatusBadge
                  status={normalizeVisitStatus(visit.status)}
                  label={visitStatusLabel}
                  size="sm"
                />
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    expanded ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </div>
            </div>

            {!expanded && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                {visit.chiefComplaint ? (
                  <p className="truncate">
                    <span className="font-semibold text-slate-500">Complaint:</span>{" "}
                    {visit.chiefComplaint}
                  </p>
                ) : null}
                <p className="truncate">
                  <span className="font-semibold text-slate-500">Billing:</span>{" "}
                  {formatBillingAmount(visit.billingAmount)}
                  <span className="mx-1 text-slate-300">·</span>
                  {paymentStatusLabel}
                </p>
              </div>
            )}
          </button>

          {expanded && (
            <div className="border-t border-slate-100 px-3 py-3 sm:px-4 bg-slate-50/50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <VisitDetailField label="Date & Time" value={dateTimeLabel} />
                <VisitDetailField label="Doctor" value={visit.doctorName || "Doctor TBD"} />
                <VisitDetailField label="Department" value={department} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Visit Status
                  </p>
                  <ClinicalStatusBadge
                    status={normalizeVisitStatus(visit.status)}
                    label={visitStatusLabel}
                    size="sm"
                  />
                </div>
                <VisitDetailField
                  label="Chief Complaint"
                  value={visit.chiefComplaint?.trim() || "—"}
                />
                <VisitDetailField label="Primary Diagnosis" value={getPrimaryDiagnosis(visit)} />
                <VisitDetailField
                  label="Billing Amount"
                  value={formatBillingAmount(visit.billingAmount)}
                />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Payment Status
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusClasses(
                      paymentStatusLabel
                    )}`}
                  >
                    {paymentStatusLabel}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 px-3 py-2.5 sm:px-4 bg-white">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={(event) => {
                event.stopPropagation()
                onViewFull()
              }}
            >
              View Full Visit
            </Button>
          </div>
        </article>
      </div>
    </div>
  )
}

export default function PatientVisitHistorySection({
  details,
  viewFilter,
  onViewFilterChange,
}: PatientVisitHistorySectionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [selectedVisit, setSelectedVisit] = useState<PatientVisitHistoryItem | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const filteredVisits = useMemo(() => {
    const visits = details?.appointments || []
    if (viewFilter !== "upcoming") return visits
    return visits.filter(isUpcomingVisit)
  }, [details?.appointments, viewFilter])

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openVisitDetail = (visit: PatientVisitHistoryItem) => {
    setSelectedVisit(visit)
    setShowDetailModal(true)
  }

  const closeVisitDetail = () => {
    setShowDetailModal(false)
    setSelectedVisit(null)
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 border border-cyan-100">
              <History className="h-4 w-4 text-cyan-700" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Visit History
              </p>
              <p className="text-[11px] text-slate-400">Clinical visit timeline</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="text-slate-400">{details?.total ?? "—"} total</span>
            <span className="text-emerald-600 font-semibold">{details?.upcoming ?? "—"} upcoming</span>
          </div>
        </div>

        {!details ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            Loading visit history…
          </div>
        ) : (details.appointments?.length ?? 0) === 0 ? (
          <ClinicalEmptyState
            compact
            illustration="consultation"
            title="No visits recorded"
            description="Past and upcoming appointments will appear here once the patient has visit history."
            icon={<History className="w-7 h-7 text-slate-400" />}
          />
        ) : (
          <>
            <div className="flex gap-1.5 mb-3">
              {(["all", "upcoming"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() =>
                    onViewFilterChange(filter === viewFilter ? null : filter)
                  }
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    viewFilter === filter
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {filter === "all" ? "All visits" : "Upcoming only"}
                </button>
              ))}
            </div>

            {filteredVisits.length === 0 ? (
              <ClinicalEmptyState
                compact
                illustration="appointments"
                title="No upcoming visits"
                description='Try switching to "All visits" to see the full timeline.'
              />
            ) : (
              <div className="clinical-timeline max-h-[28rem] overflow-y-auto pr-1 -mr-1">
                {filteredVisits.map((visit, index) => (
                  <VisitHistoryCard
                    key={visit.id}
                    visit={visit}
                    expanded={expandedIds.has(visit.id)}
                    onToggle={() => toggleExpanded(visit.id)}
                    onViewFull={() => openVisitDetail(visit)}
                    isLast={index === filteredVisits.length - 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <PatientVisitDetailModal
        visit={selectedVisit}
        isOpen={showDetailModal}
        onClose={closeVisitDetail}
      />
    </>
  )
}
