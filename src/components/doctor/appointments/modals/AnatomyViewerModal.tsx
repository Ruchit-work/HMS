"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import InlineAnatomyViewer from "@/components/doctor/anatomy/InlineAnatomyViewer"

interface AnatomyViewerModalProps {
  isOpen: boolean
  appointmentId: string
  patientName: string
  onClose: () => void
}

const anatomyTypes = [
  { type: "ear" as const, label: "Ear" },
  { type: "throat" as const, label: "Throat" },
  { type: "dental" as const, label: "Dental" },
]

export default function AnatomyViewerModal({
  isOpen,
  appointmentId,
  patientName,
  onClose,
}: AnatomyViewerModalProps) {
  const [anatomyType, setAnatomyType] = useState<"ear" | "throat" | "dental">("ear")

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800">3D Anatomy Model</h3>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
              {anatomyTypes.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAnatomyType(type)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    anatomyType === type
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <InlineAnatomyViewer
            appointmentId={appointmentId}
            patientName={patientName}
            anatomyType={anatomyType}
          />
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
