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
  Box,
  ChevronRight,
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

interface ConsultationAnatomyViewProps {
  appointmentId: string
  patientName: string
  doctorSpecialization?: string
  selectedTypes: AnatomyTab[]
  activeTab: AnatomyTab | undefined
  viewerData: Record<string, AnatomyViewerData | null | undefined>
  onSelectTab: (tab: AnatomyTab) => void
  onAddAnatomy: () => void
  onRemoveTab: (tab: AnatomyTab) => void
  onDataChange: (tab: AnatomyTab, data: AnatomyViewerData | null) => void
  onBackToForm: () => void
}

function renderPillIcon(type: AnatomyTab, active: boolean) {
  const className = `w-4 h-4 ${active ? "text-white" : "text-slate-600"}`
  switch (type) {
    case "ear":
      return <Ear className={className} />
    case "nose":
      return <ScanFace className={className} />
    case "throat":
      return <Mic className={className} />
    case "dental":
      return <Stethoscope className={className} />
    case "lungs":
      return <HeartPulse className={className} />
    case "skeleton":
      return <Bone className={className} />
    default:
      return <Stethoscope className={className} />
  }
}

export default function ConsultationAnatomyView({
  appointmentId,
  patientName,
  doctorSpecialization,
  selectedTypes,
  activeTab,
  viewerData,
  onSelectTab,
  onAddAnatomy,
  onRemoveTab,
  onDataChange,
  onBackToForm,
}: ConsultationAnatomyViewProps) {
  const availableModels = getAvailableAnatomyModels(doctorSpecialization)
  const resolvedTab = activeTab ?? selectedTypes[0] ?? availableModels[0]?.type ?? "ear"
  const currentData = viewerData[resolvedTab] ?? null
  const sketchfabDisease = (() => {
    const id = currentData?.selectedDisease?.id
    if (!id) return null
    if (id === "asthma" || id === "heart_attack" || id === "diabetes") return id
    return null
  })()

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">3D Anatomy Viewer</span>
        </div>
        <button
          type="button"
          onClick={onBackToForm}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          Back to form
        </button>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-4">
        <nav className="flex items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
          <span>Appointments</span>
          <ChevronRight className="w-3 h-3" />
          <span>Consultation</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium">3D Anatomy</span>
        </nav>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">3D Anatomy Examination</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Focus on specific anatomy while keeping notes and medicines in sync.
          </p>
        </div>

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
                {renderPillIcon(tab, isActive)}
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

        {selectedTypes.length > 0 ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <InlineAnatomyViewer
                key={`${appointmentId}-${resolvedTab}`}
                appointmentId={appointmentId}
                patientName={patientName}
                anatomyType={resolvedTab}
                initialData={viewerData[resolvedTab] ?? undefined}
                onDataChange={(data) => onDataChange(resolvedTab, data)}
              />
            </div>
            <SketchfabAnatomyViewer disease={sketchfabDisease} />
          </>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
            <p className="text-sm text-slate-600 mb-3">
              Select an anatomy model to begin the examination.
            </p>
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
    </section>
  )
}
