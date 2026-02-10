"use client"

import { QuestionConfig } from "@/constants/questions"
import VoiceInput from "@/components/ui/VoiceInput"

interface QuestionRendererProps {
  question: QuestionConfig
  value: string | string[] | boolean | number | undefined
  onChange: (key: string, value: string | string[] | boolean | number) => void
  onToggleMulti?: (key: string, option: string) => void
  enableVoiceInput?: boolean // Enable voice input for text fields
  useGoogleCloud?: boolean // Use Google Cloud Speech-to-Text for better Indian accent support
}

export function QuestionRenderer({
  question,
  value,
  onChange,
  onToggleMulti,
  enableVoiceInput = false,
  useGoogleCloud = false
}: QuestionRendererProps) {
  const colorClasses = {
    red: {
      selected: 'bg-red-500 text-white border-red-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-red-300',
      multiSelected: 'bg-red-100 border-red-400 text-red-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-red-300',
      focus: 'focus:ring-red-500'
    },
    blue: {
      selected: 'bg-blue-500 text-white border-blue-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-blue-300',
      multiSelected: 'bg-blue-100 border-blue-400 text-blue-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-blue-300',
      focus: 'focus:ring-blue-500'
    },
    green: {
      selected: 'bg-green-500 text-white border-green-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-green-300',
      multiSelected: 'bg-green-100 border-green-400 text-green-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-green-300',
      focus: 'focus:ring-green-500'
    },
    purple: {
      selected: 'bg-purple-500 text-white border-purple-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-purple-300',
      multiSelected: 'bg-purple-100 border-purple-400 text-purple-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-purple-300',
      focus: 'focus:ring-purple-500'
    },
    teal: {
      selected: 'bg-teal-500 text-white border-teal-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-teal-300',
      multiSelected: 'bg-teal-100 border-teal-400 text-teal-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-teal-300',
      focus: 'focus:ring-teal-500'
    },
    yellow: {
      selected: 'bg-yellow-500 text-white border-yellow-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-yellow-300',
      multiSelected: 'bg-yellow-100 border-yellow-400 text-yellow-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-yellow-300',
      focus: 'focus:ring-yellow-500'
    },
    orange: {
      selected: 'bg-orange-500 text-white border-orange-500',
      unselected: 'bg-white border-slate-300 text-slate-700 hover:border-orange-300',
      multiSelected: 'bg-orange-100 border-orange-400 text-orange-800',
      multiUnselected: 'bg-white border-slate-200 text-slate-700 hover:border-orange-300',
      focus: 'focus:ring-orange-500'
    }
  }

  const color = question.color || 'teal'
  const colors = colorClasses[color]

  const textSize = question.type === 'textarea' ? 'text-sm' : 'text-xs'
  const labelSize = question.type === 'textarea' || question.type === 'text' ? 'text-sm' : 'text-xs'

  switch (question.type) {
    case 'buttonGroup':
      if (!question.options || question.options.length === 0) return null
      
      const gridCols = question.gridCols || 2
      const isStringArray = typeof question.options[0] === 'string'
      
      return (
        <div>
          <label className={`block ${labelSize} font-medium text-slate-700 ${question.type === 'buttonGroup' ? 'mb-1' : 'mb-2'}`}>
            {question.label}
            {question.required && <span className="text-red-500"> *</span>}
          </label>
          <div className={`grid ${gridCols === 3 ? 'grid-cols-3 gap-1.5' : gridCols === 4 ? 'grid-cols-2 sm:grid-cols-4 gap-2' : 'grid-cols-2 gap-2'}`}>
            {question.options.map((option) => {
              const optionValue = isStringArray ? (option as string) : (option as { value: string; label: string }).value
              const optionLabel = isStringArray ? (option as string) : (option as { value: string; label: string }).label
              const isSelected = value === optionValue
              
              return (
                <button
                  key={optionValue}
                  type="button"
                  onClick={() => onChange(question.key, optionValue)}
                  className={`${question.type === 'buttonGroup' ? 'py-1.5' : 'py-2'} ${gridCols === 3 ? 'px-2' : 'px-3'} rounded-lg border-2 font-medium ${textSize} transition-all ${
                    isSelected ? colors.selected : colors.unselected
                  }`}
                >
                  {optionLabel}
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'select':
      if (!question.options || question.options.length === 0) return null
      
      const selectOptions = question.options.map(opt => 
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      )
      
      return (
        <div>
          <label className={`block ${labelSize} font-medium text-slate-700 mb-1`}>
            {question.label}
            {question.required && <span className="text-red-500"> *</span>}
          </label>
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(question.key, e.target.value)}
            className={`w-full px-3 py-1.5 ${textSize} border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 ${colors.focus}`}
          >
            <option value="">Select...</option>
            {selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )

    case 'multiSelect':
      if (!question.options || question.options.length === 0) return null
      
      const multiGridCols = question.gridCols || 2
      const selectedArray = (value as string[]) || []
      
      return (
        <div>
          <label className={`block ${labelSize} font-medium text-slate-700 mb-1`}>
            {question.label}
            {question.required && <span className="text-red-500"> *</span>}
          </label>
          <div className={`grid ${multiGridCols === 3 ? 'grid-cols-3 gap-1.5' : 'grid-cols-2 gap-2'}`}>
            {question.options.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label
              const isSelected = selectedArray.includes(optionValue)
              
              return (
                <button
                  key={optionValue}
                  type="button"
                  onClick={() => onToggleMulti?.(question.key, optionValue)}
                  className={`py-1.5 px-2 rounded-lg border-2 ${textSize} font-medium transition-all ${
                    isSelected ? colors.multiSelected : colors.multiUnselected
                  }`}
                >
                  {isSelected ? '✓ ' : ''}{optionLabel}
                </button>
              )
            })}
          </div>
        </div>
      )

    case 'text':
      return (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={`block ${labelSize} font-medium text-slate-700`}>
              {question.label}
              {question.required && <span className="text-red-500"> *</span>}
            </label>
            {enableVoiceInput && (
              <VoiceInput
                onTranscript={(text) => onChange(question.key, text)}
                useGoogleCloud={useGoogleCloud}
                language="en-IN"
                className="ml-2"
              />
            )}
          </div>
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(question.key, e.target.value)}
            placeholder={question.placeholder}
            className={`w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 ${colors.focus}`}
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`block ${labelSize} font-medium text-slate-700`}>
              {question.label}
              {question.required && <span className="text-red-500"> *</span>}
            </label>
            {enableVoiceInput && (
              <VoiceInput
                onTranscript={(text) => {
                  const currentValue = (value as string) || ''
                  onChange(question.key, currentValue ? `${currentValue} ${text}` : text)
                }}
                useGoogleCloud={useGoogleCloud}
                language="en-IN"
                className="ml-2"
              />
            )}
          </div>
          <textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(question.key, e.target.value)}
            rows={question.rows || 3}
            placeholder={question.placeholder}
            className={`w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 ${colors.focus} ${textSize}`}
          />
        </div>
      )

    default:
      return null
  }
}

