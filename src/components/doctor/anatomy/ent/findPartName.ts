/**
 * Resolves mesh/object names to standardized anatomy part names
 */

import type * as THREE from 'three'
import {
  getAnatomyTypeFromPath,
  getObjectNumberMapping,
  anatomicalNameToPartMap,
  objectNameToPartMap,
} from './entAnatomyMappings'
import { entPartDescriptions } from './entPartDescriptions'
import { getAnatomyFromMeshName, getSkeletonMeshNumberFromObject, getSkeletonPartKeyFromMeshNumber } from './skeletonAnatomyData'

export function findPartName(
  object: THREE.Object3D,
  modelPath: string = '/models/ear/ear-anatomy.glb'
): string | null {
  const anatomyType = getAnatomyTypeFromPath(modelPath)
  const objectNumberMapping = getObjectNumberMapping(anatomyType)
  let partName: string | null = null

  // Skeleton: use skeletonAnatomyData (mesh-name mapping + anatomical fallbacks)
  if (anatomyType === 'skeleton') {
    const result = getAnatomyFromMeshName(object, modelPath)
    return result ? result.partKey : null
  }

  // Resolve name from object or parent chain (some GLBs put name on parent group)
  const effectiveName = getObjectOrParentName(object)

  if (effectiveName) {
    const objectName = effectiveName.trim()

    // Anatomical name (exact)
    if (anatomicalNameToPartMap[anatomyType]?.[objectName]) {
      partName = anatomicalNameToPartMap[anatomyType][objectName]
    }
    // Anatomical name (case-insensitive)
    else if (anatomicalNameToPartMap[anatomyType] && Object.keys(anatomicalNameToPartMap[anatomyType]).length > 0) {
      const lowerName = objectName.toLowerCase()
      for (const [anatomicalName, mappedPart] of Object.entries(anatomicalNameToPartMap[anatomyType])) {
        if (anatomicalName.toLowerCase() === lowerName) {
          partName = mappedPart
          break
        }
      }
    }

    // Generic mappings (Object_X, Mesh_X)
    if (!partName) {
      if (anatomyType === 'ear' && objectNameToPartMap[objectName]) {
        partName = objectNameToPartMap[objectName]
      } else {
        const objectMatch = objectName.match(/^[Oo]bject[_ ]?(\d+)$/i)
        const meshMatch = objectName.match(/^[Mm]esh[_ ]?(\d+)$/i)
        const num = objectMatch ? parseInt(objectMatch[1], 10) : (meshMatch ? parseInt(meshMatch[1], 10) : null)
        if (num != null && objectNumberMapping[num]) partName = objectNumberMapping[num]
      }
    }

    // Known part name
    if (!partName && entPartDescriptions[objectName]) partName = objectName
    else if (!partName) {
      const lowerName = objectName.toLowerCase()
      for (const key in entPartDescriptions) {
        if (key.toLowerCase() === lowerName) {
          partName = key
          break
        }
      }
    }

    // Pattern matching by anatomy type
    if (!partName) partName = matchByNamePattern(anatomyType, objectName)
  }

  // Parent hierarchy
  if (!partName) partName = matchFromParent(object, anatomyType)

  return partName
}

/** For skeleton: get mesh number (1–20) from object/parent chain. Export so ENTModel can highlight only the clicked bone by number. */
export function getSkeletonMeshNumber(object: THREE.Object3D, modelPath: string): number | null {
  if (getAnatomyTypeFromPath(modelPath) !== 'skeleton') return null
  return getSkeletonMeshNumberFromObject(object)
}

/** Get first non-empty name from object or its parents (for raycast-hit mesh whose name may be on parent) */
function getObjectOrParentName(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  let depth = 0
  while (current && depth < 6) {
    if (current.name && typeof current.name === 'string' && current.name.trim() !== '') {
      return current.name.trim()
    }
    current = current.parent
    depth++
  }
  return null
}

