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
    id: "fever_cold",
    label: "Fever / Cold / Cough",
    icon: "🤒",
    relatedSpecializations: ["General Physician", "Internal Medicine"],
    color: "from-red-100 to-orange-100 border-red-300"
  },
  {
    id: "chest_breathing",
    label: "Chest Pain / Breathing",
    icon: "❤️",
    relatedSpecializations: ["Cardiology", "Pulmonology", "General Physician"],
    color: "from-red-100 to-pink-100 border-red-300"
  },
  {
    id: "dental",
    label: "Dental Problems",
    icon: "🦷",
    relatedSpecializations: ["Dentistry", "Oral Surgery"],
    color: "from-blue-100 to-cyan-100 border-blue-300"
  },
  {
    id: "stomach_digestive",
    label: "Stomach / Digestive",
    icon: "🍽️",
    relatedSpecializations: ["Gastroenterology", "General Physician"],
    color: "from-green-100 to-emerald-100 border-green-300"
  },
  {
    id: "diabetes",
    label: "Diabetes Management",
    icon: "💉",
    relatedSpecializations: ["Endocrinology", "General Physician", "Internal Medicine"],
    color: "from-purple-100 to-violet-100 border-purple-300"
  },
  {
    id: "bp_heart",
    label: "Blood Pressure / Heart",
    icon: "🩸",
    relatedSpecializations: ["Cardiology", "General Physician"],
    color: "from-red-100 to-rose-100 border-red-300"
  },
  {
    id: "injury_pain",
    label: "Injury / Body Pain",
    icon: "🤕",
    relatedSpecializations: ["Orthopedic Surgery", "Physical Medicine", "General Physician"],
    color: "from-amber-100 to-yellow-100 border-amber-300"
  },
  {
    id: "general_checkup",
    label: "General Health Checkup",
    icon: "🩺",
    relatedSpecializations: ["General Physician", "Internal Medicine"],
    color: "from-teal-100 to-cyan-100 border-teal-300"
  },
  {
    id: "headache",
    label: "Headache / Migraine",
    icon: "🧠",
    relatedSpecializations: ["Neurology", "General Physician"],
    color: "from-indigo-100 to-blue-100 border-indigo-300"
  },
  {
    id: "skin",
    label: "Skin Problems",
    icon: "🧴",
    relatedSpecializations: ["Dermatology"],
    color: "from-pink-100 to-rose-100 border-pink-300"
  },
  {
    id: "eye",
    label: "Eye Problems",
    icon: "👁️",
    relatedSpecializations: ["Ophthalmology"],
    color: "from-sky-100 to-blue-100 border-sky-300"
  },
  {
    id: "joint_bone",
    label: "Joint / Bone Pain",
    icon: "🦴",
    relatedSpecializations: ["Orthopedic Surgery", "Rheumatology"],
    color: "from-stone-100 to-slate-100 border-stone-300"
  },
  {
    id: "known_condition",
    label: "I know my condition",
    icon: "📋",
    relatedSpecializations: ["General Physician"], // Will be updated based on specific condition
    color: "from-violet-100 to-purple-100 border-violet-300"
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

