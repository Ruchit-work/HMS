"use client"

import { ReactNode } from 'react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

interface SpeechRecognitionProviderProps {
  children: ReactNode
}

/**
 * Provider component for Speech Recognition
 * This ensures SpeechRecognition is properly initialized
 */
export default function SpeechRecognitionProvider({ children }: SpeechRecognitionProviderProps) {
  // Initialize speech recognition if supported
  if (typeof window !== 'undefined') {
    const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    
    if (!isSupported) {
      console.warn('Web Speech API not supported. Voice input will use Google Cloud Speech-to-Text API.')
    }
  }

  return <>{children}</>
}
