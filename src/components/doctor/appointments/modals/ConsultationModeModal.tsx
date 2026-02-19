"use client"

import { useState, useEffect } from "react"
import { useRevealModalClose, RevealModal } from "@/components/ui/overlays/RevealModal"
import { type AnatomyModel } from "@/utils/anatomyModelMapping"
import { getAvailableAnatomyModels } from "@/utils/anatomyModelMapping"

type SelectedMode = "normal" | "ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | "skeleton" | null

interface ConsultationModeModalProps {
  isOpen: boolean
  appointmentId: string | null
  doctorSpecialization?: string
  alreadySelectedTypes: ('ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney' | 'skeleton')[]
  onSelectNormal: () => void
  onSelectAnatomy: (anatomyType: 'ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney' | 'skeleton') => void
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

  const show = isOpen && !!appointmentId
  if (!show || !appointmentId) return null

  return (
    <RevealModal
      isOpen={show}
      onClose={onClose}
      contentClassName="bg-white rounded-2xl shadow-2xl w-full max-w-2xl min-w-[320px] max-h-[90vh] overflow-y-auto border border-slate-200/80"
      ariaLabelledBy="consultation-modal-title"
    >
      <ConsultationModeModalContent
        doctorSpecialization={doctorSpecialization}
        alreadySelectedTypes={alreadySelectedTypes}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        onSelectNormal={onSelectNormal}
        onSelectAnatomy={onSelectAnatomy}
      />
    </RevealModal>
  )
}

function ConsultationModeModalContent({
  doctorSpecialization,
  alreadySelectedTypes,
  selectedMode,
  setSelectedMode,
  onSelectNormal,
  onSelectAnatomy,
}: {
  doctorSpecialization?: string
  alreadySelectedTypes: ('ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney' | 'skeleton')[]
  selectedMode: SelectedMode
  setSelectedMode: (m: SelectedMode) => void
  onSelectNormal: () => void
  onSelectAnatomy: (anatomyType: 'ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney' | 'skeleton') => void
}) {
  const requestClose = useRevealModalClose()

  const allAvailableModels = getAvailableAnatomyModels(doctorSpecialization)
  const availableModels = allAvailableModels.filter(model => !alreadySelectedTypes.includes(model.type))

  const modelColors: Record<string, { from: string; to: string; border: string; selectedBorder: string; bg: string }> = {
    ear: { from: 'from-sky-50', to: 'to-blue-50', border: 'border-slate-200', selectedBorder: 'border-blue-400', bg: 'bg-sky-500' },
    nose: { from: 'from-violet-50', to: 'to-purple-50', border: 'border-slate-200', selectedBorder: 'border-violet-400', bg: 'bg-violet-500' },
    throat: { from: 'from-sky-50', to: 'to-blue-50', border: 'border-slate-200', selectedBorder: 'border-blue-400', bg: 'bg-sky-500' },
    dental: { from: 'from-teal-50', to: 'to-cyan-50', border: 'border-slate-200', selectedBorder: 'border-teal-400', bg: 'bg-teal-500' },
    lungs: { from: 'from-amber-50', to: 'to-orange-50', border: 'border-slate-200', selectedBorder: 'border-amber-400', bg: 'bg-amber-500' },
    kidney: { from: 'from-amber-50', to: 'to-orange-50', border: 'border-slate-200', selectedBorder: 'border-amber-400', bg: 'bg-amber-500' },
    skeleton: { from: 'from-stone-50', to: 'to-slate-100', border: 'border-slate-200', selectedBorder: 'border-stone-400', bg: 'bg-stone-500' },
  }

  const handleContinue = () => {
    if (selectedMode === "normal") {
      onSelectNormal()
    } else if (selectedMode) {
      onSelectAnatomy(selectedMode)
    }
    requestClose()
  }

  return (
    <>
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-4 rounded-t-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 id="consultation-modal-title" className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Select Consultation Mode</h3>
              <p className="text-sm text-slate-500 mt-0.5">Choose how to complete this consultation</p>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <section className="mb-8">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">General Consultation</h4>
          <button
            onClick={() => setSelectedMode("normal")}
            className={`w-full p-5 rounded-xl border-2 flex items-center gap-5 text-left transition-all duration-200 ${
              selectedMode === "normal"
                ? "bg-blue-50/80 border-primary shadow-lg shadow-primary/5"
                : "bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center text-white shrink-0 shadow-md">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 text-base">Normal Consultation</h4>
              <p className="text-sm text-slate-500 mt-0.5">Standard notes and prescription form</p>
            </div>
            {selectedMode === "normal" && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </section>

        <section className="mb-8">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Specialized Examination (3D / 2D Models)</h4>
          {availableModels.length > 0 ? (
            <div className="overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2 -mx-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
              {availableModels.map((model: AnatomyModel) => {
                const colors = modelColors[model.type]
                const isSelected = selectedMode === model.type
                return (
                  <button
                    key={model.type}
                    onClick={() => setSelectedMode(model.type)}
                    className={`relative flex-shrink-0 w-36 sm:w-40 snap-center p-5 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all duration-200 min-h-[120px] ${
                      isSelected
                        ? `bg-gradient-to-b ${colors.from} ${colors.to} ${colors.selectedBorder} shadow-lg`
                        : `bg-white ${colors.border} hover:border-slate-300 hover:shadow-md`
                    }`}
                  >
                    <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center text-white text-2xl mb-3 shrink-0 shadow-md`}>
                      {model.icon}
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{model.label}</h4>
                    <p className="text-xs text-slate-500 mt-1">3D / 2D Model</p>
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl">
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
          className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          Continue
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
        <p className="text-xs text-slate-500 text-center mt-4">You can change this later if needed.</p>
      </div>
    </>
  )
}
