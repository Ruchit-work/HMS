/**
 * Anatomy Model Mapping Utility
 * Maps doctor specializations to relevant anatomy models
 */

export type AnatomyType = 'ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney' | 'skeleton' | 'lymph_nodes'

export interface AnatomyModel {
  type: AnatomyType
  label: string
  icon: string
  description: string
}

export const ALL_ANATOMY_MODELS: AnatomyModel[] = [
  {
    type: 'ear',
    label: 'Ear',
    icon: '👂',
    description: 'Ear anatomy and related conditions'
  },
  {
    type: 'nose',
    label: 'Nose',
    icon: '👃',
    description: 'Nose anatomy and related conditions'
  },
  {
    type: 'throat',
    label: 'Throat',
    icon: '👄',
    description: 'Throat anatomy and related conditions'
  },
  {
    type: 'dental',
    label: 'Dental & Oral',
    icon: '🦷',
    description: 'Dental and oral anatomy'
  },
  {
    type: 'lungs',
    label: 'Lungs & Heart',
    icon: '🫁',
    description: 'Lungs and heart anatomy'
  },
  {
    type: 'kidney',
    label: 'Kidney',
    icon: '🫘',
    description: 'Kidney anatomy and urinary system'
  },
  {
    type: 'skeleton',
    label: 'Skeleton',
    icon: '🦴',
    description: 'Bones and musculoskeletal anatomy'
  },
  {
    type: 'lymph_nodes',
    label: 'Lymph Nodes',
    icon: '🧬',
    description: 'Lymph nodes anatomy and related conditions'
  }
]

/**
 * Maps doctor specialization to relevant anatomy models
 * @param specialization - Doctor's specialization string
 * @returns Array of relevant anatomy model types
 */
export function getAnatomyModelsForSpecialization(specialization: string | null | undefined): AnatomyType[] {
  if (!specialization) {
    // If no specialization, show all models (for flexibility)
    return ['ear', 'nose', 'throat', 'dental', 'lungs', 'kidney', 'skeleton', 'lymph_nodes']
  }

  const lowerSpecialization = specialization.toLowerCase()

  // Dental specializations → only dental
  if (
    lowerSpecialization.includes('dentist') ||
    lowerSpecialization.includes('dental') ||
    lowerSpecialization.includes('oral surgeon') ||
    lowerSpecialization.includes('oral surgery')
  ) {
    return ['dental']
  }

  // ENT specializations → ear, nose, and throat
  if (
    lowerSpecialization.includes('ent') ||
    lowerSpecialization.includes('otorhinolaryngologist') ||
    lowerSpecialization.includes('ear') ||
    lowerSpecialization.includes('nose') ||
    lowerSpecialization.includes('throat')
  ) {
    return ['ear', 'nose', 'throat']
  }

  // Nephrologist / Urology → kidney
  if (
    lowerSpecialization.includes('nephrologist') ||
    lowerSpecialization.includes('nephrology') ||
    lowerSpecialization.includes('urologist') ||
    lowerSpecialization.includes('urology')
  ) {
    return ['kidney']
  }

  // Pulmonologist / Respiratory → lungs
  if (
    lowerSpecialization.includes('pulmonologist') ||
    lowerSpecialization.includes('pulmonology') ||
    lowerSpecialization.includes('respiratory')
  ) {
    return ['lungs']
  }

  // Cardiologist → lungs (heart)
  if (lowerSpecialization.includes('cardiologist') || lowerSpecialization.includes('cardiology')) {
    return ['lungs']
  }

  // Orthopedics / Rheumatology / Physiotherapy → skeleton
  if (
    lowerSpecialization.includes('orthoped') ||
    lowerSpecialization.includes('orthopaedic') ||
    lowerSpecialization.includes('rheumatolog') ||
    lowerSpecialization.includes('physiotherap') ||
    lowerSpecialization.includes('sports medicine') ||
    lowerSpecialization.includes('bone') ||
    lowerSpecialization.includes('skeleton')
  ) {
    return ['skeleton']
  }

  // Family Medicine / General Physician → ENT, lungs, kidney, skeleton
  if (
    lowerSpecialization.includes('family medicine') ||
    lowerSpecialization.includes('family physician') ||
    lowerSpecialization.includes('general physician') ||
    lowerSpecialization.includes('primary care')
  ) {
    return ['ear', 'nose', 'throat', 'lungs', 'kidney', 'skeleton']
  }

  // Pediatrician → ear, nose, throat, lungs, kidney, skeleton (common in children)
  if (lowerSpecialization.includes('pediatrician') || lowerSpecialization.includes('pediatric')) {
    return ['ear', 'nose', 'throat', 'lungs', 'kidney', 'skeleton']
  }

  // Ophthalmologist → none (eye is different system, no models yet)
  if (lowerSpecialization.includes('ophthalmologist') || lowerSpecialization.includes('eye')) {
    return []
  }

  // Oncology / Immunology / Hematology → lymph nodes
  if (
    lowerSpecialization.includes('oncolog') ||
    lowerSpecialization.includes('immunolog') ||
    lowerSpecialization.includes('hematolog') ||
    lowerSpecialization.includes('haematolog') ||
    lowerSpecialization.includes('lymph')
  ) {
    return ['lymph_nodes']
  }

  // For other specializations, return empty array (no relevant models)
  // This can be expanded as more anatomy models are added
  return []
}

/**
 * Get anatomy model details for a given type
 */
export function getAnatomyModelDetails(type: AnatomyType): AnatomyModel | undefined {
  return ALL_ANATOMY_MODELS.find(model => model.type === type)
}

/**
 * Get all available anatomy models filtered by specialization
 */
export function getAvailableAnatomyModels(specialization: string | null | undefined): AnatomyModel[] {
  const relevantTypes = getAnatomyModelsForSpecialization(specialization)
  return ALL_ANATOMY_MODELS.filter(model => relevantTypes.includes(model.type))
}

