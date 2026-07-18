"use client"

import React from "react"
import { Appointment as AppointmentType } from "@/types/patient"
import { parseAIDiagnosis as parseAIDiagnosisUtil } from "@/shared/utils/appointments/diagnosisParsers"
import { RefreshCw, Sparkles, X } from "lucide-react"

interface AIDiagnosisSuggestionProps {
  appointment: AppointmentType
  aiDiagnosisText?: string
  isLoading: boolean
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
      <div className="ai-diagnosis-compact ai-diagnosis-compact--loading">
        <svg className="animate-spin h-3.5 w-3.5 text-sky-600 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs text-slate-600">Preparing suggestion…</span>
      </div>
    )
  }

  if (!aiDiagnosisText) {
    return null
  }

  const parsed = parseAIDiagnosisUtil(aiDiagnosisText)
  const diagnosisText = parsed.diagnosis || aiDiagnosisText.trim() || "Not generated"
  const hasDetails =
    parsed.tests.length > 0 ||
    Boolean(parsed.treatment?.trim()) ||
    Boolean(parsed.urgent?.trim()) ||
    Boolean(parsed.notes?.trim())

  return (
    <div className="ai-diagnosis-compact">
      <div className="ai-diagnosis-compact__toolbar">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-800 truncate">AI suggestion</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onApplyToNotes && (
            <button
              type="button"
              onClick={onApplyToNotes}
              className="ai-diagnosis-compact__btn ai-diagnosis-compact__btn--primary"
            >
              Apply
            </button>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="ai-diagnosis-compact__btn"
            title="Regenerate"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ai-diagnosis-compact__btn"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <p className="ai-diagnosis-compact__summary">{diagnosisText}</p>

      {hasDetails && (
        <details className="ai-diagnosis-compact__details">
          <summary>Tests, treatment &amp; notes</summary>
          <div className="ai-diagnosis-compact__details-body">
            {parsed.tests.length > 0 && (
              <div>
                <p className="ai-diagnosis-compact__label">Tests</p>
                <ul className="ai-diagnosis-compact__list">
                  {parsed.tests.map((test, idx) => (
                    <li key={idx}>{test}</li>
                  ))}
                </ul>
              </div>
            )}
            {parsed.treatment?.trim() && (
              <div>
                <p className="ai-diagnosis-compact__label">Treatment</p>
                <p className="ai-diagnosis-compact__text">{parsed.treatment}</p>
              </div>
            )}
            {parsed.urgent?.trim() && (
              <div>
                <p className="ai-diagnosis-compact__label ai-diagnosis-compact__label--urgent">Urgent care</p>
                <p className="ai-diagnosis-compact__text">{parsed.urgent}</p>
              </div>
            )}
            {parsed.notes?.trim() && (
              <div>
                <p className="ai-diagnosis-compact__label">Notes</p>
                <p className="ai-diagnosis-compact__text">{parsed.notes}</p>
              </div>
            )}
          </div>
        </details>
      )}

      <p className="ai-diagnosis-compact__disclaimer">
        Suggestion only — confirm after examination.
      </p>

      {appointment.status === "confirmed" && !showCompletionForm && (
        <button
          type="button"
          onClick={onCompleteConsultation}
          disabled={updating}
          className="ai-diagnosis-compact__btn ai-diagnosis-compact__btn--primary w-full mt-1"
        >
          Complete consultation
        </button>
      )}
    </div>
  )
}
