/**
 * MedicalHistoryChecklist Component
 * Easy checkbox-based medical history input
 * Design: Common conditions + allergies
 */

"use client"

interface MedicalHistoryChecklistProps {
  selectedConditions: string[]
  allergies: string
  currentMedications: string
  onConditionsChange: (conditions: string[]) => void
  onAllergiesChange: (allergies: string) => void
  onMedicationsChange: (meds: string) => void
}

const COMMON_CONDITIONS = [
  { id: 'diabetes', label: 'Diabetes', icon: '💉' },
  { id: 'hypertension', label: 'High Blood Pressure', icon: '🩸' },
  { id: 'heart_disease', label: 'Heart Disease', icon: '❤️' },
  { id: 'asthma', label: 'Asthma', icon: '🫁' },
  { id: 'thyroid', label: 'Thyroid Problems', icon: '🦋' },
  { id: 'kidney', label: 'Kidney Disease', icon: '🫘' },
]

export default function MedicalHistoryChecklist({
  selectedConditions,
  allergies,
  currentMedications,
  onConditionsChange,
  onAllergiesChange,
  onMedicationsChange
}: MedicalHistoryChecklistProps) {
  
  const toggleCondition = (conditionId: string) => {
    if (selectedConditions.includes(conditionId)) {
      onConditionsChange(selectedConditions.filter(id => id !== conditionId))
    } else {
      onConditionsChange([...selectedConditions, conditionId])
    }
  }

  return (
    <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
        <span className="text-lg">📋</span>
        <span>Medical History</span>
        <span className="text-xs font-normal text-slate-500">(Optional)</span>
      </h3>

      {/* Existing Conditions */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Any existing conditions?
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {COMMON_CONDITIONS.map(condition => (
            <button
              key={condition.id}
              type="button"
              onClick={() => toggleCondition(condition.id)}
              className={`py-1.5 px-2 rounded-lg border-2 text-center font-medium text-xs transition-all ${
                selectedConditions.includes(condition.id)
                  ? 'bg-pink-100 border-pink-400 text-pink-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-pink-300'
              }`}
            >
              <div className="text-base">{condition.icon}</div>
              <div className="text-xs leading-tight mt-0.5">
                {selectedConditions.includes(condition.id) ? '✓ ' : ''}{condition.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="mb-2">
        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-2">
          Allergies?
          {allergies && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
              ✓ From Profile
            </span>
          )}
        </label>
        <input
          type="text"
          value={allergies}
          onChange={(e) => onAllergiesChange(e.target.value)}
          placeholder="e.g., Penicillin, Peanuts"
          className="w-full px-3 py-1.5 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
        {!allergies && (
          <p className="text-xs text-slate-500 mt-1">No allergies saved in profile. You can add here.</p>
        )}
      </div>

      {/* Current Medications */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-2">
          Current medications?
          {currentMedications && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
              ✓ From Profile
            </span>
          )}
        </label>
        <input
          type="text"
          value={currentMedications}
          onChange={(e) => onMedicationsChange(e.target.value)}
          placeholder="e.g., Metformin 500mg"
          className="w-full px-3 py-1.5 text-xs border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
        />
        {!currentMedications && (
          <p className="text-xs text-slate-500 mt-1">No medications saved in profile. You can add here.</p>
        )}
      </div>
    </div>
  )
}

