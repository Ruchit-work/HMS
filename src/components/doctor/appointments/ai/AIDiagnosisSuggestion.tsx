"use client"

import React from 'react'
import { Appointment as AppointmentType } from "@/types/patient"
import { parseAIDiagnosis as parseAIDiagnosisUtil } from "@/utils/appointments/diagnosisParsers"

interface AIDiagnosisSuggestionProps {
  appointment: AppointmentType
  aiDiagnosisText?: string
  isLoading: boolean
  /** When true, hides duplicate Complete button (sticky bar handles submit). */
  showCompletionForm: boolean
  updating: boolean
  onClose: () => void
  onRegenerate: () => void
  onApplyToNotes?: () => void
  onCompleteConsultation: () => void
}

export default function AIDiagnosisSuggestion({
  appointment,
  aiDiagnosisText,
  isLoading,
  showCompletionForm,
  updating,
  onClose,
  onRegenerate,
  onApplyToNotes,
  onCompleteConsultation,
}: AIDiagnosisSuggestionProps) {
  if (isLoading && !aiDiagnosisText) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-slate-500" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-slate-600">Preparing clinical suggestion…</span>
        </div>
      </div>
    )
  }

  if (!aiDiagnosisText) {
    return null
  }

  const parsed = parseAIDiagnosisUtil(aiDiagnosisText)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-900 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-white text-base">Diagnosis suggestion</h4>
              <p className="text-xs text-slate-300 mt-0.5">From patient data — review before adding to notes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded-lg p-2 transition-all"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3 mb-2">
            <span className="text-lg">🩺</span>
            <h5 className="font-bold text-slate-800 text-sm">PRELIMINARY DIAGNOSIS</h5>
          </div>
          <div className="ml-8 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              {parsed.diagnosis || aiDiagnosisText.trim() || 'Not generated'}
            </p>
          </div>
        </div>

        <div className="pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-lg">🔬</span>
            <h5 className="font-bold text-slate-800 text-sm">RECOMMENDED TESTS</h5>
          </div>
          <div className="ml-8 space-y-2">
            {parsed.tests.length > 0 ? (
              parsed.tests.map((test: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-500 font-mono mt-0.5">{idx + 1}.</span>
                  <span className="text-slate-700">{test}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Not generated</p>
            )}
          </div>
        </div>

        <div className="pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3 mb-2">
            <span className="text-lg">💊</span>
            <h5 className="font-bold text-slate-800 text-sm">TREATMENT RECOMMENDATIONS</h5>
          </div>
          <div className="ml-8 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {parsed.treatment || 'Not generated'}
            </p>
          </div>
        </div>

        <div className="pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3 mb-2">
            <span className="text-lg text-red-600">⚠️</span>
            <h5 className="font-bold text-red-700 text-sm">WHEN TO SEEK IMMEDIATE CARE</h5>
          </div>
          <div className="ml-8 bg-red-50 p-3 rounded-lg border border-red-200">
            <p className="text-sm text-red-800 font-medium leading-relaxed">
              {parsed.urgent || 'Not generated'}
            </p>
          </div>
        </div>

        <div className="pb-4 border-b border-slate-200">
          <details>
            <summary className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
              <span className="text-lg">📝</span>
              <h5 className="font-bold text-slate-800 text-sm">ADDITIONAL NOTES</h5>
            </summary>
            <div className="ml-8 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-700 leading-relaxed">
                {parsed.notes || 'Not generated'}
              </p>
            </div>
          </details>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong className="font-semibold">⚠️ Medical Disclaimer:</strong> This is a data-based clinical suggestion, not a final diagnosis.
            Always examine the patient and use your professional judgment before deciding care.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {onApplyToNotes && (
            <button
              type="button"
              onClick={onApplyToNotes}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all font-semibold text-sm flex items-center justify-center gap-2"
            >
              Add suggestion to consultation notes
            </button>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-semibold text-sm border border-slate-300 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
          {appointment.status === "confirmed" && !showCompletionForm && (
            <button
              type="button"
              onClick={onCompleteConsultation}
              disabled={updating}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              title="Complete consultation"
            >
              Complete Consultation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
