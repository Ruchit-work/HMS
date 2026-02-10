"use client"

import VoiceInput from "@/components/ui/VoiceInput"
import { useState } from "react"

export default function TestVoiceInputPage() {
  const [text, setText] = useState("")

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Voice Input Test
          </h1>
          <p className="text-slate-600">
            Test speech-to-text with the mic; result appears below.
          </p>
        </div>
        <div className="flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or type here..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2"
          />
          <VoiceInput
            onTranscript={setText}
            language="en-IN"
            useMedicalModel={false}
          />
        </div>
        {text && <p className="mt-4 text-slate-700">Result: {text}</p>}
      </div>
    </div>
  )
}
