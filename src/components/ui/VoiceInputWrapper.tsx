"use client"

import { ReactNode } from 'react'

interface VoiceInputWrapperProps {
  children: ReactNode
}

/**
 * Wrapper component for Voice Input functionality
 * Checks browser support for speech recognition
 * 
 * Note: This component is currently not used in the app.
 * The app uses SpeechRecognitionProvider instead.
 * This file is kept for potential future use.
 */
export default function VoiceInputWrapper({ children }: VoiceInputWrapperProps) {
  // Check if browser supports speech recognition
  if (typeof window !== 'undefined') {
    const hasWebSpeechAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    
    if (!hasWebSpeechAPI) {
      // Browser doesn't support Web Speech API, but we can still use MediaRecorder for Google Cloud
      console.warn('Web Speech API not supported. Google Cloud Speech-to-Text will be used if enabled.')
    }
  }

  return <>{children}</>
}
