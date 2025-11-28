"use client"

import { useState, useEffect } from "react"
import { QuestionRenderer } from "./QuestionRenderer"
import { QUESTIONS_CONFIG, QuestionsConfig } from "@/constants/questions"

interface SmartQuestionsProps {
  category: string
  onComplete: (data: Record<string, unknown>) => void
}

export default function SmartQuestions({ category, onComplete }: SmartQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean | number>>({})
  
  // Move hooks to top level to avoid conditional hook calls
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Reset state when category changes
  useEffect(() => {
    setSearchTerm('')
    setSelectedCategory(null)
    setAnswers({})
  }, [category])

  const updateAnswer = (key: string, value: string | string[] | boolean | number) => {
    const updated = { ...answers, [key]: value }
    setAnswers(updated)
    onComplete(updated as Record<string, unknown>)
  }

  const toggleSymptom = (key: string, symptom: string) => {
    const current = (answers[key] as string[]) || []
    const noneLabel = 'None / I don\'t know'
    let next: string[] = []

    if (symptom === noneLabel || symptom === 'None' || symptom === 'None Yet') {
      // Selecting "None" clears all others and selects only this
      next = [symptom]
    } else {
      // Selecting any concrete option removes the "None" tag
      const base = current.filter((s: string) => s !== noneLabel && s !== 'None' && s !== 'None Yet')
      next = base.includes(symptom)
        ? base.filter((s: string) => s !== symptom)
        : [...base, symptom]
    }

    updateAnswer(key, next)
  }

  // Render questions from config
  const renderQuestionsFromConfig = () => {
    if (!QUESTIONS_CONFIG || !QUESTIONS_CONFIG[category]) {
      return renderFallbackQuestions()
    }

    const categoryConfig = QUESTIONS_CONFIG[category]
    if (!categoryConfig.questions || categoryConfig.questions.length === 0) {
      return renderFallbackQuestions()
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        {categoryConfig.questions.map((question, index) => (
          <QuestionRenderer
            key={question.key || index}
            question={question}
            value={answers[question.key]}
            onChange={updateAnswer}
            onToggleMulti={toggleSymptom}
          />
        ))}
      </div>
    )
  }

  // Fallback for categories not in JSON or special cases
  const renderFallbackQuestions = () => {
    // Special case: known_condition - keep the complex logic
    if (category === "known_condition") {
      return renderKnownConditionQuestions()
    }

    // Default fallback for unknown categories
    return (
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Describe your concern:
        </label>
        <textarea
          value={(answers.description as string) || ''}
          onChange={(e) => updateAnswer('description', e.target.value)}
          rows={2}
          placeholder="Brief description..."
          className="w-full px-3 py-2 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
    )
  }

  // Known condition category - complex nested selection (keep as-is for now)
  const renderKnownConditionQuestions = () => {
    const conditionCategories = [
      {
        icon: "🩺",
        name: "General & Primary Care",
        conditions: ["General Health Concern", "Annual Checkup", "Preventive Care"]
      },
      {
        icon: "❤️",
        name: "Heart & Circulatory",
        conditions: ["Heart Disease", "High Blood Pressure", "Chest Pain", "Arrhythmia", "Heart Attack", "Varicose Veins", "Deep Vein Thrombosis"]
      },
      {
        icon: "🧠",
        name: "Brain & Mental Health",
        conditions: ["Stroke", "Epilepsy", "Parkinson's Disease", "Alzheimer's", "Multiple Sclerosis", "Migraine", "Neuropathy", "Depression", "Anxiety", "Bipolar Disorder", "Schizophrenia", "PTSD", "OCD"]
      },
      {
        icon: "🫁",
        name: "Lungs & Respiratory",
        conditions: ["Asthma", "COPD", "Chronic Bronchitis", "Pneumonia", "Tuberculosis", "Sleep Apnea", "Pulmonary Fibrosis"]
      },
      {
        icon: "🍽️",
        name: "Digestive System",
        conditions: ["GERD (Acid Reflux)", "IBS", "Crohn's Disease", "Ulcerative Colitis", "Gastritis", "Fatty Liver", "Hepatitis", "Cirrhosis", "Gallstones", "Pancreatitis"]
      },
      {
        icon: "💉",
        name: "Hormones & Metabolism",
        conditions: ["Diabetes Type 1", "Diabetes Type 2", "Prediabetes", "Hyperthyroidism", "Hypothyroidism", "Thyroid Nodules", "PCOS", "Obesity", "Metabolic Syndrome"]
      },
      {
        icon: "🩸",
        name: "Blood & Cancer",
        conditions: ["Anemia", "Leukemia", "Lymphoma", "Hemophilia", "Sickle Cell", "Breast Cancer", "Lung Cancer", "Colon Cancer", "Prostate Cancer", "Skin Cancer"]
      },
      {
        icon: "🦴",
        name: "Bones & Muscles",
        conditions: ["Osteoarthritis", "Rheumatoid Arthritis", "Osteoporosis", "Chronic Back Pain", "Sciatica", "Fibromyalgia", "Gout", "Fracture", "Sports Injury", "Carpal Tunnel"]
      },
      {
        icon: "🧬",
        name: "Infections & Immunity",
        conditions: ["HIV/AIDS", "COVID-19", "Dengue", "Malaria", "Typhoid", "UTI", "Seasonal Allergies", "Food Allergies", "Lupus"]
      },
      {
        icon: "👁️",
        name: "Eye, Ear, Nose & Throat",
        conditions: ["Cataracts", "Glaucoma", "Macular Degeneration", "Dry Eyes", "Sinusitis", "Tonsillitis", "Hearing Loss", "Vertigo", "Tinnitus"]
      },
      {
        icon: "🧴",
        name: "Skin, Hair & Nails",
        conditions: ["Eczema", "Psoriasis", "Acne", "Rosacea", "Hair Loss", "Fungal Infection", "Vitiligo"]
      },
      {
        icon: "🤰",
        name: "Women & Children",
        conditions: ["Pregnancy Care", "Miscarriage", "Menopause", "Endometriosis", "Fibroids", "Infertility", "Child Fever", "Child Asthma", "Development Delay", "Autism"]
      },
      {
        icon: "🧍",
        name: "Urinary & Reproductive",
        conditions: ["Kidney Stones", "Chronic Kidney Disease", "Kidney Failure", "Enlarged Prostate", "Erectile Dysfunction", "Male Infertility", "Urinary Incontinence"]
      },
      {
        icon: "🦷",
        name: "Dental & Oral",
        conditions: ["Tooth Decay", "Gum Disease", "Wisdom Teeth", "Root Canal", "Dental Implant"]
      },
      {
        icon: "🧑‍⚕️",
        name: "Other Conditions",
        conditions: ["Chronic Fatigue", "Chronic Pain", "Autoimmune Disease", "Post-Surgery Follow-up", "Other"]
      }
    ]
    
    const filteredCategories = searchTerm
      ? conditionCategories.map(cat => ({
          ...cat,
          conditions: cat.conditions.filter(c => 
            c.toLowerCase().includes(searchTerm.toLowerCase())
          )
        })).filter(cat => cat.conditions.length > 0)
      : selectedCategory
        ? conditionCategories.filter(cat => cat.name === selectedCategory)
        : conditionCategories

    return (
      <div className="space-y-3">
        {/* Selected Condition Display */}
        {answers.condition && typeof answers.condition === 'string' && answers.condition !== 'Other' && (
          <div className="bg-violet-50 border-2 border-violet-300 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span className="text-sm font-semibold text-violet-800">{answers.condition as string}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateAnswer('condition', '')
                  setSelectedCategory(null)
                  setSearchTerm('')
                }}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Category Selection */}
        {!answers.condition && !selectedCategory && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Step 1: Select health category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {conditionCategories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className="p-3 rounded-lg border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-center bg-white"
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <p className="text-xs font-medium text-slate-800 leading-tight">{cat.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Condition Selection */}
        {!answers.condition && selectedCategory && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-700">
                Step 2: Select your condition <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null)
                  setSearchTerm('')
                }}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
              >
                ← Back to categories
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to search conditions..."
                  className="w-full pl-10 pr-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>
            </div>

            {/* Condition Grid */}
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {filteredCategories.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">No conditions found</p>
              ) : (
                <div className="space-y-3">
                  {filteredCategories.map((category) => (
                    <div key={category.name}>
                      <div className="flex items-center gap-2 mb-2 px-2">
                        <span className="text-lg">{category.icon}</span>
                        <p className="text-xs font-bold text-slate-700">{category.name}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {category.conditions.map((condition) => (
                          <button
                            key={condition}
                            type="button"
                            onClick={() => {
                              updateAnswer('condition', condition)
                              setSearchTerm('')
                            }}
                            className="text-left px-3 py-2 bg-white border-2 border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-all text-xs font-medium text-slate-700"
                          >
                            {condition}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom condition input */}
        {answers.condition === 'Other' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Please specify your condition:
            </label>
            <input
              type="text"
              value={(answers.customCondition as string) || ''}
              onChange={(e) => updateAnswer('customCondition', e.target.value)}
              placeholder="Enter your condition"
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
          </div>
        )}
        
        {/* Duration */}
        {answers.condition && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              How long have you had this condition?
            </label>
            <select
              value={(answers.duration as string) || ''}
              onChange={(e) => updateAnswer('duration', e.target.value)}
              className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select...</option>
              <option value="newly-diagnosed">Newly diagnosed</option>
              <option value="less-6-months">Less than 6 months</option>
              <option value="6-months-1-year">6 months - 1 year</option>
              <option value="1-2-years">1-2 years</option>
              <option value="2-5-years">2-5 years</option>
              <option value="more-5-years">More than 5 years</option>
            </select>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
        <span className="text-lg">📋</span>
        <span>Tell us more</span>
      </h3>
      
      {renderQuestionsFromConfig()}
    </div>
  )
}
