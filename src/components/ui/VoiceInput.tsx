"use client"

import { useState, useEffect, useRef } from 'react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onError?: (error: string) => void
  language?: string
  continuous?: boolean
  className?: string
  disabled?: boolean
  useGoogleCloud?: boolean // Set to true for better Indian accent support (default: true for accuracy)
  useAzure?: boolean // Alternative: Azure Speech Services (better pricing)
  useMedicalModel?: boolean // Use medical model for better medical terminology accuracy
}

export default function VoiceInput({
  onTranscript,
  onError,
  language = 'en-IN', // Indian English by default
  continuous = false,
  className = '',
  disabled = false,
  useGoogleCloud = true, // Default to true for better accuracy (medical use case)
  useAzure = false, // Alternative option
  useMedicalModel = true // Use medical model for medical terminology
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition()

  useEffect(() => {
    setIsSupported(browserSupportsSpeechRecognition || navigator.mediaDevices?.getUserMedia !== undefined)
  }, [browserSupportsSpeechRecognition])

  // Sync listening state from hook
  useEffect(() => {
    if (!useGoogleCloud) {
      setIsListening(listening)
    }
  }, [listening, useGoogleCloud])

  useEffect(() => {
    if (transcript && !useGoogleCloud) {
      onTranscript(transcript)
    }
  }, [transcript, onTranscript, useGoogleCloud])

  const startListening = async () => {
    try {
      setError(null)
      
      if (useAzure) {
        // Use Azure Speech Services
        await startAzureRecognition()
      } else if (useGoogleCloud) {
        // Use Google Cloud Speech-to-Text API (better accuracy)
        await startGoogleCloudRecognition()
      } else {
        // Use browser's Web Speech API (fallback, lower accuracy)
        if (!browserSupportsSpeechRecognition) {
          throw new Error('Speech recognition is not supported in your browser')
        }
        
        resetTranscript()
        setIsListening(true)
        SpeechRecognition.startListening({
          continuous,
          language,
          interimResults: true
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice recognition'
      setError(errorMessage)
      onError?.(errorMessage)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (useAzure || useGoogleCloud) {
      stopCloudRecognition()
    } else {
      SpeechRecognition.stopListening()
    }
    setIsListening(false)
  }

  const startAzureRecognition = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendToAzure(audioBlob)
        
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (err) {
      throw new Error('Microphone access denied or not available')
    }
  }

  const sendToAzure = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', language)

      const response = await fetch('/api/speech-to-text-azure', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to transcribe audio')
      }

      const data = await response.json()
      if (data.text) {
        onTranscript(data.text)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio'
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }

  const startGoogleCloudRecognition = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendToGoogleCloud(audioBlob)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (err) {
      throw new Error('Microphone access denied or not available')
    }
  }

  const stopCloudRecognition = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const sendToGoogleCloud = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', language)
      formData.append('useMedicalModel', useMedicalModel ? 'true' : 'false')

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to transcribe audio')
      }

      const data = await response.json()
      if (data.text) {
        onTranscript(data.text)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio'
      setError(errorMessage)
      onError?.(errorMessage)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  if (!isSupported) {
    return (
      <div className={`text-xs text-slate-500 ${className}`}>
        Voice input not supported in this browser
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        className={`
          flex items-center justify-center
          w-10 h-10 rounded-full
          transition-all duration-200
          ${isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2
        `}
        title={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {isListening ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 9a1 1 0 10-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      {error && (
        <span className="text-xs text-red-600" title={error}>
          ⚠️ {error}
        </span>
      )}
      
      {isListening && !useGoogleCloud && !useAzure && (
        <span className="text-xs text-slate-500 animate-pulse">
          Listening...
        </span>
      )}
      {isListening && (useGoogleCloud || useAzure) && (
        <span className="text-xs text-slate-500 animate-pulse">
          Recording... (Cloud processing)
        </span>
      )}
    </div>
  )
}
