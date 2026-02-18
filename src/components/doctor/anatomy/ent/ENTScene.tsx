'use client'

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ENTModel } from './ENTModel'

interface ENTSceneProps {
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart?: string | null
  modelPath?: string
  zoomDelta?: number
  onZoomApplied?: () => void
}

export function ENTScene({
  onPartSelect,
  selectedPart,
  modelPath,
  zoomDelta = 0,
  onZoomApplied,
}: ENTSceneProps) {
  const controlsRef = useRef<any>(null)
  const lastZoomDeltaRef = useRef(0)

  useFrame(() => {
    if (zoomDelta === 0) {
      lastZoomDeltaRef.current = 0
      return
    }
    if (!onZoomApplied || zoomDelta === lastZoomDeltaRef.current) return
    lastZoomDeltaRef.current = zoomDelta
    const controls = controlsRef.current
    if (controls && typeof controls.getDistance === 'function' && typeof controls.setDistance === 'function') {
      const d = controls.getDistance()
      const factor = zoomDelta > 0 ? 0.75 : 1.33
      controls.setDistance(Math.max(1, Math.min(50, d * factor)))
    }
    onZoomApplied()
  })

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.5} />
      <pointLight position={[0, 10, 0]} intensity={0.4} />

      <ENTModel key={modelPath} onPartSelect={onPartSelect} selectedPart={selectedPart} modelPath={modelPath} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={1}
        maxDistance={50}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.1}
        rotateSpeed={0.5}
        target={[0, 0, 0]}
        autoRotate={false}
        screenSpacePanning={false}
        touches={{ ONE: 2 }}
      />
    </>
  )
}