function matchByNamePattern(anatomyType: string, objectName: string): string | null {
  const lowerName = objectName.toLowerCase()
  const name = objectName.toLowerCase()

  if (anatomyType === 'throat') {
    if (/pharynx/.test(lowerName)) return 'Pharynx'
    if (/larynx|voice box|thyroid cartilage|cricoid|arytenoid|corniculate|cuneiform/.test(lowerName)) return 'Larynx'
    if (/epiglottis/.test(lowerName)) return 'Epiglottis'
    if (/trachea|windpipe/.test(lowerName)) return 'Trachea'
    if (/vocal|cord|fold|glottis/.test(lowerName)) return 'Vocal_Cords'
    if (/throat/.test(lowerName)) return 'Pharynx'
  }

  if (anatomyType === 'dental') {
    if (/wisdom|third_molar|third molar|third-molar|(molar.*(3|third|8))/.test(name)) return 'Wisdom_Teeth'
    if (/tooth|teeth|incisor|canine|(premolar(?!.*tongue))|(molar(?!.*tongue|.*third|.*wisdom))|dental(?!.*tongue)|dentition(?!.*tongue)/.test(name) ||
        /tooth[_\s-]?\d+|teeth[_\s-]?\d+|upper[_\s-]?tooth|lower[_\s-]?tooth|^t[_\s-]?\d+|^d[_\s-]?\d+/.test(objectName)) return 'Teeth'
    if (/gum|gingiva|gingival|gums/.test(name)) return 'Gums'
    if (/tongue/.test(name) && !/tooth|teeth/.test(name)) return 'Tongue'
    if (/mandible|mandibular|(jaw(?!upper|tongue))/.test(name)) return 'Mandible'
    if (/palate|palatal|uvula/.test(name)) return 'Palate'
    if (/mucosa|mucous|(lip(?!tongue))|cheek|buccal/.test(name)) return 'Oral_Mucosa'
    if (/salivary|parotid|submandibular|sublingual/.test(name)) return 'Salivary_Glands'
    if (/^\d+$|^tooth\d+|^teeth\d+/i.test(objectName) && !/bone|mesh|object|group|root|scene|default/.test(name)) return 'Teeth'
  }

  if (anatomyType === 'lungs') {
    if (/trachea|windpipe/.test(lowerName)) return 'Trachea'
    if (/bronch|bronchus/.test(lowerName)) return 'Bronchi'
    if (/linkerlong|rechterlong|lung|pulmonary/.test(lowerName)) return 'Lungs'
    if (/heart|cardiac|stomach|normaal4/.test(lowerName)) return 'Heart'
    if (/normaal25/.test(lowerName)) return 'Trachea'
    if (/normaal6/.test(lowerName)) return 'Bronchi'
    if (/normaal5/.test(lowerName)) return 'Lungs'
  }

  if (anatomyType === 'kidney') {
    if (/kidney|(renal(?!pelvis|cortex|medulla))/.test(lowerName)) return 'Kidney'
    if (/pelvis/.test(lowerName)) return 'Renal_Pelvis'
    if (/ureter/.test(lowerName)) return 'Ureter'
    if (/cortex/.test(lowerName)) return 'Cortex'
    if (/medulla/.test(lowerName)) return 'Medulla'
  }

  if (anatomyType === 'nose') {
    if (/nostril|vestibule|hidung|lubang/.test(lowerName)) return 'Nostrils'
    if (/(cavity|nasal)/.test(lowerName) && !/septum|conchae/.test(lowerName)) return 'Nasal_Cavity'
    if (/septum|sekat/.test(lowerName)) return 'Nasal_Septum'
    if (/turbinate|conchae|konka/.test(lowerName)) return 'Turbinates'
    if (/sinus|rongga|nose|nasal|hidung/.test(lowerName)) return lowerName.includes('sinus') || lowerName.includes('rongga') ? 'Sinuses' : 'Nasal_Cavity'
  }

  if (anatomyType === 'ear') {
    if (/outer|pinna|auricle/.test(lowerName)) return 'Outer_Ear'
    if (/canal/.test(lowerName) && /ear/.test(lowerName)) return 'Ear_Canal'
    if (/drum|tympanic|membrane/.test(lowerName)) return 'Eardrum'
    if (/ossicle|malleus|incus|stapes/.test(lowerName)) return 'Ossicles'
    if (/cochlea/.test(lowerName)) return 'Cochlea'
    if (/semicircular|canal/.test(lowerName)) return 'Semicircular_Canals'
    if (/nerve|auditory/.test(lowerName)) return 'Auditory_Nerve'
    if (/ear/.test(lowerName)) return 'Outer_Ear'
  }

  if (anatomyType === 'skeleton') {
    if (/skull|cranium|mandible|jaw|maxilla/.test(lowerName)) return 'Skull'
    if (/spine|vertebra|vertebrae|cervical|thoracic|lumbar|sacrum|coccyx/.test(lowerName)) return 'Spine'
    if (/rib|sternum|ribcage|chest/.test(lowerName)) return lowerName.includes('sternum') ? 'Sternum' : 'Ribcage'
    if (/pelvis|hip|ilium|ischium|pubis/.test(lowerName)) return 'Pelvis'
    if (/humerus|upper arm/.test(lowerName)) return 'Humerus'
    if (/radius/.test(lowerName)) return 'Radius'
    if (/ulna/.test(lowerName)) return 'Ulna'
    if (/femur|thigh/.test(lowerName)) return 'Femur'
    if (/tibia|shin/.test(lowerName)) return 'Tibia'
    if (/fibula/.test(lowerName)) return 'Fibula'
    if (/clavicle|collarbone/.test(lowerName)) return 'Clavicle'
    if (/scapula|shoulder blade/.test(lowerName)) return 'Scapula'
    if (/patella|knee cap/.test(lowerName)) return 'Patella'
  }

  return null
}

