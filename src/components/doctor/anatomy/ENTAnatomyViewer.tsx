"use client"

import React, { useRef, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { PerspectiveCamera, useGLTF } from '@react-three/drei'
import { ENTScene } from './ent/ENTScene'

if (typeof window !== 'undefined') {
  const _prevError = console.error
  console.error = (...args: unknown[]) => {
    if (args[0] === "THREE.GLTFLoader: Couldn't load texture" && typeof args[1] === 'string' && args[1].startsWith('blob:')) {
      return
    }
    _prevError.apply(console, args)
  }
}

interface ENTAnatomyViewerProps {
  modelPath?: string
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  className?: string
  selectedPart?: string | null
}

const isLungsModel = (path: string) => path.includes('lungs') || path.includes('heart')

export default function ENTAnatomyViewer({
  modelPath = '/models/ear/ear-anatomy.glb',
  onPartSelect,
  className = '',
  selectedPart
}: ENTAnatomyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoomDelta, setZoomDelta] = useState(0)
  const [commandId, setCommandId] = useState(0)
  const [controlCommand, setControlCommand] = useState<{ type: 'reset' | 'rotateLeft' | 'rotateRight'; id: number } | null>(null)
  const isLungs = isLungsModel(modelPath)
  // Sketchfab-style: neutral soft background for anatomy (like the E-learning UMCG heart & lungs viewer)
  const bgStyle = isLungs
    ? 'linear-gradient(160deg, #f0f0f0 0%, #e8e8e8 50%, #e0e0e0 100%)'
    : 'linear-gradient(to bottom right, #f8fafc, #e2e8f0)'
  const bgColor = isLungs ? '#ececec' : '#f1f5f9'
  const exposure = isLungs ? 1.38 : 1.35

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full rounded-lg overflow-hidden flex items-center justify-center ${className}`}
      style={{
        touchAction: 'none',
        background: bgStyle
      }}
    >
      <div className="w-full max-w-3xl h-full max-h-[720px] mx-auto relative">
        <Canvas
          className="w-full h-full"
          shadows
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: exposure,
            outputColorSpace: THREE.SRGBColorSpace
          }}
          dpr={[1, 2]}
          camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 1000 }}
          frameloop="always"
        >
          <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} near={0.1} far={1000} />
          <color attach="background" args={[bgColor]} />
          <Suspense fallback={null}>
            <ENTScene
              onPartSelect={onPartSelect}
              selectedPart={selectedPart}
              modelPath={modelPath}
              zoomDelta={zoomDelta}
              onZoomApplied={() => setZoomDelta(0)}
              controlCommand={controlCommand}
            />
          </Suspense>
        </Canvas>
        {/* Viewer controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 shadow-sm p-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomDelta(1)}
            className="h-9 w-9 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomDelta(-1)}
            className="h-9 w-9 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Rotate left"
            onClick={() => {
              setCommandId((prev) => prev + 1)
              setControlCommand({ type: 'rotateLeft', id: commandId + 1 })
            }}
            className="h-9 w-9 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v6h6" />
              <path d="M3.51 9a9 9 0 1 0 2.13-5.36L3 8" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Rotate right"
            onClick={() => {
              setCommandId((prev) => prev + 1)
              setControlCommand({ type: 'rotateRight', id: commandId + 1 })
            }}
            className="h-9 w-9 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" />
              <path d="M20.49 9A9 9 0 1 1 18.36 3.64L21 8" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Reset view"
            onClick={() => {
              setCommandId((prev) => prev + 1)
              setControlCommand({ type: 'reset', id: commandId + 1 })
            }}
            className="h-9 w-9 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 3.6a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 3.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.4 8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

if (typeof window !== 'undefined') {
  useGLTF.preload('/models/ear/ear-anatomy.glb')
  useGLTF.preload('/models/lungs/healthy_heart_and_lungs.glb')
}
