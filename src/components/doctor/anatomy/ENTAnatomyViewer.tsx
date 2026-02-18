"use client"

import React, { useRef, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
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

export default function ENTAnatomyViewer({
  modelPath = '/models/ear/ear-anatomy.glb',
  onPartSelect,
  className = '',
  selectedPart
}: ENTAnatomyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoomDelta, setZoomDelta] = useState(0)

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
      style={{ touchAction: 'none' }}
    >
      <div className="w-full max-w-2xl h-full max-h-[600px] mx-auto relative">
        <Canvas
          className="w-full h-full"
          shadows
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
          }}
          dpr={[1, 2]}
          camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 1000 }}
          frameloop="always"
        >
          <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} near={0.1} far={1000} />
          <color attach="background" args={['#f8fafc']} />
          <Suspense fallback={null}>
            <ENTScene
              onPartSelect={onPartSelect}
              selectedPart={selectedPart}
              modelPath={modelPath}
              zoomDelta={zoomDelta}
              onZoomApplied={() => setZoomDelta(0)}
            />
          </Suspense>
        </Canvas>
        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 shadow-sm p-1">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomDelta(1)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
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
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

if (typeof window !== 'undefined') {
  useGLTF.preload('/models/ear/ear-anatomy.glb')
}
