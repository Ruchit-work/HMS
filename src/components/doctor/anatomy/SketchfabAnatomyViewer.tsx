"use client"

import React, { useEffect, useMemo, useState } from "react"

export type AnatomyViewerProps = {
  disease: string | null
}

const diseaseModelMap: Record<string, string> = {
  asthma: "https://sketchfab.com/models/5c62cd4d4ba04243be1062d2263d3ef0/embed",
  heart_attack: "https://sketchfab.com/models/heart-model-id/embed",
  diabetes: "https://sketchfab.com/models/pancreas-model-id/embed",
}

export default function SketchfabAnatomyViewer({ disease }: AnatomyViewerProps) {
  const modelUrl = useMemo(() => {
    if (!disease) return null
    return diseaseModelMap[disease] ?? null
  }, [disease])

  const [isLoading, setIsLoading] = useState<boolean>(!!modelUrl)

  useEffect(() => {
    setIsLoading(!!modelUrl)
  }, [modelUrl])

  if (!modelUrl) {
    return (
      <div className="flex h-full min-h-[220px] flex-col justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-600">Select a disease to view anatomy</p>
        <p className="mt-1 text-xs text-slate-500">Supported: Asthma, Heart attack, Diabetes</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anatomy Viewer</p>
        {isLoading && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            Loading model…
          </span>
        )}
      </div>
      <div className="relative flex-1 bg-slate-50">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/80">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
              <p className="text-xs text-slate-500">Preparing 3D anatomy view…</p>
            </div>
          </div>
        )}
        <iframe
          key={modelUrl}
          src={modelUrl}
          title="Anatomy Viewer"
          className="h-full w-full rounded-b-xl"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          loading="lazy"
          onLoad={() => setIsLoading(false)}
        />
      </div>
      <div className="border-t border-slate-200 px-3 py-2 text-right">
        <p className="text-[10px] text-slate-400">3D model provided by Sketchfab</p>
      </div>
    </div>
  )
}

