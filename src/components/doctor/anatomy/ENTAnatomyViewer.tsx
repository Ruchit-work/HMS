"use client"

import React, { useRef, Suspense } from 'react'
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
      style={{ touchAction: 'none' }}
    >
      <div className="w-full max-w-2xl h-full max-h-[600px] mx-auto">
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
            <ENTScene onPartSelect={onPartSelect} selectedPart={selectedPart} modelPath={modelPath} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

if (typeof window !== 'undefined') {
  useGLTF.preload('/models/ear/ear-anatomy.glb')
}
