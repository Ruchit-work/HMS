"use client"

import { AppointmentFormData, UserData } from "@/types/patient"
import SymptomSelector from "../../symptoms/SymptomSelector"
import SmartQuestions from "../../forms/SmartQuestions"
import MedicalHistoryChecklist from "../../forms/MedicalHistoryChecklist"

interface SymptomsStepProps {
  userData: UserData
  appointmentData: AppointmentFormData
  selectedSymptomCategory: string | null
  symptomAnswers: any
  medicalConditions: string[]
  allergies: string
  currentMedications: string
  slideDirection: 'right' | 'left'
  onProblemChange: (problem: string) => void
  onSymptomCategoryChange: (category: string | null) => void
  onSymptomAnswersChange: (answers: any) => void
  onMedicalConditionsChange: (conditions: string[]) => void
  onAllergiesChange: (allergies: string) => void
  onMedicationsChange: (medications: string) => void
  onSymptomDetailsChange: (field: string, value: string) => void
  onReset: () => void
}

export default function SymptomsStep({
  // userData is kept in props (used by parent) but not needed locally
  appointmentData,
  selectedSymptomCategory,
  symptomAnswers,
  medicalConditions,
  allergies,
  currentMedications,
  slideDirection,
  onProblemChange,
  onSymptomCategoryChange,
  onSymptomAnswersChange,
  onMedicalConditionsChange,
  onAllergiesChange,
  onMedicationsChange,
  onSymptomDetailsChange,
  onReset
}: SymptomsStepProps) {
  return (
    <div className={`space-y-3 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
      {/* Reset Button */}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border-2 border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset All
        </button>
      </div>

      {/* Required Free-text */}
      <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          What brings you here? <span className="text-red-500">*</span>
        </label>
        <textarea
          value={appointmentData.problem}
          onChange={(e) => onProblemChange(e.target.value)}
          rows={4}
          placeholder="Describe your main concern in your own words"
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 whitespace-pre-wrap break-words resize-y min-h-[110px] sm:min-h-[130px]"
          required
        />
        <p className="text-xs text-slate-500 mt-1">Short is fine. Examples: "Fever and body pain since 2 days", "Cough and cold", "Stomach ache".</p>
      </div>
      
      {/* Symptom Category Selection */}
      <div className="bg-white border-2 border-teal-200 rounded-xl p-4">
        <SymptomSelector
          selectedCategory={selectedSymptomCategory}
          onSelect={onSymptomCategoryChange}
        />
      </div>

      {/* Smart Follow-up Questions (appears after category selected) */}
      {selectedSymptomCategory && (
        <div className="animate-fade-in">
          <SmartQuestions
            category={selectedSymptomCategory}
            onComplete={onSymptomAnswersChange}
          />
        </div>
      )}

      {/* Structured Symptom Details - Hide for cancer category */}
      {selectedSymptomCategory && selectedSymptomCategory !== "cancer_oncology" && (
        <div className="bg-white border-2 border-slate-200 rounded-xl p-4 animate-fade-in">
          <h4 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span>📝</span>
            <span>Symptom Details</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
              <input
                type="text"
                placeholder="e.g., 3 days / 2 weeks"
                value={appointmentData.symptomDuration || ''}
                onChange={(e) => onSymptomDetailsChange('symptomDuration', e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Progression</label>
              <input
                type="text"
                placeholder="e.g., worsening / improving / unchanged"
                value={appointmentData.symptomProgression || ''}
                onChange={(e) => onSymptomDetailsChange('symptomProgression', e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Triggers / Relievers</label>
              <input
                type="text"
                placeholder="e.g., worse on exertion; better with rest"
                value={appointmentData.symptomTriggers || ''}
                onChange={(e) => onSymptomDetailsChange('symptomTriggers', e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Associated Symptoms</label>
              <input
                type="text"
                placeholder="e.g., fever, cough, nausea"
                value={appointmentData.associatedSymptoms || ''}
                onChange={(e) => onSymptomDetailsChange('associatedSymptoms', e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Medical History Checklist */}
      {selectedSymptomCategory && (
        <div className="animate-fade-in">
          <MedicalHistoryChecklist
            selectedConditions={medicalConditions}
            allergies={allergies}
            currentMedications={currentMedications}
            onConditionsChange={onMedicalConditionsChange}
            onAllergiesChange={onAllergiesChange}
            onMedicationsChange={onMedicationsChange}
          />
        </div>
      )}

      {/* Generated Summary */}
      {selectedSymptomCategory && appointmentData.problem && (
        <div className={`border rounded-lg p-2 animate-fade-in ${
          selectedSymptomCategory === "cancer_oncology" 
            ? "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300" 
            : "bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-300"
        }`}>
          <p className={`text-xs font-semibold mb-1 flex items-center gap-1 ${
            selectedSymptomCategory === "cancer_oncology" ? "text-purple-700" : "text-teal-700"
          }`}>
            <span>✓</span>
            <span>Summary:</span>
          </p>
          {selectedSymptomCategory === "cancer_oncology" ? (
            <div className="space-y-1">
              {symptomAnswers.cancerType && (
                <p className="text-xs font-semibold text-slate-800">
                  <span className="text-purple-600">Type of Cancer:</span> {symptomAnswers.cancerType}
                </p>
              )}
              {symptomAnswers.visitType && (
                <p className="text-xs text-slate-700">
                  <span className="font-semibold text-purple-600">Visit Type:</span> {symptomAnswers.visitType}
                </p>
              )}
              {symptomAnswers.treatmentStatus && (
                <p className="text-xs text-slate-700">
                  <span className="font-semibold text-purple-600">Treatment Status:</span> {symptomAnswers.treatmentStatus}
                </p>
              )}
              {symptomAnswers.symptoms && Array.isArray(symptomAnswers.symptoms) && symptomAnswers.symptoms.length > 0 && (
                <p className="text-xs text-slate-700">
                  <span className="font-semibold text-purple-600">Current Treatments:</span> {
                    (symptomAnswers.symptoms as string[]).filter(s => s !== 'None / I don\'t know').join(', ') || 'None'
                  }
                </p>
              )}
              {symptomAnswers.additionalConcerns && (
                <p className="text-xs text-slate-700 mt-2 break-words whitespace-pre-wrap">
                  <span className="font-semibold text-purple-600">Additional Concerns:</span> {symptomAnswers.additionalConcerns}
                </p>
              )}
              {appointmentData.medicalHistory && (
                <p className="text-xs text-slate-600 mt-2 break-words whitespace-pre-wrap border-t border-purple-200 pt-2">
                  <span className="font-semibold">Medical History:</span> {appointmentData.medicalHistory}
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-800 break-words whitespace-pre-wrap">{appointmentData.problem}</p>
              
              {/* Symptom Details */}
              {(appointmentData.symptomDuration || appointmentData.symptomProgression || appointmentData.symptomTriggers || appointmentData.associatedSymptoms) && (
                <div className="mt-2 pt-2 border-t border-teal-200 space-y-1">
                  {appointmentData.symptomDuration && (
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-teal-600">Duration:</span> {appointmentData.symptomDuration}
                    </p>
                  )}
                  {appointmentData.symptomProgression && (
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-teal-600">Progression:</span> {appointmentData.symptomProgression}
                    </p>
                  )}
                  {appointmentData.symptomTriggers && (
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-teal-600">Triggers/Relievers:</span> {appointmentData.symptomTriggers}
                    </p>
                  )}
                  {appointmentData.associatedSymptoms && (
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-teal-600">Associated Symptoms:</span> {appointmentData.associatedSymptoms}
                    </p>
                  )}
                </div>
              )}
              
              {appointmentData.medicalHistory && (
                <p className="text-xs text-slate-600 mt-1 break-words whitespace-pre-wrap">{appointmentData.medicalHistory}</p>
              )}
              {appointmentData.additionalConcern && (
                <p className="text-xs text-slate-700 mt-1 break-words whitespace-pre-wrap">
                  <span className="font-semibold">Additional:</span> {appointmentData.additionalConcern}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

