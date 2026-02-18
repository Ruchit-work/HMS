"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface ClinicalSummaryCardProps {
  appointment: AppointmentType
  latestRecommendation: {
    finalDiagnosis: string[]
    medicine?: string | null
    notes?: string | null
    date?: string
  } | null
  onClick?: () => void
}

export default function ClinicalSummaryCard({
  appointment,
  latestRecommendation,
  onClick,
}: ClinicalSummaryCardProps) {
  const primaryDiagnosis =
    latestRecommendation && latestRecommendation.finalDiagnosis.length > 0
      ? latestRecommendation.finalDiagnosis[0]
      : null

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-white p-4 transition-colors ${
        latestRecommendation && onClick ? "cursor-pointer hover:bg-slate-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Last visit details</h3>
        {latestRecommendation ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {latestRecommendation.date || "Previous visit"}
            </span>
            {onClick && (
              <span className="text-xs text-blue-600 font-medium">View</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No previous visit</span>
        )}
      </div>

      {latestRecommendation ? (
        <>
          <div className="flex flex-col gap-2 text-xs">
            {appointment.chiefComplaint && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  Chief complaint
                </p>
                <p className="mt-0.5 text-slate-900 line-clamp-2">
                  {appointment.chiefComplaint}
                </p>
              </div>
            )}
            {primaryDiagnosis && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Diagnosis
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {primaryDiagnosis}
                </span>
                {latestRecommendation.finalDiagnosis.length > 1 && (
                  <span className="text-xs text-slate-500">
                    +{latestRecommendation.finalDiagnosis.length - 1} more
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
