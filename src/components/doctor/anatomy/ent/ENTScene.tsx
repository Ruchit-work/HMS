'use client'

import React, { useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { ENTModel } from './ENTModel'

interface ENTSceneProps {
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart?: string | null
  modelPath?: string
}

export function ENTScene({
  onPartSelect,
  selectedPart,
  modelPath,
}: ENTSceneProps) {
  const controlsRef = useRef<any>(null)

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
        enableZoom={false}
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
