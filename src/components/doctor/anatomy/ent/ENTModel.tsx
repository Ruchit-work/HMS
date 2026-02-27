'use client'

import React, { useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { findPartName, getSkeletonMeshNumber, getObjectAndParentNames } from './findPartName'
import { getPartDescription } from './entPartDescriptions'
import { getAnatomyTypeFromPath } from './entAnatomyMappings'
import { getAnatomyFromMeshName, getSkeletonPartFromMeshNameOnly } from './skeletonAnatomyData'

/** Return the first hit that is a Mesh (never a Group or other container). */
function getFirstHitMesh(intersects: THREE.Intersection[]): THREE.Mesh | null {
  for (let i = 0; i < intersects.length; i++) {
    const obj = intersects[i].object
    if (obj instanceof THREE.Mesh) return obj
  }
  return null
}

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
  /** For lungs/other anatomy: highlight only the clicked mesh so "all parts" don't light up together */
  const selectedAnatomyMeshRef = useRef<THREE.Object3D | null>(null)
  /** For lungs/other anatomy: hover only the mesh under cursor, not all meshes with the same part name */
  const hoveredAnatomyMeshRef = useRef<THREE.Object3D | null>(null)

  React.useEffect(() => {
    if (externalSelectedPart !== undefined) setSelectedPart(externalSelectedPart)
  }, [externalSelectedPart])

  // Reset when modelPath changes so we load the new model
  React.useEffect(() => {
    initializedRef.current = false
    setModelReady(false)
    modelRef.current = null
    selectedAnatomyMeshRef.current = null
    hoveredAnatomyMeshRef.current = null
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

    // Clone material per mesh so no two meshes share a material (critical for lungs: one click = one part)
    clonedScene.traverse((child: THREE.Object3D) => {
      child.visible = true
      if (child instanceof THREE.Mesh && child.material) {
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m as THREE.Material).clone())
        } else {
          mesh.material = (mesh.material as THREE.Material).clone()
        }
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        const isStandard = material instanceof THREE.MeshStandardMaterial
        const isPhysical = material instanceof THREE.MeshPhysicalMaterial
        if (isStandard || isPhysical) {
          const mat = material as THREE.MeshStandardMaterial
          mesh.userData.originalColor = mat.color.clone()
          mesh.userData.originalEmissive = mat.emissive.clone()
          if (anatomyType === 'lungs') {
            // Sketchfab-style: matte, readable anatomy (no shine)
            mat.roughness = Math.max(mat.roughness ?? 0.5, 0.78)
            mat.metalness = 0
            mat.envMapIntensity = 0
            const { r, g, b } = mat.color
            const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if (brightness < 0.5) {
              mat.color.multiplyScalar(1.0 / Math.max(brightness, 0.05) * 0.6)
              mat.color.r = Math.max(0, Math.min(1, mat.color.r))
              mat.color.g = Math.max(0, Math.min(1, mat.color.g))
              mat.color.b = Math.max(0, Math.min(1, mat.color.b))
            }
            if (isPhysical && (mat as THREE.MeshPhysicalMaterial).transmission !== undefined) {
              (mat as THREE.MeshPhysicalMaterial).depthWrite = true
            }
          }
        }
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.isInteractive = true
      }
    })

    // Skeleton: assign global mesh index so each mesh gets a distinct part
    if (anatomyType === 'skeleton') {
      let skeletonMeshIndex = 0
      clonedScene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          ;(child as THREE.Mesh).userData.skeletonMeshIndex = skeletonMeshIndex++
        }
      })
    }
    // Lungs/heart: assign mesh index (1–16) so every mesh maps to one of the 16 parts
    if (anatomyType === 'lungs') {
      let lungsMeshIndex = 0
      clonedScene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          lungsMeshIndex++
          ;(child as THREE.Mesh).userData.lungsMeshIndex = ((lungsMeshIndex - 1) % 16) + 1
        }
      })
    }

    initializedRef.current = true
    setModelReady(true)
  }, [scene, camera, modelPath])

  const anatomyTypeRef = useRef(getAnatomyTypeFromPath(modelPath))
  anatomyTypeRef.current = getAnatomyTypeFromPath(modelPath)

  useFrame(({ pointer }) => {
    if (!groupRef.current || !modelRef.current || isDraggingRef.current) return

    raycaster.setFromCamera(pointer, camera)
    let intersects = raycaster.intersectObject(modelRef.current, true)
    if (intersects.length === 0 && groupRef.current) {
      intersects = raycaster.intersectObject(groupRef.current, true)
    }

    let newHoveredPart: string | null = null
    const newHoveredMesh = getFirstHitMesh(intersects)
    if (newHoveredMesh) {
      const partName = findPartName(newHoveredMesh, modelPath)
      if (partName) newHoveredPart = partName
    }

    const isSkeletonFrame = anatomyTypeRef.current === 'skeleton'
    const hoverChanged = newHoveredPart !== hoveredPart || newHoveredMesh !== hoveredAnatomyMeshRef.current

    if (hoverChanged) {
      // Clear previous hover: for non-skeleton only clear the single previously hovered mesh (not all with same part name)
      if (modelRef.current) {
        if (isSkeletonFrame) {
          if (hoveredPart && hoveredPart !== selectedPart) {
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
        } else {
          const prevHovered = hoveredAnatomyMeshRef.current
          if (prevHovered && prevHovered !== selectedAnatomyMeshRef.current && prevHovered instanceof THREE.Mesh) {
            const material = Array.isArray(prevHovered.material) ? prevHovered.material[0] : prevHovered.material
            if (material instanceof THREE.MeshStandardMaterial && prevHovered.userData.originalColor) {
              material.color.copy(prevHovered.userData.originalColor)
              material.emissive.copy(prevHovered.userData.originalEmissive)
              material.emissiveIntensity = 0
            }
          }
        }
      }

      hoveredAnatomyMeshRef.current = isSkeletonFrame ? null : newHoveredMesh
      setHoveredPart(newHoveredPart)

      // Apply new hover: for non-skeleton only the mesh under cursor; for skeleton all meshes with that part name
      if (modelRef.current) {
        if (isSkeletonFrame && newHoveredPart && newHoveredPart !== selectedPart) {
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
        } else if (!isSkeletonFrame && newHoveredMesh && newHoveredMesh !== selectedAnatomyMeshRef.current) {
          const material = Array.isArray(newHoveredMesh.material) ? newHoveredMesh.material[0] : newHoveredMesh.material
          if (material instanceof THREE.MeshStandardMaterial) {
            const originalColor = newHoveredMesh.userData.originalColor || new THREE.Color(0.8, 0.8, 0.8)
            material.color.copy(originalColor).multiplyScalar(1.3)
            material.emissive.setHex(0x333333)
            material.emissiveIntensity = 0.15
          }
        }
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
      // For lungs/other anatomy: highlight by part name so the whole part (e.g. entire left lung) is selected
      if (!isSkeleton && partName != null) {
        const childPartName = findPartName(child, modelPath)
        return childPartName === partName
      }
      if (!isSkeleton && selectedAnatomyMeshRef.current != null) {
        return child === selectedAnatomyMeshRef.current
      }
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
      const clickedMesh = getFirstHitMesh(intersects)

      if (clickedMesh) {
        let partName: string | null
        let partInfo: { name: string; description: string } | undefined
        if (isSkeleton) {
          let skeletonResult = getSkeletonPartFromMeshNameOnly(clickedMesh)
          if (!skeletonResult) skeletonResult = getAnatomyFromMeshName(clickedMesh, modelPath)
          partName = skeletonResult ? skeletonResult.partKey : null
          partInfo = skeletonResult ? { name: skeletonResult.name, description: skeletonResult.description } : undefined
        } else {
          partName = findPartName(clickedMesh, modelPath)
          partInfo = partName ? getPartDescription(partName) : undefined
          // Log mesh/parent names so you can add them to lungsMeshPartMapping.ts (open DevTools → Console)
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            const names = getObjectAndParentNames(clickedMesh)
            console.log('[Lungs] Clicked mesh names (add to lungsMeshPartMapping.ts):', names, '→ part:', partName)
          }
        }
        const clickedSkeletonNum = isSkeleton ? getSkeletonMeshNumber(clickedMesh, modelPath) : null

        const hasPartForPanel = partName != null && !partName.startsWith('Part_')
        const shouldHighlight = modelRef.current && (hasPartForPanel || isSkeleton)

        if (shouldHighlight) {
          // Reset previous selection
          if (isSkeleton) {
            if (selectedPart || selectedSkeletonMeshRef.current) {
              modelRef.current.traverse((child) => {
                if (child instanceof THREE.Mesh && shouldHighlightMesh(child, selectedPart, selectedSkeletonMeshNumberRef.current)) {
                  const mat = Array.isArray(child.material) ? child.material[0] : child.material
                  if (mat instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                    mat.color.copy(child.userData.originalColor)
                    mat.emissive.copy(child.userData.originalEmissive)
                    mat.emissiveIntensity = 0
                  }
                }
              })
            }
          } else {
            // Lungs / non-skeleton: reset every mesh to original, then highlight only the selected part’s meshes
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material
                if (mat instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  mat.color.copy(child.userData.originalColor)
                  mat.emissive.copy(child.userData.originalEmissive)
                  mat.emissiveIntensity = 0
                }
              }
            })
          }

          const newSelectedPart = isSkeleton ? partName : (selectedPart === partName ? null : partName)
          setSelectedPart(newSelectedPart ?? null)
          selectedSkeletonMeshNumberRef.current = newSelectedPart && clickedSkeletonNum != null ? clickedSkeletonNum : null
          selectedSkeletonMeshRef.current = isSkeleton && (newSelectedPart != null || partName === null) ? clickedMesh : null
          selectedAnatomyMeshRef.current = !isSkeleton && newSelectedPart != null ? clickedMesh : null

          // Highlight: skeleton = single mesh by number; lungs/anatomy = all meshes with same part name (e.g. entire left lung)
          if (newSelectedPart || isSkeleton) {
            if (isSkeleton) {
              const mat = Array.isArray(clickedMesh.material) ? clickedMesh.material[0] : clickedMesh.material
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.color.setHex(0x4ade80)
                mat.emissive.setHex(0x22c55e)
                mat.emissiveIntensity = 0.4
              }
            } else {
              modelRef.current.traverse((child) => {
                if (child instanceof THREE.Mesh && findPartName(child, modelPath) === newSelectedPart) {
                  const mat = Array.isArray(child.material) ? child.material[0] : child.material
                  if (mat instanceof THREE.MeshStandardMaterial) {
                    mat.color.setHex(0x4ade80)
                    mat.emissive.setHex(0x22c55e)
                    mat.emissiveIntensity = 0.4
                  }
                }
              })
            }
          }

          if (hasPartForPanel) {
            onPartSelect?.(partName!, partInfo)
          } else if (isSkeleton) {
            onPartSelect?.(null, undefined)
          }
        }
      } else {
        if (selectedPart && modelRef.current) {
          if (isSkeleton) {
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh && shouldHighlightMesh(child, selectedPart, selectedSkeletonMeshNumberRef.current)) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material
                if (mat instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  mat.color.copy(child.userData.originalColor)
                  mat.emissive.copy(child.userData.originalEmissive)
                  mat.emissiveIntensity = 0
                }
              }
            })
          } else {
            // Lungs: reset every mesh so no part stays highlighted
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material
                if (mat instanceof THREE.MeshStandardMaterial && child.userData.originalColor) {
                  mat.color.copy(child.userData.originalColor)
                  mat.emissive.copy(child.userData.originalEmissive)
                  mat.emissiveIntensity = 0
                }
              }
            })
          }
          selectedSkeletonMeshNumberRef.current = null
          selectedSkeletonMeshRef.current = null
          selectedAnatomyMeshRef.current = null
          setSelectedPart(null)
          onPartSelect?.(null, undefined)
        }
      }
    }

    pointerDownRef.current = null
    isDraggingRef.current = false
  }, [selectedPart, camera, raycaster, onPartSelect, gl, modelPath, isSkeleton, shouldHighlightMesh])

  if (!scene || !modelReady || !modelRef.current) return null

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown as any}
      onPointerMove={handlePointerMove as any}
      onPointerUp={handlePointerUp as any}
    >
      <primitive object={modelRef.current} />
    </group>
  )
}
