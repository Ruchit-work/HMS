"use client"

/**
 * Example component showing how to use VoiceInput
 * 
 * This demonstrates:
 * 1. Basic text input with voice
 * 2. Textarea with voice
 * 3. Using with form state
 */

import { useState } from 'react'
import VoiceInput from '@/components/ui/VoiceInput'

export default function VoiceInputExample() {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [symptoms, setSymptoms] = useState('')

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Voice Input Examples</h2>

      {/* Example 1: Basic Text Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Patient Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name or use voice input"
            className="flex-1 px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <VoiceInput
            onTranscript={setName}
            language="en-IN"
            useGoogleCloud={false} // Use browser API (free)
          />
        </div>
      </div>

      {/* Example 2: Textarea with Voice (Appends) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-slate-700">
            Symptoms / Notes
          </label>
          <VoiceInput
            onTranscript={(text) => {
              setNotes(prev => prev ? `${prev} ${text}` : text)
            }}
            language="en-IN"
            useGoogleCloud={true} // Use Google Cloud for better accuracy
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Describe symptoms or use voice input..."
          className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>

      {/* Example 3: With Error Handling */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Medical History
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Enter medical history"
            className="flex-1 px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <VoiceInput
            onTranscript={setSymptoms}
            onError={(error) => {
              console.error('Voice input error:', error)
              alert(`Voice input error: ${error}`)
            }}
            language="en-IN"
            useGoogleCloud={true}
          />
        </div>
      </div>

      {/* Display current values */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg">
        <h3 className="font-semibold mb-2">Current Form Values:</h3>
        <pre className="text-xs text-slate-600">
          {JSON.stringify({ name, notes, symptoms }, null, 2)}
        </pre>
      </div>
    </div>
  )
}
