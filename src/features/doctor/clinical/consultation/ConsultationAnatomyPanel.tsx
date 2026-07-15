"use client"

import dynamic from "next/dynamic"
import type { AnatomyViewerData } from "@/features/doctor/anatomy/InlineAnatomyViewer"
import SketchfabAnatomyViewer from "@/features/doctor/anatomy/SketchfabAnatomyViewer"
import {
  getAnatomyModelDetails,
  getAvailableAnatomyModels,
  type AnatomyType,
} from "@/utils/anatomyModelMapping"
import {
  Bone,
  ChevronDown,
  ChevronUp,
  Ear,
  HeartPulse,
  Mic,
  Plus,
  ScanFace,
  Stethoscope,
  X,
} from "lucide-react"

const InlineAnatomyViewer = dynamic(
  () => import("@/features/doctor/anatomy/InlineAnatomyViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[680px] items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        Loading 3D anatomy model…
      </div>
    ),
  }
)

type AnatomyTab = AnatomyType

interface ConsultationAnatomyPanelProps {
  appointmentId: string
  patientName: string
  doctorSpecialization?: string
  isExpanded: boolean
  onToggleExpanded: () => void
  selectedTypes: AnatomyTab[]
  activeTab: AnatomyTab | undefined
  viewerData: Record<string, AnatomyViewerData | null | undefined>
  onSelectTab: (tab: AnatomyTab) => void
  onAddAnatomy: () => void
  onRemoveTab: (tab: AnatomyTab) => void
  onDataChange: (tab: AnatomyTab, data: AnatomyViewerData | null) => void
}

function renderTabIcon(type: AnatomyTab) {
  switch (type) {
    case "ear":
      return <Ear className="w-4 h-4" />
    case "nose":
      return <ScanFace className="w-4 h-4" />
    case "throat":
      return <Mic className="w-4 h-4" />
    case "dental":
      return <Stethoscope className="w-4 h-4" />
    case "lungs":
      return <HeartPulse className="w-4 h-4" />
    case "skeleton":
      return <Bone className="w-4 h-4" />
    default:
      return <Stethoscope className="w-4 h-4" />
  }
}

export default function ConsultationAnatomyPanel({
  appointmentId,
  patientName,
  doctorSpecialization,
  isExpanded,
  onToggleExpanded,
  selectedTypes,
  activeTab,
  viewerData,
  onSelectTab,
  onAddAnatomy,
  onRemoveTab,
  onDataChange,
}: ConsultationAnatomyPanelProps) {
  const availableModels = getAvailableAnatomyModels(doctorSpecialization)
  const resolvedTab = activeTab ?? selectedTypes[0] ?? availableModels[0]?.type ?? "ear"
  const hasModels = selectedTypes.length > 0
  const currentData = viewerData[resolvedTab] ?? null
  const sketchfabDisease = (() => {
    const id = currentData?.selectedDisease?.id
    if (!id) return null
    if (id === "asthma" || id === "heart_attack" || id === "diabetes") return id
    return null
  })()

  return (
    <section className={`consultation-anatomy-panel ${isExpanded ? "consultation-anatomy-panel--expanded" : ""}`}>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="consultation-anatomy-panel__header"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Stethoscope className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-800">3D Anatomy examination</span>
          {hasModels && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              {selectedTypes.length} model{selectedTypes.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
          {isExpanded ? (
            <>
              Collapse
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Expand
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="consultation-anatomy-panel__body">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-width-thin">
            {selectedTypes.map((tab) => {
              const details = getAnatomyModelDetails(tab)
              const isActive = resolvedTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  className={`group inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium shrink-0 transition-all ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {renderTabIcon(tab)}
                  <span>{details?.label ?? tab}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveTab(tab)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation()
                        onRemoveTab(tab)
                      }
                    }}
                    className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                      isActive ? "hover:bg-white/20 text-white" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    aria-label={`Remove ${details?.label ?? tab}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={onAddAnatomy}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-700 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Anatomy
            </button>
          </div>

          {hasModels ? (
            <div className="consultation-anatomy-panel__viewer mt-2">
              <InlineAnatomyViewer
                key={`${appointmentId}-${resolvedTab}`}
                appointmentId={appointmentId}
                patientName={patientName}
                anatomyType={resolvedTab}
                referenceMode
                initialData={viewerData[resolvedTab] ?? undefined}
                onDataChange={(data) => onDataChange(resolvedTab, data)}
              />
              <div className="mt-2 px-1">
                <SketchfabAnatomyViewer disease={sketchfabDisease} />
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
              <p className="text-sm text-slate-600 mb-2">Select an anatomy model to examine while documenting.</p>
              <button
                type="button"
                onClick={onAddAnatomy}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Add anatomy model
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