function matchFromParent(object: THREE.Object3D, anatomyType: string): string | null {
  let current = object.parent
  let depth = 0
  while (current && depth < 5) {
    if (current.name && current.name.trim() !== '') {
      const parentName = current.name.trim()
      if (anatomyType === 'ear' && objectNameToPartMap[parentName]) return objectNameToPartMap[parentName]
      if (entPartDescriptions[parentName]) return parentName

      const lower = parentName.toLowerCase()
      const m = (pat: RegExp, res: string) => pat.test(lower) ? res : null

      if (anatomyType === 'throat') {
        const r = m(/pharynx/, 'Pharynx') || m(/larynx|voice box/, 'Larynx') || m(/epiglottis/, 'Epiglottis') || m(/trachea|windpipe/, 'Trachea') || m(/vocal|cord/, 'Vocal_Cords')
        if (r) return r
      }
      if (anatomyType === 'dental') {
        const r = m(/wisdom|third_molar|third molar/, 'Wisdom_Teeth') || m(/tooth|teeth|incisor|canine|premolar|molar|dental/, 'Teeth') || m(/gum|gingiva/, 'Gums') || m(/tongue|lingual/, 'Tongue') || m(/mandible|mandibular|jaw/, 'Mandible') || m(/palate|uvula/, 'Palate') || m(/mucosa|lip|cheek|buccal/, 'Oral_Mucosa') || m(/salivary|parotid|submandibular|sublingual/, 'Salivary_Glands')
        if (r) return r
      }
      if (anatomyType === 'nose') {
        const r = m(/nostril|vestibule|hidung/, 'Nostrils') || m(/septum|sekat/, 'Nasal_Septum') || m(/turbinate|conchae/, 'Turbinates') || m(/sinus|rongga/, 'Sinuses') || m(/nasal|cavity|nose/, 'Nasal_Cavity')
        if (r) return r
      }
      if (anatomyType === 'lungs') {
        const r = m(/trachea|windpipe/, 'Trachea') || m(/bronch/, 'Bronchi') || m(/lung|pulmonary/, 'Lungs') || m(/heart|cardiac|stomach/, 'Heart')
        if (r) return r
      }
      if (anatomyType === 'kidney') {
        const r = m(/kidney|renal/, 'Kidney') || m(/pelvis/, 'Renal_Pelvis') || m(/ureter/, 'Ureter') || m(/cortex/, 'Cortex') || m(/medulla/, 'Medulla')
        if (r) return r
      }
      if (anatomyType === 'ear') {
        const r = m(/outer|pinna|auricle/, 'Outer_Ear') || m(/canal.*ear|ear.*canal/, 'Ear_Canal') || m(/drum|tympanic/, 'Eardrum') || m(/ossicle/, 'Ossicles') || m(/cochlea/, 'Cochlea') || m(/semicircular/, 'Semicircular_Canals') || m(/nerve|auditory/, 'Auditory_Nerve')
        if (r) return r
      }
      if (anatomyType === 'skeleton') {
        const skMatch = parentName.match(/^SM_HumanSkeleton[_\-]?(\d+)$/i)
        if (skMatch) {
          const part = getSkeletonPartKeyFromMeshNumber(parseInt(skMatch[1], 10))
          if (part) return part
        }
        const r = m(/skull|cranium|mandible|jaw/, 'Skull') || m(/spine|vertebra|sacrum|coccyx/, 'Spine') || m(/rib|sternum|ribcage/, 'Ribcage') || m(/pelvis|hip|ilium|ischium|pubis/, 'Pelvis') || m(/humerus/, 'Humerus') || m(/radius/, 'Radius') || m(/ulna/, 'Ulna') || m(/femur/, 'Femur') || m(/tibia/, 'Tibia') || m(/fibula/, 'Fibula') || m(/clavicle/, 'Clavicle') || m(/scapula/, 'Scapula') || m(/patella/, 'Patella')
        if (r) return r
      }
    }
    current = current.parent
    depth++
  }
  return null
}
