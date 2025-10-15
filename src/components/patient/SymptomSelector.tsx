/**
 * SymptomSelector Component
 * Helps patients select their health concern category
 * Design: Visual cards instead of text input
 */

"use client"

export interface SymptomCategory {
  id: string
  label: string
  icon: string
  relatedSpecializations: string[]
  color: string
}

interface SymptomSelectorProps {
  selectedCategory: string | null
  onSelect: (categoryId: string) => void
}

export const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  {
    id: "monsoon_diseases",
    label: "Monsoon Diseases (Dengue/Malaria/Chikungunya)",
    icon: "🦟",
    relatedSpecializations: ["General Physician", "Internal Medicine", "Infectious Disease"],
    color: "from-red-100 to-orange-100 border-red-300"
  },
  {
    id: "diabetes_complications",
    label: "Diabetes & Complications",
    icon: "💉",
    relatedSpecializations: ["Endocrinology", "General Physician", "Internal Medicine"],
    color: "from-purple-100 to-violet-100 border-purple-300"
  },
  {
    id: "cardiac_issues",
    label: "Heart Disease & Hypertension",
    icon: "❤️",
    relatedSpecializations: ["Cardiology", "General Physician"],
    color: "from-red-100 to-rose-100 border-red-300"
  },
  {
    id: "thyroid_problems",
    label: "Thyroid Disorders",
    icon: "🦋",
    relatedSpecializations: ["Endocrinology", "General Physician"],
    color: "from-teal-100 to-cyan-100 border-teal-300"
  },
  {
    id: "anemia_vitamin_d",
    label: "Anemia & Vitamin Deficiencies",
    icon: "🩹",
    relatedSpecializations: ["General Physician", "Internal Medicine", "Hematology"],
    color: "from-amber-100 to-yellow-100 border-amber-300"
  },
  {
    id: "gastrointestinal",
    label: "Stomach & Digestive Issues",
    icon: "🍽️",
    relatedSpecializations: ["Gastroenterology", "General Physician"],
    color: "from-green-100 to-emerald-100 border-green-300"
  },
  {
    id: "respiratory_asthma",
    label: "Breathing Problems & Asthma",
    icon: "🫁",
    relatedSpecializations: ["Pulmonology", "General Physician"],
    color: "from-blue-100 to-cyan-100 border-blue-300"
  },
  {
    id: "joint_arthritis",
    label: "Joint Pain & Arthritis",
    icon: "🦴",
    relatedSpecializations: ["Orthopedic Surgery", "Rheumatology"],
    color: "from-stone-100 to-slate-100 border-stone-300"
  },
  {
    id: "kidney_uti",
    label: "Kidney & UTI Problems",
    icon: "🫘",
    relatedSpecializations: ["Nephrology", "Urology", "General Physician"],
    color: "from-green-100 to-teal-100 border-green-300"
  },
  {
    id: "women_reproductive",
    label: "Women's Health & PCOS",
    icon: "👩",
    relatedSpecializations: ["Gynecology", "Endocrinology"],
    color: "from-pink-100 to-purple-100 border-pink-300"
  },
  {
    id: "skin_allergies",
    label: "Skin Problems & Allergies",
    icon: "🧴",
    relatedSpecializations: ["Dermatology", "Allergy Specialist"],
    color: "from-pink-100 to-rose-100 border-pink-300"
  },
  {
    id: "eye_problems",
    label: "Eye & Vision Issues",
    icon: "👁️",
    relatedSpecializations: ["Ophthalmology"],
    color: "from-sky-100 to-blue-100 border-sky-300"
  },
  {
    id: "mental_health",
    label: "Mental Health & Depression",
    icon: "🧘",
    relatedSpecializations: ["Psychiatry", "Psychology"],
    color: "from-violet-100 to-purple-100 border-violet-300"
  },
  {
    id: "child_health",
    label: "Child Health & Development",
    icon: "👶",
    relatedSpecializations: ["Pediatrics", "Child Development"],
    color: "from-yellow-100 to-orange-100 border-yellow-300"
  },
  {
    id: "elderly_care",
    label: "Senior Health & Care",
    icon: "👴",
    relatedSpecializations: ["Geriatrics", "General Physician"],
    color: "from-gray-100 to-slate-100 border-gray-300"
  },
  {
    id: "general_checkup",
    label: "General Health Checkup",
    icon: "🩺",
    relatedSpecializations: ["General Physician", "Internal Medicine"],
    color: "from-teal-100 to-cyan-100 border-teal-300"
  }
]

export default function SymptomSelector({ selectedCategory, onSelect }: SymptomSelectorProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-2">
        What brings you here? <span className="text-red-500">*</span>
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {SYMPTOM_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`
              p-2 sm:p-3 rounded-lg border-2 transition-all text-center
              ${selectedCategory === category.id
                ? `bg-gradient-to-br ${category.color} shadow-md ring-2 ring-teal-400`
                : 'bg-white border-slate-200 hover:border-teal-300'
              }
            `}
          >
            <div className="text-lg sm:text-xl mb-1">{category.icon}</div>
            <p className="text-xs sm:text-sm font-medium text-slate-800 leading-tight">
              {category.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

