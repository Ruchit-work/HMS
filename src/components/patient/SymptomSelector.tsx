/**
 * SymptomSelector Component
 * Helps patients select their health concern category
 * Design: Visual cards instead of text input
 */

"use client"

import { useEffect, useMemo, useState } from "react"

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
  const [search, setSearch] = useState("")
  const [remoteCategories, setRemoteCategories] = useState<SymptomCategory[] | null>(null)
  const [remoteSynonyms, setRemoteSynonyms] = useState<Record<string, string> | null>(null)

  // Default synonym map (English/Hinglish/Hindi) → category id
  const DEFAULT_SYNONYMS: Record<string, string> = useMemo(() => ({
    fever: "monsoon_diseases",
    bukhar: "monsoon_diseases",
    khansi: "respiratory_asthma", // cough
    cough: "respiratory_asthma",
    saans: "respiratory_asthma",  // breath
    breathing: "respiratory_asthma",
    chest: "cardiac_issues",
    bp: "cardiac_issues",
    sugar: "diabetes_complications",
    diabetes: "diabetes_complications",
    thyroid: "thyroid_problems",
    dard: "joint_arthritis",      // pain
    joint: "joint_arthritis",
    pet: "gastrointestinal",      // stomach
    stomach: "gastrointestinal",
    rash: "skin_allergies",
    skin: "skin_allergies",
    uti: "kidney_uti",
    kidney: "kidney_uti",
    eye: "eye_problems",
    checkup: "general_checkup",
    routine: "general_checkup"
  }), [])

  // Try loading JSON-driven config; fallback to built-in
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/symptoms.json", { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        if (Array.isArray(json?.categories)) setRemoteCategories(json.categories)
        if (json?.synonyms && typeof json.synonyms === 'object') setRemoteSynonyms(json.synonyms)
      } catch (_) { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const categories = remoteCategories ?? SYMPTOM_CATEGORIES
    const synonyms = remoteSynonyms ?? DEFAULT_SYNONYMS
    if (!term) return categories

    const synonymHit = synonyms[term]
    const base = categories.filter(c =>
      c.label.toLowerCase().includes(term) || (synonymHit && c.id === synonymHit)
    )
    // If only synonym matched, ensure that item appears first
    return base.sort((a, b) => (a.id === synonymHit ? -1 : b.id === synonymHit ? 1 : 0))
  }, [search, remoteCategories, remoteSynonyms, DEFAULT_SYNONYMS])

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-2">
        What brings you here? <span className="text-red-500">*</span>
      </h3>

      {/* Quick search (supports English/Hinglish/Hindi phrases) */}
      <div className="mb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔎</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search (e.g., fever / bukhar / khansi / stomach pain)"
            className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {filtered.map((category) => (
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

        {/* Not sure path → general_checkup */}
        <button
          type="button"
          onClick={() => onSelect("general_checkup")}
          className="p-2 sm:p-3 rounded-lg border-2 transition-all text-center bg-white border-slate-200 hover:border-teal-300"
        >
          <div className="text-lg sm:text-xl mb-1">❓</div>
          <p className="text-xs sm:text-sm font-medium text-slate-800 leading-tight">
            I’m not sure
          </p>
        </button>
      </div>
    </div>
  )
}

