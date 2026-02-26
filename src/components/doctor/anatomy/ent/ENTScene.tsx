'use client'

import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { ENTModel } from './ENTModel'
import { getAnatomyTypeFromPath } from './entAnatomyMappings'

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

  const isLungs = modelPath ? getAnatomyTypeFromPath(modelPath) === 'lungs' : false
  const ambientIntensity = isLungs ? 0.95 : 0.7
  const dir1Intensity = isLungs ? 1.8 : 1.5

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={[4, 4, 6]} intensity={dir1Intensity} castShadow />
      <directionalLight position={[-4, 2, -4]} intensity={isLungs ? 1 : 0.7} />
      <directionalLight position={[0, -2, -3]} intensity={isLungs ? 0.6 : 0.4} />
      <pointLight position={[0, 6, 2]} intensity={isLungs ? 0.9 : 0.7} />
      <pointLight position={[-2, 3, 4]} intensity={isLungs ? 0.6 : 0.4} />

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
