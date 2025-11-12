/**
 * Health Awareness Days Database
 * This file contains information about health awareness days throughout the year
 * Used for auto-generating advertisements
 */

export interface HealthAwarenessDay {
  name: string
  date: string // Format: "MM-DD" (e.g., "09-29" for September 29)
  description: string
  keywords: string[]
  targetAudience: 'all' | 'patients' | 'doctors'
  priority: number // Higher number = more important
  specialization?: string[] // Related medical specializations
}

export const HEALTH_AWARENESS_DAYS: HealthAwarenessDay[] = [
  // January
  {
    name: "World Leprosy Day",
    date: "01-30",
    description: "Raise awareness about leprosy and its treatment",
    keywords: ["leprosy", "skin", "treatment", "awareness"],
    targetAudience: "all",
    priority: 3,
    specialization: ["Dermatology", "General Physician"],
  },
  
  // February
  {
    name: "World Cancer Day",
    date: "02-04",
    description: "Global awareness day to fight cancer",
    keywords: ["cancer", "oncology", "screening", "prevention", "treatment"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Oncology", "General Physician"],
  },
  {
    name: "International Day of Zero Tolerance for Female Genital Mutilation",
    date: "02-06",
    description: "Awareness about women's health and reproductive rights",
    keywords: ["women", "reproductive", "health", "gynecology"],
    targetAudience: "patients",
    priority: 4,
    specialization: ["Gynecology"],
  },
  
  // March
  {
    name: "World Kidney Day",
    date: "03-14",
    description: "Raise awareness about kidney health and diseases",
    keywords: ["kidney", "renal", "dialysis", "uti", "nephrology"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Nephrology", "Urology", "General Physician"],
  },
  {
    name: "World Tuberculosis Day",
    date: "03-24",
    description: "Awareness about TB prevention and treatment",
    keywords: ["tuberculosis", "tb", "lungs", "respiratory", "infection"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Pulmonology", "Infectious Disease", "General Physician"],
  },
  {
    name: "World Oral Health Day",
    date: "03-20",
    description: "Promote oral hygiene and dental health",
    keywords: ["dental", "oral", "teeth", "hygiene", "dentistry"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Dentistry"],
  },
  
  // April
  {
    name: "World Health Day",
    date: "04-07",
    description: "Global health awareness and universal health coverage",
    keywords: ["health", "wellness", "prevention", "checkup", "general"],
    targetAudience: "all",
    priority: 5,
    specialization: ["General Physician", "Internal Medicine"],
  },
  {
    name: "World Malaria Day",
    date: "04-25",
    description: "Malaria prevention and treatment awareness",
    keywords: ["malaria", "mosquito", "fever", "infection", "prevention"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Infectious Disease", "General Physician"],
  },
  
  // May
  {
    name: "World Asthma Day",
    date: "05-07",
    description: "Asthma awareness and respiratory health",
    keywords: ["asthma", "breathing", "respiratory", "lungs", "inhaler"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Pulmonology", "General Physician"],
  },
  {
    name: "World Hypertension Day",
    date: "05-17",
    description: "Raise awareness about high blood pressure",
    keywords: ["hypertension", "bp", "blood pressure", "heart", "cardiac"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Cardiology", "General Physician", "Internal Medicine"],
  },
  {
    name: "World Thyroid Day",
    date: "05-25",
    description: "Thyroid health awareness and disorders",
    keywords: ["thyroid", "hormones", "endocrinology", "metabolism"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Endocrinology", "General Physician"],
  },
  
  // June
  {
    name: "World Blood Donor Day",
    date: "06-14",
    description: "Encourage blood donation and awareness",
    keywords: ["blood", "donation", "hematology", "transfusion"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Hematology", "General Physician"],
  },
  
  // July
  {
    name: "World Hepatitis Day",
    date: "07-28",
    description: "Hepatitis prevention and treatment awareness",
    keywords: ["hepatitis", "liver", "jaundice", "vaccination"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Gastroenterology", "Infectious Disease", "General Physician"],
  },
  
  // August
  {
    name: "World Breastfeeding Week",
    date: "08-01",
    description: "Promote breastfeeding and infant health",
    keywords: ["breastfeeding", "infant", "child", "nutrition", "pediatrics"],
    targetAudience: "patients",
    priority: 4,
    specialization: ["Pediatrics", "Gynecology"],
  },
  
  // September
  {
    name: "World Heart Day",
    date: "09-29",
    description: "Global heart health awareness and cardiovascular care",
    keywords: ["heart", "cardiac", "cardiovascular", "bp", "hypertension", "cholesterol", "heart attack"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Cardiology", "General Physician"],
  },
  {
    name: "World Alzheimer's Day",
    date: "09-21",
    description: "Alzheimer's and dementia awareness",
    keywords: ["alzheimer", "dementia", "memory", "elderly", "neurology"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Neurology", "Geriatrics", "General Physician"],
  },
  
  // October
  {
    name: "World Mental Health Day",
    date: "10-10",
    description: "Mental health awareness and support",
    keywords: ["mental health", "depression", "anxiety", "psychology", "psychiatry"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Psychiatry", "Psychology"],
  },
  {
    name: "World Stroke Day",
    date: "10-29",
    description: "Stroke prevention and awareness",
    keywords: ["stroke", "brain", "neurology", "cardiovascular", "paralysis"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Neurology", "Cardiology", "General Physician"],
  },
  
  // November
  {
    name: "World Diabetes Day",
    date: "11-14",
    description: "Diabetes awareness, prevention, and management",
    keywords: ["diabetes", "sugar", "blood glucose", "insulin", "endocrinology"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Endocrinology", "General Physician", "Internal Medicine"],
  },
  {
    name: "World Pneumonia Day",
    date: "11-12",
    description: "Pneumonia prevention and treatment",
    keywords: ["pneumonia", "lungs", "respiratory", "infection", "vaccination"],
    targetAudience: "all",
    priority: 4,
    specialization: ["Pulmonology", "Pediatrics", "General Physician"],
  },
  
  // December
  {
    name: "World AIDS Day",
    date: "12-01",
    description: "HIV/AIDS awareness and prevention",
    keywords: ["hiv", "aids", "std", "infection", "prevention"],
    targetAudience: "all",
    priority: 5,
    specialization: ["Infectious Disease", "General Physician"],
  },
]

/**
 * Get health awareness days for a specific date
 * @param date - Date to check (defaults to today in IST)
 * @returns Array of health awareness days for that date
 */
export function getHealthAwarenessDaysForDate(date: Date = new Date()): HealthAwarenessDay[] {
  // Convert to IST (Asia/Kolkata) timezone
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000 // IST offset in milliseconds
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000) // Convert to UTC
  const istTime = new Date(utcTime + istOffset) // Convert to IST
  
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istTime.getUTCDate()).padStart(2, '0')
  const dateString = `${month}-${day}`
  
  return HEALTH_AWARENESS_DAYS.filter(day => day.date === dateString)
}

/**
 * Get health awareness days for tomorrow
 * @returns Array of health awareness days for tomorrow
 */
export function getHealthAwarenessDaysForTomorrow(): HealthAwarenessDay[] {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return getHealthAwarenessDaysForDate(tomorrow)
}

/**
 * Get health awareness days for today
 * @returns Array of health awareness days for today
 */
export function getHealthAwarenessDaysForToday(): HealthAwarenessDay[] {
  return getHealthAwarenessDaysForDate(new Date())
}

