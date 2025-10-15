/**
 * SmartQuestions Component
 * Category-specific health questions to gather accurate information
 * Design: Simple checkboxes, radio buttons, dropdowns - no free text
 */

"use client"

import { useState, useEffect } from "react"

interface SmartQuestionsProps {
  category: string
  onComplete: (data: any) => void
}

export default function SmartQuestions({ category, onComplete }: SmartQuestionsProps) {
  const [answers, setAnswers] = useState<any>({})
  
  // Move hooks to top level to avoid conditional hook calls
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Reset state when category changes
  useEffect(() => {
    setSearchTerm('')
    setSelectedCategory(null)
  }, [category])

  const updateAnswer = (key: string, value: any) => {
    const updated = { ...answers, [key]: value }
    setAnswers(updated)
    onComplete(updated)
  }

  const toggleSymptom = (symptom: string) => {
    const current = answers.symptoms || []
    const updated = current.includes(symptom)
      ? current.filter((s: string) => s !== symptom)
      : [...current, symptom]
    updateAnswer('symptoms', updated)
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
                {['Yes (>100°F)', 'No', 'Not sure'].map(option => (
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
                value={answers.duration || ''}
                onChange={(e) => updateAnswer('duration', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select...</option>
                <option value="today">Started today</option>
                <option value="1-2">1-2 days</option>
                <option value="3-5">3-5 days</option>
                <option value="week+">More than a week</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Other symptoms:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['Body Pain', 'Headache', 'Rash', 'Bleeding', 'Low Platelets', 'Joint Pain'].map(symptom => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      (answers.symptoms || []).includes(symptom)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(symptom) ? '✓ ' : ''}{symptom}
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
                value={answers.duration || ''}
                onChange={(e) => updateAnswer('duration', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select...</option>
                <option value="today">Today</option>
                <option value="this-week">This week</option>
                <option value="earlier">Earlier</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Other symptoms:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {['Shortness of Breath', 'Sweating', 'Nausea', 'Dizziness'].map(symptom => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`py-1.5 px-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      (answers.symptoms || []).includes(symptom)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(symptom) ? '✓ ' : ''}{symptom}
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
                      (answers.symptoms || []).includes(complication)
                        ? 'bg-purple-100 border-purple-400 text-purple-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(complication) ? '✓ ' : ''}{complication}
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
                      (answers.symptoms || []).includes(med)
                        ? 'bg-purple-100 border-purple-400 text-purple-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(med) ? '✓ ' : ''}{med}
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
                value={answers.hba1c || ''}
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
                value={answers.concerns || ''}
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
                      (answers.symptoms || []).includes(issue)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(issue) ? '✓ ' : ''}{issue}
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
                value={answers.bpReading || ''}
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
                      (answers.symptoms || []).includes(med)
                        ? 'bg-red-100 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-red-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(med) ? '✓ ' : ''}{med}
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
                      (answers.symptoms || []).includes(issue)
                        ? 'bg-green-100 border-green-400 text-green-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-green-300'
                    }`}
                  >
                    {(answers.symptoms || []).includes(issue) ? '✓ ' : ''}{issue}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                कितने दिन से? (How long?)
              </label>
              <select
                value={answers.duration || ''}
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
            {answers.condition && answers.condition !== 'Other' && (
              <div className="bg-violet-50 border-2 border-violet-300 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <span className="text-sm font-semibold text-violet-800">{answers.condition}</span>
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
                  value={answers.customCondition || ''}
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
                  value={answers.duration || ''}
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

      // Remove all the old optgroup code below
      case "known_condition_OLD":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select your condition: <span className="text-red-500">*</span>
              </label>
              <select
                value={answers.condition || ''}
                onChange={(e) => updateAnswer('condition', e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              >
                <option value="">-- Select your condition --</option>
                
                <optgroup label="🩺 General & Primary Care">
                  <option value="General Health Concern">General Health Concern</option>
                  <option value="Annual Checkup">Annual Checkup</option>
                  <option value="Preventive Care">Preventive Care</option>
                </optgroup>
                
                <optgroup label="❤️ Heart & Circulatory">
                  <option value="Heart Disease">Heart Disease</option>
                  <option value="High Blood Pressure">High Blood Pressure (Hypertension)</option>
                  <option value="Chest Pain">Chest Pain</option>
                  <option value="Arrhythmia">Arrhythmia (Irregular Heartbeat)</option>
                  <option value="Heart Attack">Heart Attack / Post-Heart Attack Care</option>
                  <option value="Varicose Veins">Varicose Veins</option>
                  <option value="Deep Vein Thrombosis">Deep Vein Thrombosis (DVT)</option>
                </optgroup>
                
                <optgroup label="🧠 Brain, Nerves & Mental Health">
                  <option value="Stroke">Stroke / Post-Stroke Care</option>
                  <option value="Epilepsy">Epilepsy / Seizures</option>
                  <option value="Parkinsons">Parkinson's Disease</option>
                  <option value="Alzheimers">Alzheimer's / Dementia</option>
                  <option value="Multiple Sclerosis">Multiple Sclerosis</option>
                  <option value="Migraine">Migraine / Chronic Headaches</option>
                  <option value="Neuropathy">Neuropathy (Nerve Pain)</option>
                  <option value="Depression">Depression</option>
                  <option value="Anxiety">Anxiety Disorder</option>
                  <option value="Bipolar">Bipolar Disorder</option>
                  <option value="Schizophrenia">Schizophrenia</option>
                  <option value="PTSD">PTSD (Post-Traumatic Stress)</option>
                  <option value="OCD">OCD (Obsessive-Compulsive Disorder)</option>
                </optgroup>
                
                <optgroup label="🫁 Lungs & Respiratory">
                  <option value="Asthma">Asthma</option>
                  <option value="COPD">COPD (Chronic Obstructive Pulmonary Disease)</option>
                  <option value="Bronchitis">Chronic Bronchitis</option>
                  <option value="Pneumonia">Pneumonia</option>
                  <option value="Tuberculosis">Tuberculosis (TB)</option>
                  <option value="Sleep Apnea">Sleep Apnea</option>
                  <option value="Lung Fibrosis">Pulmonary Fibrosis</option>
                </optgroup>
                
                <optgroup label="🍽️ Digestive System">
                  <option value="GERD">GERD (Acid Reflux)</option>
                  <option value="IBS">IBS (Irritable Bowel Syndrome)</option>
                  <option value="Crohns">Crohn's Disease</option>
                  <option value="Ulcerative Colitis">Ulcerative Colitis</option>
                  <option value="Gastritis">Gastritis / Stomach Ulcers</option>
                  <option value="Fatty Liver">Fatty Liver Disease</option>
                  <option value="Hepatitis">Hepatitis (A/B/C)</option>
                  <option value="Cirrhosis">Cirrhosis</option>
                  <option value="Gallstones">Gallstones</option>
                  <option value="Pancreatitis">Pancreatitis</option>
                </optgroup>
                
                <optgroup label="💉 Hormones & Metabolism">
                  <option value="Diabetes Type 1">Diabetes Type 1</option>
                  <option value="Diabetes Type 2">Diabetes Type 2</option>
                  <option value="Prediabetes">Prediabetes</option>
                  <option value="Thyroid Hyper">Hyperthyroidism</option>
                  <option value="Thyroid Hypo">Hypothyroidism</option>
                  <option value="Thyroid Nodules">Thyroid Nodules</option>
                  <option value="PCOS">PCOS (Polycystic Ovary Syndrome)</option>
                  <option value="Obesity">Obesity / Weight Management</option>
                  <option value="Metabolic Syndrome">Metabolic Syndrome</option>
                </optgroup>
                
                <optgroup label="🩸 Blood & Cancer">
                  <option value="Anemia">Anemia (Iron Deficiency)</option>
                  <option value="Leukemia">Leukemia</option>
                  <option value="Lymphoma">Lymphoma</option>
                  <option value="Hemophilia">Hemophilia</option>
                  <option value="Sickle Cell">Sickle Cell Disease</option>
                  <option value="Breast Cancer">Breast Cancer</option>
                  <option value="Lung Cancer">Lung Cancer</option>
                  <option value="Colon Cancer">Colon / Colorectal Cancer</option>
                  <option value="Prostate Cancer">Prostate Cancer</option>
                  <option value="Skin Cancer">Skin Cancer / Melanoma</option>
                </optgroup>
                
                <optgroup label="🦴 Bones, Muscles & Movement">
                  <option value="Osteoarthritis">Osteoarthritis</option>
                  <option value="Rheumatoid Arthritis">Rheumatoid Arthritis</option>
                  <option value="Osteoporosis">Osteoporosis</option>
                  <option value="Back Pain">Chronic Back Pain</option>
                  <option value="Sciatica">Sciatica</option>
                  <option value="Fibromyalgia">Fibromyalgia</option>
                  <option value="Gout">Gout</option>
                  <option value="Fracture">Fracture / Bone Injury</option>
                  <option value="Sports Injury">Sports Injury</option>
                  <option value="Carpal Tunnel">Carpal Tunnel Syndrome</option>
                </optgroup>
                
                <optgroup label="🧬 Infections & Immunity">
                  <option value="HIV">HIV/AIDS</option>
                  <option value="COVID">COVID-19 / Long COVID</option>
                  <option value="Dengue">Dengue Fever</option>
                  <option value="Malaria">Malaria</option>
                  <option value="Typhoid">Typhoid</option>
                  <option value="Urinary Infection">Urinary Tract Infection (UTI)</option>
                  <option value="Allergies">Seasonal Allergies</option>
                  <option value="Food Allergies">Food Allergies</option>
                  <option value="Lupus">Lupus (SLE)</option>
                </optgroup>
                
                <optgroup label="👁️👂 Eye, Ear, Nose & Throat">
                  <option value="Cataracts">Cataracts</option>
                  <option value="Glaucoma">Glaucoma</option>
                  <option value="Macular Degeneration">Macular Degeneration</option>
                  <option value="Dry Eyes">Dry Eyes / Eye Strain</option>
                  <option value="Sinusitis">Sinusitis</option>
                  <option value="Tonsillitis">Tonsillitis</option>
                  <option value="Hearing Loss">Hearing Loss</option>
                  <option value="Vertigo">Vertigo / Dizziness</option>
                  <option value="Tinnitus">Tinnitus (Ringing in Ears)</option>
                </optgroup>
                
                <optgroup label="🧴 Skin, Hair & Nails">
                  <option value="Eczema">Eczema</option>
                  <option value="Psoriasis">Psoriasis</option>
                  <option value="Acne">Acne</option>
                  <option value="Rosacea">Rosacea</option>
                  <option value="Hair Loss">Hair Loss / Alopecia</option>
                  <option value="Fungal Infection">Fungal Skin Infection</option>
                  <option value="Vitiligo">Vitiligo</option>
                </optgroup>
                
                <optgroup label="🤰👶 Women & Children">
                  <option value="Pregnancy">Pregnancy / Prenatal Care</option>
                  <option value="Miscarriage">Miscarriage / Pregnancy Loss</option>
                  <option value="Menopause">Menopause</option>
                  <option value="Endometriosis">Endometriosis</option>
                  <option value="Fibroids">Uterine Fibroids</option>
                  <option value="Infertility">Infertility</option>
                  <option value="Child Fever">Child - Fever</option>
                  <option value="Child Asthma">Child - Asthma</option>
                  <option value="Child Development">Child - Development Delay</option>
                  <option value="Autism">Child - Autism Spectrum Disorder</option>
                </optgroup>
                
                <optgroup label="🧍‍♂️ Urinary & Reproductive">
                  <option value="Kidney Stones">Kidney Stones</option>
                  <option value="Chronic Kidney Disease">Chronic Kidney Disease (CKD)</option>
                  <option value="Kidney Failure">Kidney Failure / Dialysis</option>
                  <option value="Enlarged Prostate">Enlarged Prostate (BPH)</option>
                  <option value="Erectile Dysfunction">Erectile Dysfunction</option>
                  <option value="Male Infertility">Male Infertility</option>
                  <option value="Incontinence">Urinary Incontinence</option>
                </optgroup>
                
                <optgroup label="🦷 Dental & Oral">
                  <option value="Tooth Decay">Tooth Decay / Cavities</option>
                  <option value="Gum Disease">Gum Disease</option>
                  <option value="Wisdom Teeth">Wisdom Teeth Problems</option>
                  <option value="Root Canal">Root Canal Treatment Needed</option>
                  <option value="Dental Implant">Dental Implant Consultation</option>
                </optgroup>
                
                <optgroup label="🧑‍⚕️ Other Conditions">
                  <option value="Chronic Fatigue">Chronic Fatigue Syndrome</option>
                  <option value="Chronic Pain">Chronic Pain Syndrome</option>
                  <option value="Autoimmune">Autoimmune Disease (Unspecified)</option>
                  <option value="Post Surgery">Post-Surgery Follow-up</option>
                  <option value="Other">Other Condition</option>
                </optgroup>
              </select>
            </div>
            
            {answers.condition && answers.condition === 'Other' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Please specify your condition:
                </label>
                <input
                  type="text"
                  value={answers.customCondition || ''}
                  onChange={(e) => updateAnswer('customCondition', e.target.value)}
                  placeholder="Enter your condition"
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                How long have you had this condition?
              </label>
              <select
                value={answers.duration || ''}
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
          </div>
        )

      default:
        return (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Describe your concern:
            </label>
            <textarea
              value={answers.description || ''}
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

