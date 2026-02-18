"use client"

import React, { useState } from "react"
import { Appointment as AppointmentType } from "@/types/patient"
import { DocumentMetadata } from "@/types/document"
import { parsePrescription as parsePrescriptionUtil } from "@/utils/appointments/prescriptionParsers"

interface PatientHistorySectionProps {
  appointment: AppointmentType
  patientHistory: AppointmentType[]
  historyDocuments: Record<string, DocumentMetadata[]>
  historyFilters: { text: string; date: string }
  showHistory: boolean
  onToggleHistory: () => void
  // The following are accepted for backward compatibility but not used in this simplified design
  showAllDoctorsHistory?: boolean
  expandedDoctors?: Record<string, boolean>
  onToggleAllDoctorsHistory?: () => void
  onToggleDoctorAccordion?: (key: string) => void
  onDocumentClick: (doc: DocumentMetadata) => void
}

export default function PatientHistorySection({
  appointment,
  patientHistory,
  historyDocuments,
  historyFilters,
  showHistory,
  onToggleHistory,
  onDocumentClick,
}: PatientHistorySectionProps) {
  const [activeTab, setActiveTab] = useState<"current" | "all">("current")

  const normalizedQuery = historyFilters.text.trim().toLowerCase()
  const historyForPatient = patientHistory.filter((historyItem) => historyItem.patientId === appointment.patientId)

  if (!historyForPatient.length) return null

  const filteredHistory = historyForPatient.filter((historyItem) => {
    const matchesText = normalizedQuery
      ? [
          historyItem.patientName,
          historyItem.patientId,
          historyItem.id,
          historyItem.chiefComplaint,
          historyItem.associatedSymptoms,
          historyItem.medicalHistory,
          historyItem.doctorNotes,
        ].some((field) => (field || "").toLowerCase().includes(normalizedQuery))
      : true

    const matchesDate = historyFilters.date
      ? new Date(historyItem.appointmentDate).toISOString().split("T")[0] === historyFilters.date
      : true

    return matchesText && matchesDate
  })

  const currentDoctorId = appointment.doctorId
  const currentDoctorHistory = filteredHistory.filter((item) => item.doctorId === currentDoctorId)
  const otherDoctorsHistory = filteredHistory.filter((item) => item.doctorId !== currentDoctorId)

  const otherDoctorsGrouped: Record<
    string,
    { doctorName: string; doctorSpecialization: string; appointments: AppointmentType[] }
  > = {}

  otherDoctorsHistory.forEach((item) => {
    const doctorKey = `${item.doctorId}_${item.doctorName || "Unknown"}_${item.doctorSpecialization || ""}`
    if (!otherDoctorsGrouped[doctorKey]) {
      otherDoctorsGrouped[doctorKey] = {
        doctorName: item.doctorName || "Unknown Doctor",
        doctorSpecialization: item.doctorSpecialization || "General",
        appointments: [],
      }
    }
    otherDoctorsGrouped[doctorKey].appointments.push(item)
  })

  const renderHistoryItem = (historyItem: AppointmentType, visitNumber: string | number) => {
    const visitIndex = historyForPatient.findIndex((item) => item.id === historyItem.id)
    const visitNumberFinal = visitIndex >= 0 ? historyForPatient.length - visitIndex : visitNumber
    const anyItem: any = historyItem
    const diagnoses: string[] = Array.isArray(anyItem.finalDiagnosis) ? anyItem.finalDiagnosis : []
    const primaryDiagnosis = diagnoses[0]

    return (
      <div key={historyItem.id} className="relative h-56 sm:h-64">
        <div className="group h-full w-full [perspective:1000px] bg">
          <div className="relative h-full w-full rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-lg transition-transform duration-300 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] ">
            {/* Front side - minimal info */}
            <div className="absolute inset-0 flex flex-col p-3 sm:p-4 [backface-visibility:hidden]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                      Visit #{visitNumberFinal}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(historyItem.appointmentDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {historyItem.doctorName && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Dr. {historyItem.doctorName}
                      {historyItem.doctorSpecialization && (
                        <span className="ml-1">• {historyItem.doctorSpecialization}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-2 text-xs">
                {historyItem.chiefComplaint && (
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                      Chief complaint
                    </p>
                    <p className="mt-0.5 text-slate-900 line-clamp-2">
                      {historyItem.chiefComplaint}
                    </p>
                  </div>
                )}

                {primaryDiagnosis && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Diagnosis
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                      {primaryDiagnosis}
                    </span>
                    {diagnoses.length > 1 && (
                      <span className="text-[11px] text-slate-500">
                        +{diagnoses.length - 1} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Back side - detailed info */}
            <div className="absolute inset-0 flex flex-col p-3 sm:p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-slate-700">Visit details</p>
                <span className="text-[10px] text-slate-400">Hover to flip</span>
              </div>

              <div className="flex-1 space-y-2 text-[11px] overflow-y-auto pr-1">
                {historyItem.medicine &&
                  (() => {
                    const parsed = parsePrescriptionUtil(historyItem.medicine)
                    if (parsed && parsed.medicines.length > 0) {
                      return (
                        <div>
                          <p className="font-medium uppercase tracking-wide text-slate-500">
                            Prescription
                          </p>
                          <div className="mt-1 space-y-1">
                            {parsed.medicines.map((med, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 text-xs text-slate-800"
                              >
                                <span className="text-base">{med.emoji}</span>
                                <span className="truncate">
                                  {med.name}
                                  {med.dosage && (
                                    <span className="ml-1 text-slate-500 text-[11px]">
                                      ({med.dosage})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div>
                        <p className="font-medium uppercase tracking-wide text-slate-500">
                          Prescription
                        </p>
                        <p className="mt-1 text-xs text-slate-800 whitespace-pre-line">
                          {historyItem.medicine}
                        </p>
                      </div>
                    )
                  })()}

                {historyItem.doctorNotes && (
                  <div>
                    <p className="font-medium uppercase tracking-wide text-slate-500">Notes</p>
                    <p className="mt-1 text-xs text-slate-800 whitespace-pre-line">
                      {historyItem.doctorNotes}
                    </p>
                  </div>
                )}

                {historyDocuments[historyItem.id] && historyDocuments[historyItem.id].length > 0 && (
                  <div>
                    <p className="font-medium uppercase tracking-wide text-slate-500">
                      Documents ({historyDocuments[historyItem.id].length})
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {historyDocuments[historyItem.id].slice(0, 2).map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => onDocumentClick(doc)}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100 border border-slate-200"
                        >
                          <span>📄</span>
                          <span className="max-w-[120px] truncate">{doc.originalFileName}</span>
                        </button>
                      ))}
                      {historyDocuments[historyItem.id].length > 2 && (
                        <span className="text-[11px] text-slate-500">
                          +{historyDocuments[historyItem.id].length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header with simple Hide / Show toggle */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Previous Checkup History</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {filteredHistory.length} of {historyForPatient.length} visits
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleHistory}
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            {showHistory ? "Hide" : "Show"}
          </button>
        </div>

        {showHistory && (
          <div className="p-4">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">No visits match the current search filters.</div>
            ) : (
              <div className="space-y-4">
                {currentDoctorHistory.length > 0 && Object.keys(otherDoctorsGrouped).length > 0 && (
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <button
                      onClick={() => setActiveTab("current")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        activeTab === "current"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      My Visits ({currentDoctorHistory.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("all")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        activeTab === "all"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      Other Doctors ({otherDoctorsHistory.length})
                    </button>
                  </div>
                )}

                {activeTab === "current" && currentDoctorHistory.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                    {currentDoctorHistory.map((historyItem) => {
                      const visitIndex = historyForPatient.findIndex((item) => item.id === historyItem.id)
                      const visitNumber = visitIndex >= 0 ? historyForPatient.length - visitIndex : "-"
                      return renderHistoryItem(historyItem, visitNumber)
                    })}
                  </div>
                )}

                {activeTab === "all" && (
                  <div className="space-y-6">
                    {Object.entries(otherDoctorsGrouped).map(([doctorKey, doctorData]) => (
                      <div key={doctorKey}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900">{doctorData.doctorName}</h5>
                            <p className="text-xs text-gray-500">{doctorData.doctorSpecialization}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 ml-2 md:ml-4">
                          {doctorData.appointments.map((historyItem) => {
                            const visitIndex = historyForPatient.findIndex((item) => item.id === historyItem.id)
                            const visitNumber = visitIndex >= 0 ? historyForPatient.length - visitIndex : "-"
                            return renderHistoryItem(historyItem, visitNumber)
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
