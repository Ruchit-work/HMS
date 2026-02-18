'use client'

import React, { useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { findPartName, getSkeletonMeshNumber } from './findPartName'
import { getPartDescription } from './entPartDescriptions'
import { getAnatomyTypeFromPath } from './entAnatomyMappings'
import { getAnatomyFromMeshName, getSkeletonPartFromMeshNameOnly, getMeshNameFromChain } from './skeletonAnatomyData'

interface ENTModelProps {
  onPartSelect?: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart?: string | null
  modelPath?: string
}

export function ENTModel({
  onPartSelect,
  selectedPart: externalSelectedPart,
  modelPath = '/models/ear/ear-anatomy.glb',
}: ENTModelProps) {
  const { scene } = useGLTF(modelPath)
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group | null>(null)
  const { gl, camera, raycaster } = useThree()
  const isDraggingRef = useRef(false)
  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const initializedRef = useRef(false)
  const selectedSkeletonMeshNumberRef = useRef<number | null>(null)
  /** For skeleton: highlight only the exact mesh that was clicked (by object reference), not by name/number */
  const selectedSkeletonMeshRef = useRef<THREE.Object3D | null>(null)

  React.useEffect(() => {
    if (externalSelectedPart !== undefined) setSelectedPart(externalSelectedPart)
  }, [externalSelectedPart])

  // Reset when modelPath changes so we load the new model
  React.useEffect(() => {
    initializedRef.current = false
    setModelReady(false)
    modelRef.current = null
  }, [modelPath])

  React.useEffect(() => {
    if (!scene || initializedRef.current) return

    const clonedScene = scene.clone()
    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    clonedScene.position.x = -center.x
    clonedScene.position.y = -center.y
    clonedScene.position.z = -center.z

    const anatomyType = getAnatomyTypeFromPath(modelPath)
    const scaleFactor = anatomyType === 'skeleton' ? 2.0 : (anatomyType === 'nose' || anatomyType === 'throat') ? 2.2 : 3.5
    const scale = scaleFactor / maxDim
    clonedScene.scale.set(scale, scale, scale)

    const scaledBox = new THREE.Box3().setFromObject(clonedScene)
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
    const scaledSize = scaledBox.getSize(new THREE.Vector3())
    const scaledMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z)

    clonedScene.position.x -= scaledCenter.x
    clonedScene.position.y -= scaledCenter.y
    clonedScene.position.z -= scaledCenter.z

    modelRef.current = clonedScene

    const fov = 45
    const fovRad = (fov * Math.PI) / 180
    const idealDistance = (scaledMaxDim / 2) / Math.tan(fovRad / 2) * 1.3

    clonedScene.userData.idealDistance = idealDistance
    clonedScene.userData.modelSize = scaledMaxDim
    if (groupRef.current) {
      groupRef.current.userData.idealDistance = idealDistance
      groupRef.current.userData.modelSize = scaledMaxDim
    }

    const safeDistance = Math.max(idealDistance, scaledMaxDim * 1.5, 4)
    camera.position.set(0, 0, safeDistance)
    camera.lookAt(0, 0, 0)
    camera.near = 0.1
    camera.far = 1000
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    // Clone materials per mesh so shared materials (e.g. free_pack skeleton) don't all change when one part is highlighted
    clonedScene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => mat.clone())
        } else {
          mesh.material = mesh.material.clone()
        }
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        if (material instanceof THREE.MeshStandardMaterial) {
          mesh.userData.originalColor = material.color.clone()
          mesh.userData.originalEmissive = material.emissive.clone()
        }
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.isInteractive = true
      }
    })

    // Skeleton: assign global mesh index so each mesh gets a distinct part (avoids all showing "Radius & Ulna" when names are missing)
    if (anatomyType === 'skeleton') {
      let skeletonMeshIndex = 0
      clonedScene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          ;(child as THREE.Mesh).userData.skeletonMeshIndex = skeletonMeshIndex++
        }
      })
    }

    initializedRef.current = true
    setModelReady(true)
  }, [scene, camera, modelPath])

  useFrame(({ pointer }) => {
    if (!groupRef.current || !modelRef.current || isDraggingRef.current) return

    raycaster.setFromCamera(pointer, camera)
    let intersects = raycaster.intersectObject(modelRef.current, true)
    if (intersects.length === 0 && groupRef.current) {
      intersects = raycaster.intersectObject(groupRef.current, true)
    }

    let newHoveredPart: string | null = null
    if (intersects.length > 0) {
      const partName = findPartName(intersects[0].object as THREE.Mesh, modelPath)
      if (partName) newHoveredPart = partName
    }

    if (newHoveredPart !== hoveredPart) {
      if (hoveredPart && hoveredPart !== selectedPart && modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const childPartName = findPartName(child, modelPath)
            if (childPartName === hoveredPart) {
              const material = Array.isArray(child.material) ? child.material[0] : child.material
              if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                material.color.copy(child.userData.originalColor)
                material.emissive.copy(child.userData.originalEmissive)
                material.emissiveIntensity = 0
              }
            }
          }
        })
      }

      setHoveredPart(newHoveredPart)

      if (newHoveredPart && newHoveredPart !== selectedPart && modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const childPartName = findPartName(child, modelPath)
            if (childPartName === newHoveredPart) {
              const material = Array.isArray(child.material) ? child.material[0] : child.material
              if (material instanceof THREE.MeshStandardMaterial) {
                const originalColor = child.userData.originalColor || new THREE.Color(0.8, 0.8, 0.8)
                material.color.copy(originalColor).multiplyScalar(1.3)
                material.emissive.setHex(0x333333)
                material.emissiveIntensity = 0.15
              }
            }
          }
        })
      }

      gl.domElement.style.cursor = newHoveredPart ? 'pointer' : 'default'
    }
  })

  const handlePointerDown = React.useCallback((event: any) => {
    if (event.button !== 0) return
    const rect = gl.domElement.getBoundingClientRect()
    const clientX = event.clientX ?? event.nativeEvent?.clientX ?? (event.offsetX != null ? event.offsetX + rect.left : 0)
    const clientY = event.clientY ?? event.nativeEvent?.clientY ?? (event.offsetY != null ? event.offsetY + rect.top : 0)
    pointerDownRef.current = { x: clientX, y: clientY, time: Date.now() }
    isDraggingRef.current = false
  }, [gl])

  const handlePointerMove = React.useCallback((event: any) => {
    if (pointerDownRef.current) {
      const rect = gl.domElement.getBoundingClientRect()
      const clientX = event.clientX ?? event.nativeEvent?.clientX ?? (event.offsetX != null ? event.offsetX + rect.left : 0)
      const clientY = event.clientY ?? event.nativeEvent?.clientY ?? (event.offsetY != null ? event.offsetY + rect.top : 0)
      const dx = Math.abs(clientX - pointerDownRef.current.x)
      const dy = Math.abs(clientY - pointerDownRef.current.y)
      if (dx > 5 || dy > 5) isDraggingRef.current = true
    }
  }, [gl])

  const isSkeleton = getAnatomyTypeFromPath(modelPath) === 'skeleton'

  const shouldHighlightMesh = React.useCallback(
    (child: THREE.Object3D, partName: string | null, meshNumber: number | null) => {
      if (isSkeleton && selectedSkeletonMeshRef.current != null) {
        return child === selectedSkeletonMeshRef.current
      }
      if (isSkeleton && meshNumber != null) {
        const childNum = getSkeletonMeshNumber(child, modelPath)
        return childNum === meshNumber
      }
      const childPartName = findPartName(child, modelPath)
      return childPartName === partName
    },
    [isSkeleton, modelPath]
  )

  const handlePointerUp = React.useCallback((event: any) => {
    if (event.button !== 0 || !pointerDownRef.current) {
      pointerDownRef.current = null
      isDraggingRef.current = false
      return
    }

    const rect = gl.domElement.getBoundingClientRect()
    const clientX = event.clientX ?? event.nativeEvent?.clientX ?? (event.offsetX != null ? event.offsetX + rect.left : 0)
    const clientY = event.clientY ?? event.nativeEvent?.clientY ?? (event.offsetY != null ? event.offsetY + rect.top : 0)

    const dt = Date.now() - pointerDownRef.current.time
    const dx = Math.abs(clientX - pointerDownRef.current.x)
    const dy = Math.abs(clientY - pointerDownRef.current.y)

    if (dt < 300 && dx < 5 && dy < 5 && !isDraggingRef.current) {
      event.stopPropagation()
      if (!groupRef.current || !modelRef.current) {
        pointerDownRef.current = null
        return
      }

      const mouse = new THREE.Vector2()
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObject(modelRef.current, true)

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object as THREE.Mesh
        let partName: string | null
        let partInfo: { name: string; description: string } | undefined
        if (isSkeleton) {
          // Try name first (SM_HumanSkeleton_01..20, Bone_18, etc.); fall back to full resolver so panel always shows something
          let skeletonResult = getSkeletonPartFromMeshNameOnly(clickedObject)
          if (!skeletonResult) skeletonResult = getAnatomyFromMeshName(clickedObject, modelPath)
          partName = skeletonResult ? skeletonResult.partKey : null
          partInfo = skeletonResult ? { name: skeletonResult.name, description: skeletonResult.description } : undefined
          // Log so you can see which mesh was hit and what part it resolved to (for changing part name/description)
          const hitMeshName = getMeshNameFromChain(clickedObject) || clickedObject.name || '(no name)'
          console.log('Raycast hit mesh:', hitMeshName, '| Resolved part:', partName ?? '(none)')
        } else {
          partName = findPartName(clickedObject, modelPath)
          partInfo = partName ? getPartDescription(partName) : undefined
        }
        const clickedSkeletonNum = isSkeleton ? getSkeletonMeshNumber(clickedObject, modelPath) : null

        const hasPartForPanel = partName != null && !partName.startsWith('Part_')
        const shouldHighlight = modelRef.current && (hasPartForPanel || isSkeleton)

        if (shouldHighlight) {
          if (selectedPart || selectedSkeletonMeshRef.current) {
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                if (shouldHighlightMesh(child, selectedPart, selectedSkeletonMeshNumberRef.current)) {
                  const material = Array.isArray(child.material) ? child.material[0] : child.material
                  if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                    material.color.copy(child.userData.originalColor)
                    material.emissive.copy(child.userData.originalEmissive)
                    material.emissiveIntensity = 0
                  }
                }
              }
            })
          }

          const newSelectedPart = isSkeleton ? partName : (selectedPart === partName ? null : partName)
          setSelectedPart(newSelectedPart ?? null)
          selectedSkeletonMeshNumberRef.current = newSelectedPart && clickedSkeletonNum != null ? clickedSkeletonNum : null
          selectedSkeletonMeshRef.current = isSkeleton && (newSelectedPart != null || partName === null) ? clickedObject : null

          if (newSelectedPart || isSkeleton) {
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const isTarget =
                  isSkeleton ? child === clickedObject : shouldHighlightMesh(child, newSelectedPart, selectedSkeletonMeshNumberRef.current)
                if (isTarget) {
                  const material = Array.isArray(child.material) ? child.material[0] : child.material
                  if (material instanceof THREE.MeshStandardMaterial) {
                    material.color.setHex(0x4ade80)
                    material.emissive.setHex(0x22c55e)
                    material.emissiveIntensity = 0.4
                  }
                }
              }
            })
          }

          if (hasPartForPanel) {
            onPartSelect?.(partName!, partInfo)
          } else if (isSkeleton) {
            onPartSelect?.(null, undefined)
          }
        }
      } else {
        if (selectedPart && modelRef.current) {
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (shouldHighlightMesh(child, selectedPart, selectedSkeletonMeshNumberRef.current)) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material
                if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  material.color.copy(child.userData.originalColor)
                  material.emissive.copy(child.userData.originalEmissive)
                  material.emissiveIntensity = 0
                }
              }
            }
          })
          selectedSkeletonMeshNumberRef.current = null
          selectedSkeletonMeshRef.current = null
          setSelectedPart(null)
          onPartSelect?.(null, undefined)
        }
      }
    }

    pointerDownRef.current = null
    isDraggingRef.current = false
  }, [selectedPart, camera, raycaster, onPartSelect, gl, modelPath, isSkeleton, shouldHighlightMesh])

  const handleClick = React.useCallback((event: any) => {
    if (!groupRef.current || !modelRef.current) return

    event.stopPropagation()

    const rect = gl.domElement.getBoundingClientRect()
    const clientX = event.clientX ?? (event.nativeEvent?.clientX ?? 0)
    const clientY = event.clientY ?? (event.nativeEvent?.clientY ?? 0)

    const mouse = new THREE.Vector2()
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObject(modelRef.current, true)

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object as THREE.Mesh
      let partName: string | null
      let partInfo: { name: string; description: string } | undefined
      if (isSkeleton) {
        let skeletonResult = getSkeletonPartFromMeshNameOnly(clickedObject)
        if (!skeletonResult) skeletonResult = getAnatomyFromMeshName(clickedObject, modelPath)
        partName = skeletonResult ? skeletonResult.partKey : null
        partInfo = skeletonResult ? { name: skeletonResult.name, description: skeletonResult.description } : undefined
        const hitMeshName = getMeshNameFromChain(clickedObject) || clickedObject.name || '(no name)'
        console.log('Raycast hit mesh:', hitMeshName, '| Resolved part:', partName ?? '(none)')
      } else {
        partName = findPartName(clickedObject, modelPath)
        partInfo = partName ? getPartDescription(partName) : undefined
      }
      const clickedSkeletonNum = isSkeleton ? getSkeletonMeshNumber(clickedObject, modelPath) : null

      const hasPartForPanel = partName != null && !partName.startsWith('Part_')
      const shouldHighlight = modelRef.current && (hasPartForPanel || isSkeleton)

      if (shouldHighlight) {
        if (selectedPart || selectedSkeletonMeshRef.current) {
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (shouldHighlightMesh(child, selectedPart, selectedSkeletonMeshNumberRef.current)) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material
                if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  material.color.copy(child.userData.originalColor)
                  material.emissive.copy(child.userData.originalEmissive)
                  material.emissiveIntensity = 0
                }
              }
            }
          })
        }

        const newSelectedPart = isSkeleton ? partName : (selectedPart === partName ? null : partName)
        setSelectedPart(newSelectedPart ?? null)
        selectedSkeletonMeshNumberRef.current = newSelectedPart && clickedSkeletonNum != null ? clickedSkeletonNum : null
        selectedSkeletonMeshRef.current = isSkeleton && (newSelectedPart != null || partName === null) ? clickedObject : null

        if (newSelectedPart || isSkeleton) {
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const isTarget =
                isSkeleton ? child === clickedObject : shouldHighlightMesh(child, newSelectedPart, selectedSkeletonMeshNumberRef.current)
              if (isTarget) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material
                if (material instanceof THREE.MeshStandardMaterial) {
                  material.color.setHex(0x4ade80)
                  material.emissive.setHex(0x22c55e)
                  material.emissiveIntensity = 0.4
                }
              }
            }
          })
        }

        if (hasPartForPanel) {
          onPartSelect?.(partName!, partInfo)
        } else if (isSkeleton) {
          onPartSelect?.(null, undefined)
        }
      }
    } else {
      if (selectedPart && modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (shouldHighlightMesh(child, selectedPart, selectedSkeletonMeshNumberRef.current)) {
              const material = Array.isArray(child.material) ? child.material[0] : child.material
              if (material instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                material.color.copy(child.userData.originalColor)
                material.emissive.copy(child.userData.originalEmissive)
                material.emissiveIntensity = 0
              }
            }
          }
        })
        selectedSkeletonMeshNumberRef.current = null
        selectedSkeletonMeshRef.current = null
        setSelectedPart(null)
        onPartSelect?.(null, undefined)
      }
    }
  }, [selectedPart, camera, raycaster, onPartSelect, gl, modelPath, isSkeleton, shouldHighlightMesh])

  if (!scene || !modelReady || !modelRef.current) return null

  return (
    <group
      ref={groupRef}
      onClick={handleClick as any}
      onPointerDown={handlePointerDown as any}
      onPointerMove={handlePointerMove as any}
      onPointerUp={handlePointerUp as any}
    >
      <primitive object={modelRef.current} />
    </group>
  )
}
