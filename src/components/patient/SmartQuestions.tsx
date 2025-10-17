"use client"

import { useState, useEffect } from "react"

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
  }, [category])

  const updateAnswer = (key: string, value: string | string[] | boolean | number) => {
    const updated = { ...answers, [key]: value }
    setAnswers(updated)
    onComplete(updated as Record<string, unknown>)
  }

  const toggleSymptom = (symptom: string) => {
    const current = (answers.symptoms as string[]) || []
    const noneLabel = 'None / I don\'t know'
    let next: string[] = []

    if (symptom === noneLabel) {
      // Selecting "None / I don't know" clears all others and selects only this
      next = [noneLabel]
    } else {
      // Selecting any concrete symptom removes the "None / I don't know" tag
      const base = current.filter((s: string) => s !== noneLabel)
      next = base.includes(symptom)
        ? base.filter((s: string) => s !== symptom)
        : [...base, symptom]
    }

    updateAnswer('symptoms', next)
  }

  // Render questions based on category
  const renderQuestions = () => {
    switch (category) {
      case "monsoon_diseases":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Do you have high fever?
              </label>
              <div className="flex gap-2">
                {['Yes (>100°F)', 'No', 'I don\'t know'].map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateAnswer('hasFever', option)}
                    className={`flex-1 py-1.5 px-3 rounded-lg border-2 font-medium text-xs transition-all ${
                      answers.hasFever === option
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                How many days?
              </label>
              <select
                value={(answers.duration as string) || ''}
                onChange={(e) => updateAnswer('duration', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select...</option>
                <option value="today">Started today</option>
                <option value="1-2">1-2 days</option>
                <option value="3-5">3-5 days</option>
                <option value="week+">More than a week</option>
                <option value="unknown">I don't know</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Main associated symptom (optional):
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['Body Pain', 'Headache', 'Rash', 'Joint Pain', 'Nausea', 'None / I don\'t know'].map(symptom => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(symptom)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(symptom) ? '✓ ' : ''}{symptom}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case "chest_breathing":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pain severity?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Mild', 'Moderate', 'Severe'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => updateAnswer('severity', level)}
                    className={`py-1.5 px-3 rounded-lg border-2 font-medium text-xs transition-all ${
                      answers.severity === level
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                When?
              </label>
              <select
                value={(answers.duration as string) || ''}
                onChange={(e) => updateAnswer('duration', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select...</option>
                <option value="today">Today</option>
                <option value="this-week">This week</option>
                <option value="earlier">Earlier</option>
                <option value="unknown">I don't know</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Main associated symptom (optional):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {['Shortness of Breath', 'Sweating', 'Nausea', 'Dizziness', 'None / I don\'t know'].map(symptom => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(symptom)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(symptom) ? '✓ ' : ''}{symptom}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case "diabetes_complications":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Visit type? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['Regular Checkup', 'New Complications'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateAnswer('visitType', type)}
                    className={`py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all ${
                      answers.visitType === type
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-purple-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Any complications?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Diabetic Foot', 'Eye Problems', 'Kidney Issues', 'Nerve Pain', 'Heart Problems', 'None'].map(complication => (
                  <button
                    key={complication}
                    type="button"
                    onClick={() => toggleSymptom(complication)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(complication)
                        ? 'bg-purple-100 border-purple-400 text-purple-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(complication) ? '✓ ' : ''}{complication}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current medications:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Metformin', 'Insulin', 'Glimepiride', 'Other'].map(med => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => toggleSymptom(med)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(med)
                        ? 'bg-purple-100 border-purple-400 text-purple-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(med) ? '✓ ' : ''}{med}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Last HbA1c reading (if known):
              </label>
              <input
                type="text"
                value={(answers.hba1c as string) || ''}
                onChange={(e) => updateAnswer('hba1c', e.target.value)}
                placeholder="e.g., 7.5% or last 3 months average"
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )

      case "general_checkup":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason for checkup? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['Routine Health Checkup', 'Feeling Unwell', 'Follow-up Visit', 'Preventive Care'].map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => updateAnswer('reason', reason)}
                    className={`py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                      answers.reason === reason
                        ? 'bg-teal-500 text-white border-teal-500'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-teal-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Any specific concerns?
              </label>
              <textarea
                value={(answers.concerns as string) || ''}
                onChange={(e) => updateAnswer('concerns', e.target.value)}
                rows={3}
                placeholder="Optional: Describe any specific health concerns..."
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          </div>
        )

      case "cardiac_issues":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                What's the main concern?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Chest Pain', 'Breathing Difficulty', 'High BP', 'Heart Palpitations', 'Swelling', 'Family History'].map(issue => (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => toggleSymptom(issue)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(issue)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(issue) ? '✓ ' : ''}{issue}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current BP reading (if known):
              </label>
              <input
                type="text"
                value={(answers.bpReading as string) || ''}
                onChange={(e) => updateAnswer('bpReading', e.target.value)}
                placeholder="e.g., 140/90 mmHg"
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Current heart medications:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['ACE Inhibitors', 'Beta Blockers', 'Diuretics', 'Statins', 'Aspirin', 'None'].map(med => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => toggleSymptom(med)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(med)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(med) ? '✓ ' : ''}{med}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case "stomach_digestive":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                मुख्य समस्या: (Main problem:)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['पेट दर्द (Stomach Pain)', 'उल्टी/मतली (Nausea/Vomiting)', 'दस्त (Diarrhea)', 'कब्ज (Constipation)', 'एसिडिटी (Acidity)', 'गैस/सूजन (Bloating)'].map(issue => (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => toggleSymptom(issue)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      ((answers.symptoms as string[]) || []).includes(issue)
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-green-300'
                    }`}
                  >
                    {((answers.symptoms as string[]) || []).includes(issue) ? '✓ ' : ''}{issue}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                कितने दिन से? (How long?)
              </label>
              <select
                value={(answers.duration as string) || ''}
                onChange={(e) => updateAnswer('duration', e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">चुनें... (Select...)</option>
                <option value="today">आज शुरू हुआ (Started today)</option>
                <option value="few-days">कुछ दिनों से (Few days)</option>
                <option value="week-plus">एक सप्ताह से ज्यादा (More than a week)</option>
              </select>
            </div>
          </div>
        )

      case "known_condition":
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
            {/* Selected Condition Display (if already selected) */}
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

            {/* Step 1: Category Selection (ONLY if no condition selected yet) */}
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

            {/* Step 2: Condition Selection (ONLY after category selected) */}
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

                {/* Search Bar (only visible after category selection) */}
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

            {/* Custom condition input (if Other selected) */}
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
            
            {/* Duration (only show if condition selected) */}
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


      default:
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
  }

  return (
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
        <span className="text-lg">📋</span>
        <span>Tell us more</span>
      </h3>
      
      {renderQuestions()}
    </div>
  )
}

