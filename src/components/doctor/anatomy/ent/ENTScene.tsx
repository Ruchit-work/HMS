'use client'

import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { ENTModel } from './ENTModel'

const MIN_DISTANCE = 1
const MAX_DISTANCE = 50

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
  const { camera } = useThree()

  useFrame(() => {
    if (zoomDelta === 0) {
      lastZoomDeltaRef.current = 0
      return
    }
    if (!onZoomApplied || zoomDelta === lastZoomDeltaRef.current) return
    lastZoomDeltaRef.current = zoomDelta
    const controls = controlsRef.current
    if (!controls || !controls.target) return
    const target = controls.target as THREE.Vector3
    const distance = camera.position.distanceTo(target)
    const factor = zoomDelta > 0 ? 0.75 : 1.33
    const newDistance = THREE.MathUtils.clamp(distance * factor, MIN_DISTANCE, MAX_DISTANCE)
    const direction = new THREE.Vector3()
      .subVectors(camera.position, target)
      .normalize()
    camera.position.copy(target).add(direction.multiplyScalar(newDistance))
    controls.update()
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
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
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
