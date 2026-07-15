/**
 * Skeleton anatomy: mesh name → part key and part info.
 * Single source for 3D skeleton click resolution (free_pack model and anatomical fallbacks).
 */

import type * as THREE from 'three'
import { skeletonPartsData } from '@/constants/skeletonDiseases'

/** free_pack: SM_HumanSkeleton_01..20 → part key */
const SKELETON_MESH_NUMBER_TO_PART: Record<number, string> = {
  1: 'Radius_Ulna', 2: 'Radius_Ulna',
  3: 'Tarsals', 9: 'Tarsals',
  4: 'Femur', 5: 'Femur',
  6: 'Tibia_Fibula', 7: 'Tibia_Fibula',
  8: 'Sternum',
  10: 'Humerus', 12: 'Humerus',
  11: 'Clavicle',
  13: 'Scapula', 15: 'Scapula',
  14: 'Hand', 19: 'Hand',
  16: 'Pelvis',
  17: 'Skull',
  18: 'Mandible',
  20: 'Spine',
}

export interface SkeletonPartInfo {
  partKey: string
  name: string
  description: string
}

/** Get the first non-empty name from this object or its parent chain (for logging and resolution). */
export function getMeshNameFromChain(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  let depth = 0
  while (current && depth < 6) {
    const name = current.name && typeof current.name === 'string' ? current.name.trim() : ''
    if (name) return name
    current = current.parent
    depth++
  }
  return null
}

/**
 * Resolve a 3D mesh (or its parent chain) to skeleton part key and part info.
 * Uses model-specific mesh patterns (e.g. SM_HumanSkeleton_01 → partKey) and skeletonPartsData.
 * Returns null if not skeleton model or no matching part.
 */
export function getAnatomyFromMeshName(
  object: THREE.Object3D,
  modelPath: string
): SkeletonPartInfo | null {
  if (!modelPath.includes('skeleton') && !modelPath.includes('bone') && !modelPath.includes('skelton')) {
    return null
  }

  let meshName = getMeshNameFromChain(object)
  // Some GLBs use only the mesh's own name (e.g. "8" or "Mesh_8")
  if (!meshName && object.name && typeof object.name === 'string') {
    meshName = object.name.trim()
  }

  let num: number | null = null
  if (meshName) {
    num = extractSkeletonMeshNumber(meshName)
    if (num != null && num >= 1 && num <= 20) {
      const partKey = SKELETON_MESH_NUMBER_TO_PART[num] ?? null
      if (partKey && skeletonPartsData[partKey]) {
        const data = skeletonPartsData[partKey]
        return { partKey, name: data.partName, description: data.description }
      }
    }

    // Anatomical name fallback: if mesh/parent name matches a part key (e.g. "Sternum")
    const partKeyFromName = meshName in skeletonPartsData ? meshName : null
    if (partKeyFromName && skeletonPartsData[partKeyFromName]) {
      const data = skeletonPartsData[partKeyFromName]
      return { partKey: partKeyFromName, name: data.partName, description: data.description }
    }
  }

  // Global mesh index first (unique per mesh from ENTModel on load) so each click shows a different part
  const globalIndex = object.userData?.skeletonMeshIndex
  if (typeof globalIndex === 'number' && globalIndex >= 0 && globalIndex < 20) {
    num = globalIndex + 1
    const partKeyByGlobal = SKELETON_MESH_NUMBER_TO_PART[num] ?? null
    if (partKeyByGlobal && skeletonPartsData[partKeyByGlobal]) {
      const data = skeletonPartsData[partKeyByGlobal]
      return { partKey: partKeyByGlobal, name: data.partName, description: data.description }
    }
  }

  // Sibling index last: often 0 for every mesh so would show same part for all
  const parent = object.parent
  if (parent && Array.isArray(parent.children)) {
    const idx = parent.children.indexOf(object)
    if (idx >= 0 && idx < 20) {
      num = idx + 1
      const partKeyByIndex = SKELETON_MESH_NUMBER_TO_PART[num] ?? null
      if (partKeyByIndex && skeletonPartsData[partKeyByIndex]) {
        const data = skeletonPartsData[partKeyByIndex]
        return { partKey: partKeyByIndex, name: data.partName, description: data.description }
      }
    }
  }

  return null
}

/** Extract mesh number (1–20) from various naming patterns used by skeleton GLBs. */
function extractSkeletonMeshNumber(meshName: string): number | null {
  // free_pack: SM_HumanSkeleton_01 .. SM_HumanSkeleton_20 (exact)
  let m = meshName.match(/^SM_HumanSkeleton[_\-]?(\d+)$/i)
  if (m) return parseInt(m[1], 10)

  // SM_HumanSkeleton_18_Humam_Skeleton_M_0 etc. – number right after SM_HumanSkeleton
  m = meshName.match(/SM_HumanSkeleton[_\-]?(\d+)/i)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 20) return n
  }

  // HumanSkeleton_01, Human_Skeleton_1
  m = meshName.match(/(?:Human[_\-]?)?Skeleton[_\-]?(\d+)$/i)
  if (m) return parseInt(m[1], 10)

  // Bone_01, Bone_1, Mesh_08, Object_8, Part_17
  m = meshName.match(/(?:Bone|Mesh|Object|Part)[_\-]?(\d+)$/i)
  if (m) return parseInt(m[1], 10)

  // Trailing number only: name_01 or name-8 (1–20)
  m = meshName.match(/[_\-](\d{1,2})$/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 20) return n
  }

  // Plain number: "1", "08", "20"
  m = meshName.match(/^(\d{1,2})$/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 20) return n
  }

  return null
}

/** Get skeleton mesh number (1–20) from object/parent chain for highlight matching. */
export function getSkeletonMeshNumberFromObject(object: THREE.Object3D): number | null {
  let meshName = getMeshNameFromChain(object)
  if (!meshName && object.name && typeof object.name === 'string') meshName = object.name.trim()
  if (!meshName) return null
  const num = extractSkeletonMeshNumber(meshName)
  return num != null && num >= 1 && num <= 20 ? num : null
}

/** Part key from free_pack mesh number (for use in findPartName matchFromParent). */
export function getSkeletonPartKeyFromMeshNumber(num: number): string | null {
  return SKELETON_MESH_NUMBER_TO_PART[num] ?? null
}

/**
 * Resolve part key and part info from the clicked mesh's name only (no index fallbacks).
 * Uses mesh.name or the first name in the parent chain. Parses the number (1–20) from names like:
 *   SM_HumanSkeleton_01, SM_HumanSkeleton 02, Bone_18, Mesh_08, or 18
 * then maps to part key via the free_pack table. Use this for the info panel so the displayed
 * name/description match the part we actually clicked. Returns null if no number 1–20 is found (do not show wrong part).
 */
export function getSkeletonPartFromMeshNameOnly(object: THREE.Object3D): SkeletonPartInfo | null {
  // 1. Get name from hit mesh then parent chain (mesh name may be on object or parent)
  let meshName: string | null =
    object.name && typeof object.name === 'string' ? object.name.trim() : null
  if (!meshName) meshName = getMeshNameFromChain(object)
  if (!meshName) return null

  // 2. Parse number (e.g. SM_HumanSkeleton_07 → 7) and map to part key
  const num = extractSkeletonMeshNumber(meshName)
  if (num == null || num < 1 || num > 20) return null

  const partKey = SKELETON_MESH_NUMBER_TO_PART[num] ?? null
  if (!partKey || !skeletonPartsData[partKey]) return null
  const data = skeletonPartsData[partKey]
  return { partKey, name: data.partName, description: data.description }
}
