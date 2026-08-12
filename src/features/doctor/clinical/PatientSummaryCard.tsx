"use client"

import React from "react"
import { FolderOpen } from "lucide-react"
import ClinicalStatusBadge from "./ClinicalStatusBadge"
import PatientAvatar from "./PatientAvatar"

interface PatientSummaryCardProps {
  patientName: string
  patientId?: string | null
  age?: number | null
  phone?: string | null
  status?: string
  statusLabel?: string
  chiefComplaint?: string | null
  appointmentDate?: string
  appointmentTime?: string
  specialization?: string | null
  isReturningPatient?: boolean
  tags?: React.ReactNode
  actions?: React.ReactNode
  vitals?: Array<{ label: string; value: string }>
  sticky?: boolean
  className?: string
  onOpenDocuments?: () => void
}

export default function PatientSummaryCard({
  patientName,
  patientId,
  age,
  phone,
  status,
  statusLabel,
  chiefComplaint,
  appointmentDate,
  appointmentTime,
  specialization,
  isReturningPatient,
  tags,
  actions,
  vitals,
  sticky = true,
  className = "",
  onOpenDocuments,
}: PatientSummaryCardProps) {
  const dateLabel =
    appointmentDate &&
    new Date(appointmentDate).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  return (
    <div
      className={`patient-summary-card ${sticky ? "patient-summary-card--sticky" : ""} ${className}`}
    >
      <div className="patient-summary-card__inner">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <PatientAvatar name={patientName} />
            <div className="min-w-0">
              <h2 className="patient-summary-card__name">{patientName || "Patient"}</h2>
              <div className="patient-summary-card__meta flex flex-wrap items-center gap-x-2 gap-y-1">
                {patientId && (
                  <span className="font-semibold text-slate-700">
                    ID: <span className="font-bold text-slate-900">{patientId}</span>
                  </span>
                )}
                {onOpenDocuments && (
                  <button
                    type="button"
                    onClick={onOpenDocuments}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition-colors cursor-pointer"
                    title="View patient documents"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    View documents
                  </button>
                )}
                {(patientId || onOpenDocuments) && (phone || age != null) && <span className="text-slate-300">·</span>}
                {phone && <span>{phone}</span>}
                {phone && age != null && <span className="text-slate-300">·</span>}
                {age != null && <span>{age} yrs</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {specialization && (
                  <span className="patient-summary-card__tag">{specialization}</span>
                )}
                {isReturningPatient === true && (
                  <span className="patient-summary-card__tag patient-summary-card__tag--returning">
                    Returning
                  </span>
                )}
                {isReturningPatient === false && (
                  <span className="patient-summary-card__tag patient-summary-card__tag--new">
                    New patient
                  </span>
                )}
                {dateLabel && appointmentTime && (
                  <span className="patient-summary-card__datetime">
                    {dateLabel} · {appointmentTime}
                  </span>
                )}
                {tags}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
            {status && (
              <ClinicalStatusBadge status={status} label={statusLabel} size="md" />
            )}
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>

        {vitals && vitals.length > 0 && (
          <div className="patient-summary-card__vitals">
            {vitals.map((v) => (
              <div key={v.label} className="patient-summary-card__vital">
                <span className="patient-summary-card__vital-label">{v.label}</span>
                <span className="patient-summary-card__vital-value">{v.value}</span>
              </div>
            ))}
          </div>
        )}

        {chiefComplaint && (
          <div className="patient-summary-card__complaint">
            <span className="font-medium text-slate-700">Chief complaint</span>
            <span className="text-slate-600"> — {chiefComplaint}</span>
          </div>
        )}
      </div>
    </div>
  )
}
