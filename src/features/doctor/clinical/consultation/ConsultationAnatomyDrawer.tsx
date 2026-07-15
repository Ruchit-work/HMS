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
  Ear,
  HeartPulse,
  Mic,
  Plus,
  ScanFace,
  Stethoscope,
  X,
} from "lucide-react"
import { useEffect } from "react"

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

interface ConsultationAnatomyDrawerProps {
  isOpen: boolean
  onClose: () => void
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
}

function renderPillIcon(type: AnatomyTab) {
  switch (type) {
    case "ear":
      return <Ear className="w-4 h-4 text-white" />
    case "nose":
      return <ScanFace className="w-4 h-4 text-white" />
    case "throat":
      return <Mic className="w-4 h-4 text-white" />
    case "dental":
      return <Stethoscope className="w-4 h-4 text-white" />
    case "lungs":
      return <HeartPulse className="w-4 h-4 text-white" />
    case "skeleton":
      return <Bone className="w-4 h-4 text-white" />
    default:
      return <Stethoscope className="w-4 h-4 text-white" />
  }
}

export default function ConsultationAnatomyDrawer({
  isOpen,
  onClose,
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
}: ConsultationAnatomyDrawerProps) {
  const availableModels = getAvailableAnatomyModels(doctorSpecialization)
  const resolvedTab = activeTab ?? selectedTypes[0] ?? availableModels[0]?.type ?? "ear"
  const currentData = viewerData[resolvedTab] ?? null
  const sketchfabDisease = (() => {
    const id = currentData?.selectedDisease?.id
    if (!id) return null
    if (id === "asthma" || id === "heart_attack" || id === "diabetes") return id
    return null
  })()

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="consultation-anatomy-drawer-root" role="presentation">
      <button
        type="button"
        className="consultation-anatomy-drawer__backdrop"
        onClick={onClose}
        aria-label="Close anatomy reference"
      />
      <aside
        className="consultation-anatomy-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="3D Anatomy reference"
      >
        <div className="consultation-anatomy-drawer__chrome">
          <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                  3D Anatomy Examination
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reference tool — selections sync to examination findings
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="consultation-anatomy-drawer__close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-width-thin">
            {selectedTypes.map((tab) => {
              const details = getAnatomyModelDetails(tab)
              const isActive = resolvedTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  className={`group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-medium text-xs transition-all shrink-0 ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  {renderPillIcon(tab)}
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
                    className={`ml-1.5 flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                      isActive ? "hover:bg-cyan-500/80 text-white" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    aria-label={`Remove ${details?.label ?? tab}`}
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={onAddAnatomy}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-dashed border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Anatomy
            </button>
          </div>
        </div>

        <div className="consultation-anatomy-drawer__body">
          {selectedTypes.length > 0 ? (
            <>
              <div className="p-4">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <InlineAnatomyViewer
                    key={`${appointmentId}-${resolvedTab}`}
                    appointmentId={appointmentId}
                    patientName={patientName}
                    anatomyType={resolvedTab}
                    referenceMode
                    initialData={viewerData[resolvedTab] ?? undefined}
                    onDataChange={(data) => onDataChange(resolvedTab, data)}
                  />
                </div>
              </div>
              <div className="px-4 pb-4">
                <SketchfabAnatomyViewer disease={sketchfabDisease} />
              </div>
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center m-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
              style={{ minHeight: "400px" }}
            >
              <p className="text-slate-500 font-medium mb-3">
                No anatomy selected. Click &quot;Add Anatomy&quot; to begin.
              </p>
              <button
                type="button"
                onClick={onAddAnatomy}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                Add Anatomy
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
