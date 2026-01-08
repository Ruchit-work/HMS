"use client"

import { type AnatomyModel } from "@/utils/anatomyModelMapping"
import { getAvailableAnatomyModels } from "@/utils/anatomyModelMapping"

interface ConsultationModeModalProps {
  isOpen: boolean
  appointmentId: string | null
  doctorSpecialization?: string
  alreadySelectedTypes: ('ear' | 'throat' | 'dental')[]
  onSelectNormal: () => void
  onSelectAnatomy: (anatomyType: 'ear' | 'throat' | 'dental') => void
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
  if (!isOpen || !appointmentId) return null

  const allAvailableModels = getAvailableAnatomyModels(doctorSpecialization)
  // Filter out already selected anatomy types when adding another
  const availableModels = allAvailableModels.filter(model => !alreadySelectedTypes.includes(model.type))
  
  const modelColors: Record<string, { from: string; to: string; border: string; hoverBorder: string; bg: string }> = {
    ear: { from: 'from-purple-50', to: 'to-pink-50', border: 'border-purple-200', hoverBorder: 'border-purple-400', bg: 'bg-purple-600' },
    throat: { from: 'from-red-50', to: 'to-rose-50', border: 'border-red-200', hoverBorder: 'border-red-400', bg: 'bg-red-600' },
    dental: { from: 'from-teal-50', to: 'to-cyan-50', border: 'border-teal-200', hoverBorder: 'border-teal-400', bg: 'bg-teal-600' }
  }
  
  const modelIcons: Record<string, React.ReactElement> = {
    ear: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    throat: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    dental: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-800">Select Consultation Mode</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-slate-600 mb-6">Choose how you would like to complete the consultation:</p>

        <div className={`grid gap-3 ${availableModels.length === 0 ? 'grid-cols-1' : availableModels.length === 1 ? 'grid-cols-2' : availableModels.length === 2 ? 'grid-cols-3' : 'grid-cols-3'}`}>
          {/* Normal Mode - Always available */}
          <button
            onClick={onSelectNormal}
            className="p-4 bg-gradient-to-b from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-center group flex flex-col items-center justify-center"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="font-bold text-sm text-slate-800 mb-1">Normal</h4>
            <p className="text-xs text-slate-600">Standard form</p>
          </button>

          {/* Show only available anatomy models based on specialization */}
          {availableModels.map((model: AnatomyModel) => {
            const colors = modelColors[model.type]
            return (
              <button
                key={model.type}
                onClick={() => onSelectAnatomy(model.type)}
                className={`p-4 bg-gradient-to-b ${colors.from} ${colors.to} border-2 ${colors.border} rounded-lg hover:${colors.hoverBorder} hover:shadow-md transition-all text-center group flex flex-col items-center justify-center`}
              >
                <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform mb-3`}>
                  {modelIcons[model.type]}
                </div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">{model.label}</h4>
                <p className="text-xs text-slate-600">3D/2D Model</p>
              </button>
            )
          })}
        </div>

        {/* Show message if no anatomy models available */}
        {availableModels.length === 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              {alreadySelectedTypes.length > 0 ? (
                <>
                  <strong>Note:</strong> All available anatomy models for your specialization have already been added. Please use the Normal mode or remove an existing anatomy model to add a different one.
                </>
              ) : (
                <>
                  <strong>Note:</strong> No anatomy models are available for your specialization ({doctorSpecialization || 'Unknown'}). Please use the Normal mode.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

