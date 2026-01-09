"use client"

import { DocumentMetadata } from "@/types/document"
import { parsePrescription } from "@/utils/appointments/prescriptionParsers"

interface LastAppointmentDetailsProps {
  latestRecommendation: {
    appointmentId?: string
    date: string
    finalDiagnosis?: string[]
    customDiagnosis?: string
    medicine?: string
    notes?: string
    doctorName?: string
  }
  historyDocuments: Record<string, DocumentMetadata[]>
  onDocumentClick: (doc: DocumentMetadata) => void
}

export default function LastAppointmentDetails({
  latestRecommendation,
  historyDocuments,
  onDocumentClick,
}: LastAppointmentDetailsProps) {
  const docs =
    latestRecommendation.appointmentId &&
    historyDocuments[latestRecommendation.appointmentId]
      ? historyDocuments[latestRecommendation.appointmentId]
      : []

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-4 md:p-5 border border-blue-200/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-blue-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
            🩺
          </div>
          <div>
            <h5 className="font-bold text-blue-900 text-sm md:text-base">
              Last appointment details
            </h5>
            <p className="text-[11px] text-blue-700/80">
              Summary of the most recent completed visit
            </p>
          </div>
        </div>
        <span className="text-[11px] md:text-xs text-blue-700 bg-white/80 px-2.5 py-1 rounded-full border border-blue-200 shadow-sm">
          {latestRecommendation.date}
        </span>
      </div>

      {/* Diagnosis from last appointment */}
      {((latestRecommendation.finalDiagnosis && latestRecommendation.finalDiagnosis.length > 0) || latestRecommendation.customDiagnosis) && (
        <div className="mb-3">
          <span className="text-blue-900 text-xs font-semibold block mb-2">
            🧾 Diagnosis
          </span>
          {latestRecommendation.finalDiagnosis && latestRecommendation.finalDiagnosis.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {latestRecommendation.finalDiagnosis.map((diagnosis: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200"
                >
                  {diagnosis}
                </span>
              ))}
            </div>
          )}
          {latestRecommendation.customDiagnosis && (
            <div className="mt-1 bg-white rounded-lg border border-blue-100 px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-blue-800 block mb-0.5">
                Custom:
              </span>
              <p className="text-[11px] text-blue-900 whitespace-pre-line">
                {latestRecommendation.customDiagnosis}
              </p>
            </div>
          )}
        </div>
      )}

      {latestRecommendation.medicine && (() => {
        const parsed = parsePrescription(latestRecommendation.medicine)
        if (parsed && parsed.medicines.length > 0) {
          return (
            <div className="mb-3">
              <span className="text-blue-800 text-xs font-semibold block mb-2">
                💊 Previous Medicines
              </span>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {parsed.medicines.map((med, index) => (
                    <div
                      key={index}
                      className="bg-blue-50/60 border border-blue-100 rounded-lg p-2 flex flex-col gap-1"
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="text-sm">{med.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[12px] text-blue-900 truncate">
                            {med.name}
                            {med.dosage && (
                              <span className="text-[11px] text-blue-700 font-normal ml-1">
                                ({med.dosage})
                              </span>
                            )}
                          </p>
                          {(med.frequency || med.duration) && (
                            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-blue-800/90">
                              {med.frequency && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-blue-400">⏱</span>
                                  <span>{med.frequency}</span>
                                </span>
                              )}
                              {med.duration && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-blue-400">📅</span>
                                  <span>{med.duration}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        } else {
          return (
            <div className="mb-3">
              <span className="text-blue-800 text-xs font-semibold block mb-1">
                💊 Previous Medicines
              </span>
              <p className="text-blue-900 text-sm font-medium bg-white p-2 rounded-lg border border-blue-100 whitespace-pre-line">
                {latestRecommendation.medicine}
              </p>
            </div>
          )
        }
      })()}

      {latestRecommendation.notes && (
        <div className="mb-2">
          <span className="text-blue-800 text-xs font-semibold block mb-1">
            📝 Previous Notes
          </span>
          <p className="text-blue-900 text-[11px] font-normal bg-white p-1 rounded-lg border border-blue-100 whitespace-pre-line leading-snug">
            {latestRecommendation.notes}
          </p>
        </div>
      )}

      {/* Documents from last appointment */}
      <div className="mb-2">
        <span className="text-blue-800 text-xs font-semibold block mb-1">
          📄 Documents ({docs.length})
        </span>
        {docs.length > 0 ? (
          <div className="space-y-1">
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onDocumentClick(doc)}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-white/90 text-blue-800 border border-blue-100 hover:bg-blue-50 transition-colors"
              >
                <span>📄</span>
                <span className="truncate flex-1 text-left">{doc.originalFileName}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-blue-100 px-2.5 py-1.5">
            <p className="text-[11px] text-blue-900">No any document attached.</p>
          </div>
        )}
      </div>

      <div className="mt-2 text-[11px] md:text-xs text-blue-700 font-medium flex items-center gap-1">
        <span className="text-blue-500">👨‍⚕️</span>
        <span>
          Recommended by <span className="font-semibold">{latestRecommendation.doctorName}</span>
        </span>
      </div>
    </div>
  )
}

