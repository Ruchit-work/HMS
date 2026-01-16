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
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/30 shadow-sm p-4 transition-all duration-300 hover:shadow-xl hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50/50 hover:-translate-y-1 hover:scale-[1.02] animate-fade-in card-hover ${
        latestRecommendation && onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Last visit details</h3>
        {latestRecommendation ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
              {latestRecommendation.date || "Previous visit"}
            </span>
            {onClick && (
              <span className="text-[10px] text-blue-600 font-medium">Click to view</span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">No previous visit</span>
        )}
      </div>

      {latestRecommendation ? (
        <>
          {/* Compact summary row (always visible) */}
          <div className="flex flex-col gap-2 text-xs">
            {appointment.chiefComplaint && (
              <div className="rounded-lg bg-white/70 border border-slate-100 px-2.5 py-1.5">
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
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                  {primaryDiagnosis}
                </span>
                {latestRecommendation.finalDiagnosis.length > 1 && (
                  <span className="text-[11px] text-slate-500">
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

