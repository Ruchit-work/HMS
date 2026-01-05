/**
 * Anatomy Model Mapping Utility
 * Maps doctor specializations to relevant anatomy models
 */

export type AnatomyType = 'ear' | 'throat' | 'dental'

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
    return ['ear', 'throat', 'dental']
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

  // ENT specializations → ear and throat
  if (
    lowerSpecialization.includes('ent') ||
    lowerSpecialization.includes('otorhinolaryngologist') ||
    lowerSpecialization.includes('ear') ||
    lowerSpecialization.includes('nose') ||
    lowerSpecialization.includes('throat')
  ) {
    return ['ear', 'throat']
  }

  // Family Medicine / General Physician → ENT related (ear, throat) as they commonly see these
  if (
    lowerSpecialization.includes('family medicine') ||
    lowerSpecialization.includes('family physician') ||
    lowerSpecialization.includes('general physician') ||
    lowerSpecialization.includes('primary care')
  ) {
    return ['ear', 'throat']
  }

  // Pediatrician → ear, throat (common in children)
  if (lowerSpecialization.includes('pediatrician') || lowerSpecialization.includes('pediatric')) {
    return ['ear', 'throat']
  }

  // Ophthalmologist → none (eye is different system, no models yet)
  if (lowerSpecialization.includes('ophthalmologist') || lowerSpecialization.includes('eye')) {
    return []
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

