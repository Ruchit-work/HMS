'use client'

import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
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
  controlCommand?: { type: 'reset' | 'rotateLeft' | 'rotateRight'; id: number } | null
}

export function ENTScene({
  onPartSelect,
  selectedPart,
  modelPath,
  zoomDelta = 0,
  onZoomApplied,
  controlCommand = null,
}: ENTSceneProps) {
  const controlsRef = useRef<any>(null)
  const lastZoomDeltaRef = useRef(0)
  const lastCommandIdRef = useRef<number | null>(null)
  const { camera } = useThree()

  useFrame(() => {
    const controls = controlsRef.current

    // Handle zoom
    if (zoomDelta === 0) {
      lastZoomDeltaRef.current = 0
    } else if (onZoomApplied && zoomDelta !== lastZoomDeltaRef.current) {
      lastZoomDeltaRef.current = zoomDelta
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
    }

    // Handle rotate / reset commands
    if (controlCommand && controlCommand.id !== lastCommandIdRef.current && controls) {
      lastCommandIdRef.current = controlCommand.id
      const target = (controls.target as THREE.Vector3) || new THREE.Vector3(0, 0, 0)

      if (controlCommand.type === 'reset') {
        camera.position.set(0, 0, 8)
        controls.target.set(0, 0, 0)
        controls.update()
      } else {
        const angle = (controlCommand.type === 'rotateLeft' ? -Math.PI / 12 : Math.PI / 12)
        const offset = new THREE.Vector3().subVectors(camera.position, target)
        const rotationMatrix = new THREE.Matrix4().makeRotationY(angle)
        offset.applyMatrix4(rotationMatrix)
        camera.position.copy(target).add(offset)
        camera.lookAt(target)
        controls.update()
      }
    }
  })

  const isLungs = modelPath ? getAnatomyTypeFromPath(modelPath) === 'lungs' : false
  // Sketchfab-style: soft, even lighting so anatomy reads clearly (medical/educational)
  const ambientIntensity = isLungs ? 0.72 : 0.45
  const dirKeyIntensity = isLungs ? 0.9 : 1.15
  const dirFillIntensity = isLungs ? 0.65 : 0.5

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={[4, 5, 5]}
        intensity={dirKeyIntensity}
        castShadow={!isLungs}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={50}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-3, 4, 3]} intensity={dirFillIntensity} />
      <directionalLight position={[0, 2, -4]} intensity={isLungs ? 0.5 : 0.3} />
      <directionalLight position={[0, -2, 2]} intensity={0.25} />
      <pointLight position={[0, 5, 4]} intensity={isLungs ? 0.35 : 0.4} distance={24} />

      <ENTModel key={modelPath} onPartSelect={onPartSelect} selectedPart={selectedPart} modelPath={modelPath} />

      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={isLungs ? 0.2 : 0.35}
        scale={12}
        blur={2.5}
        far={4}
      />

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
