"use client"

import React from 'react'
import { Appointment as AppointmentType } from "@/types/patient"
import { AnatomyViewerData } from "@/components/doctor/InlineAnatomyViewer"
import { CUSTOM_DIAGNOSIS_OPTION } from "@/constants/entDiagnoses"

interface CombinedCompletionModalProps {
  appointment: AppointmentType
  isOpen: boolean
  anatomyViewerData: { [anatomyType: string]: AnatomyViewerData | null }
  mergedData: {
    finalDiagnosis?: string[]
    customDiagnosis?: string
    medicines: Array<{ name?: string; dosage?: string; frequency?: string; duration?: string }>
  } | null
  onClose: () => void
  onConfirm: () => void
}

export default function CombinedCompletionModal({
  appointment,
  isOpen,
  anatomyViewerData,
  mergedData,
  onClose,
  onConfirm,
}: CombinedCompletionModalProps) {
  if (!isOpen) return null

  const dataEntries = Object.values(anatomyViewerData).filter((d): d is AnatomyViewerData => d !== null)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-slate-800">Confirm Completion - All Anatomy Types</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Patient Information</h4>
            <p className="text-slate-700">{appointment.patientName || 'Patient'}</p>
          </div>

          {/* All Anatomy Types */}
          {dataEntries.map((data, idx) => (
            <div key={idx} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
              <h4 className="font-bold text-purple-900 mb-3 text-lg capitalize">{data.anatomyType} Anatomy</h4>
              
              {data.selectedPartInfo && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-purple-800 mb-1">Selected Part:</p>
                  <p className="text-slate-700">{data.selectedPartInfo.name}</p>
                </div>
              )}

              {data.selectedDisease && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-purple-800 mb-1">Diagnosis:</p>
                  <p className="text-slate-700">{data.selectedDisease.name}</p>
                </div>
              )}

              {data.medicines.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-purple-800 mb-2">Medicines ({data.medicines.filter(m => m.name && m.name.trim()).length}):</p>
                  <div className="space-y-2">
                    {data.medicines.filter(m => m.name && m.name.trim()).map((med, medIdx) => (
                      <div key={medIdx} className="bg-white rounded p-2 border border-purple-300">
                        <p className="font-medium text-slate-800">{med.name}</p>
                        {med.dosage && <p className="text-xs text-slate-600">Dosage: {med.dosage}</p>}
                        {med.frequency && <p className="text-xs text-slate-600">Frequency: {med.frequency}</p>}
                        {med.duration && <p className="text-xs text-slate-600">Duration: {med.duration}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.notes && (
                <div>
                  <p className="text-sm font-semibold text-purple-800 mb-1">Notes:</p>
                  <p className="text-slate-700 whitespace-pre-wrap text-sm">{data.notes}</p>
                </div>
              )}
            </div>
          ))}

          {/* Combined Summary */}
          {mergedData && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Combined Diagnosis</h4>
                <div className="space-y-1">
                  {mergedData.finalDiagnosis?.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION).map((diag, idx) => (
                    <p key={idx} className="text-slate-700">• {diag}</p>
                  ))}
                  {mergedData.customDiagnosis && <p className="text-slate-700">• {mergedData.customDiagnosis}</p>}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">All Medicines ({mergedData.medicines.length})</h4>
                <div className="space-y-2">
                  {mergedData.medicines.map((med, idx) => (
                    <div key={idx} className="bg-white rounded p-2 border border-amber-300">
                      <p className="font-medium text-slate-800">{med.name}</p>
                      {med.dosage && <p className="text-xs text-slate-600">Dosage: {med.dosage}</p>}
                      {med.frequency && <p className="text-xs text-slate-600">Frequency: {med.frequency}</p>}
                      {med.duration && <p className="text-xs text-slate-600">Duration: {med.duration}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-modern btn-modern-success flex-1 flex items-center justify-center gap-2"
          >
            Confirm & Complete All
          </button>
        </div>
      </div>
    </div>
  )
}

