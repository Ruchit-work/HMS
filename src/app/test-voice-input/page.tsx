"use client"

import VoiceInputExample from "@/components/examples/VoiceInputExample"

export default function TestVoiceInputPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            🎤 Voice Input Test Page
          </h1>
          <p className="text-slate-600">
            Test the speech-to-text feature with Google Cloud Speech-to-Text API
          </p>
        </div>
        <VoiceInputExample />
      </div>
    </div>
  )
}
