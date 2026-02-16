"use client"

import { useState, useEffect } from "react"
import { type AnatomyModel } from "@/utils/anatomyModelMapping"
import { getAvailableAnatomyModels } from "@/utils/anatomyModelMapping"

type SelectedMode = "normal" | "ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | null

interface ConsultationModeModalProps {
  isOpen: boolean
  appointmentId: string | null
  doctorSpecialization?: string
  alreadySelectedTypes: ('ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney')[]
  onSelectNormal: () => void
  onSelectAnatomy: (anatomyType: 'ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney') => void
  onClose: () => void
}

export default function ConsultationModeModal({
  isOpen,
  appointmentId,
  doctorSpecialization,
  alreadySelectedTypes,
  onSelectNormal,
  onSelectAnatomy,
  onClose,
}: ConsultationModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<SelectedMode>("normal")

  useEffect(() => {
    if (isOpen) setSelectedMode("normal")
  }, [isOpen])

  if (!isOpen || !appointmentId) return null

  const allAvailableModels = getAvailableAnatomyModels(doctorSpecialization)
  const availableModels = allAvailableModels.filter(model => !alreadySelectedTypes.includes(model.type))
  
  const modelColors: Record<string, { from: string; to: string; border: string; selectedBorder: string; bg: string }> = {
    ear: { from: 'from-sky-50', to: 'to-blue-50', border: 'border-slate-200', selectedBorder: 'border-blue-400', bg: 'bg-sky-500' },
    nose: { from: 'from-violet-50', to: 'to-purple-50', border: 'border-slate-200', selectedBorder: 'border-violet-400', bg: 'bg-violet-500' },
    throat: { from: 'from-sky-50', to: 'to-blue-50', border: 'border-slate-200', selectedBorder: 'border-blue-400', bg: 'bg-sky-500' },
    dental: { from: 'from-teal-50', to: 'to-cyan-50', border: 'border-slate-200', selectedBorder: 'border-teal-400', bg: 'bg-teal-500' },
    lungs: { from: 'from-amber-50', to: 'to-orange-50', border: 'border-slate-200', selectedBorder: 'border-amber-400', bg: 'bg-amber-500' },
    kidney: { from: 'from-amber-50', to: 'to-orange-50', border: 'border-slate-200', selectedBorder: 'border-amber-400', bg: 'bg-amber-500' },
  }

  const handleContinue = () => {
    if (selectedMode === "normal") {
      onSelectNormal()
    } else if (selectedMode) {
      onSelectAnatomy(selectedMode)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-800">Select Consultation Mode</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-slate-600 mb-5">Choose how you would like to complete the consultation:</p>

          {/* General Consultation */}
          <section className="mb-6">
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">General Consultation</h4>
            <button
              onClick={() => setSelectedMode("normal")}
              className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 text-left transition-all ${
                selectedMode === "normal"
                  ? "bg-blue-50 border-blue-400 shadow-md"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-800">Normal Consultation</h4>
                <p className="text-sm text-slate-500">Standard form</p>
              </div>
              {selectedMode === "normal" && (
                <svg className="w-6 h-6 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </section>

          {/* Specialized Examination - Swiper */}
          <section className="mb-6">
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Specialized Examination (3D/2D Models)</h4>
            {availableModels.length > 0 ? (
              <div className="overflow-x-auto snap-x snap-mandatory flex gap-3 pb-2 -mx-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                {availableModels.map((model: AnatomyModel) => {
                  const colors = modelColors[model.type]
                  const isSelected = selectedMode === model.type
                  return (
                    <button
                      key={model.type}
                      onClick={() => setSelectedMode(model.type)}
                      className={`relative flex-shrink-0 w-28 snap-center p-4 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                        isSelected
                          ? `bg-gradient-to-b ${colors.from} ${colors.to} ${colors.selectedBorder} shadow-md`
                          : `bg-white ${colors.border} hover:border-slate-300`
                      }`}
                    >
                      <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center text-white text-2xl mb-2 shrink-0`}>
                        {model.icon}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">{model.label}</h4>
                      <p className="text-xs text-slate-500">3D/2D Model</p>
                      {isSelected && (
                        <svg className="w-5 h-5 text-slate-600 absolute top-2 right-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  {alreadySelectedTypes.length > 0 ? (
                    <>All available anatomy models for your specialization have already been added.</>
                  ) : (
                    <>No anatomy models are available for your specialization.</>
                  )}
                </p>
              </div>
            )}
          </section>

          <button
            onClick={handleContinue}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md"
          >
            Continue
          </button>
          <p className="text-xs text-slate-500 text-center mt-3">You can change this later if needed.</p>
        </div>
      </div>
    </div>
  )
}
