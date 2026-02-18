/**
 * ENT (Ear, Nose, Throat) Diagnosis Constants
 * Standard diagnoses for ENT clinic appointments
 */

export interface EntDiagnosis {
  code: string // ICD-10 code (optional, for future use)
  name: string // Diagnosis name
  category: "ear" | "nose" | "throat" | "general"
}

export const ENT_DIAGNOSES: EntDiagnosis[] = [
  // Throat Conditions
  {
    code: "J03.9",
    name: "Acute Tonsillitis",
    category: "throat"
  },
  {
    code: "J35.0",
    name: "Chronic Tonsillitis",
    category: "throat"
  },
  {
    code: "J02.9",
    name: "Pharyngitis",
    category: "throat"
  },
  {
    code: "J04.0",
    name: "Laryngitis",
    category: "throat"
  },
  // Nose Conditions
  {
    code: "J30.4",
    name: "Allergic Rhinitis",
    category: "nose"
  },
  {
    code: "J32.9",
    name: "Sinusitis",
    category: "nose"
  },
  {
    code: "J34.2",
    name: "Deviated Nasal Septum (DNS)",
    category: "nose"
  },
  // Ear Conditions
  {
    code: "H66.9",
    name: "Otitis Media",
    category: "ear"
  },
  {
    code: "H60.9",
    name: "Otitis Externa",
    category: "ear"
  },
  {
    code: "H61.2",
    name: "Impacted Ear Wax",
    category: "ear"
  },
  {
    code: "H69.0",
    name: "Eustachian Tube Dysfunction",
    category: "ear"
  },
  // General/Vestibular
  {
    code: "H81.9",
    name: "Vertigo (ENT related)",
    category: "general"
  }
]

// Helper function to get diagnoses by category
export const getDiagnosesByCategory = (category: EntDiagnosis["category"]): EntDiagnosis[] => {
  return ENT_DIAGNOSES.filter(d => d.category === category)
}

// Helper function to search diagnoses
export const searchDiagnoses = (query: string): EntDiagnosis[] => {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return ENT_DIAGNOSES
  
  return ENT_DIAGNOSES.filter(d => 
    d.name.toLowerCase().includes(normalizedQuery) ||
    d.code.toLowerCase().includes(normalizedQuery)
  )
}

// Custom diagnosis option
export const CUSTOM_DIAGNOSIS_OPTION = "OTHER_CUSTOM"

