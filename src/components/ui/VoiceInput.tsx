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
  /** When true, renders only a compact mic button (e.g. for embedding inside an input) */
  variant?: 'default' | 'inline'
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
  useMedicalModel = true, // Use medical model for medical terminology
  variant = 'default'
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const lastAppliedTranscriptRef = useRef<string>('')
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopListeningRef = useRef<() => void>(() => {})
  const weStartedListeningRef = useRef(false)

  const SILENCE_AUTO_STOP_MS = 2000
  const CLOUD_MAX_DURATION_MS = 12000

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition()

  useEffect(() => {
    setIsSupported(browserSupportsSpeechRecognition || navigator.mediaDevices?.getUserMedia !== undefined)
  }, [browserSupportsSpeechRecognition])

  // Sync listening state from hook when using browser API - only this instance if we started it
  useEffect(() => {
    const usingBrowser = !useMedicalModel && browserSupportsSpeechRecognition && !useAzure
    if (!usingBrowser) return
    if (listening && weStartedListeningRef.current) {
      setIsListening(true)
    }
    if (!listening) {
      weStartedListeningRef.current = false
      setIsListening(false)
    }
  }, [listening, useMedicalModel, browserSupportsSpeechRecognition, useAzure])

  // Only forward transcript when it actually changes and we started this session (browser API is global)
  useEffect(() => {
    const usingBrowser = !useMedicalModel && browserSupportsSpeechRecognition && !useAzure
    if (!usingBrowser || !transcript) return
    if (!weStartedListeningRef.current) return
    if (transcript === lastAppliedTranscriptRef.current) return
    lastAppliedTranscriptRef.current = transcript
    onTranscript(transcript)
  }, [transcript, onTranscript, useMedicalModel, browserSupportsSpeechRecognition, useAzure])

  // Auto-stop: reset silence timer on each transcript update (browser API)
  useEffect(() => {
    const usingBrowser = !useMedicalModel && browserSupportsSpeechRecognition && !useAzure
    if (!usingBrowser || !isListening) return
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
    silenceTimeoutRef.current = setTimeout(() => {
      silenceTimeoutRef.current = null
      stopListeningRef.current()
    }, SILENCE_AUTO_STOP_MS)
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    }
  }, [transcript, isListening, useMedicalModel, browserSupportsSpeechRecognition, useAzure])

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current)
    }
  }, [])

  const startListening = async () => {
    try {
      setError(null)
      
      if (useAzure) {
        await startAzureRecognition()
      } else if (useMedicalModel) {
        // Medical terminology needs Cloud medical model
        await startGoogleCloudRecognition()
      } else if (browserSupportsSpeechRecognition) {
        // Prefer browser Web Speech API = same engine as Google mic (Chrome/Edge)
        // Best accuracy for general speech and Indian accent
        weStartedListeningRef.current = true
        resetTranscript()
        lastAppliedTranscriptRef.current = ''
        setIsListening(true)
        SpeechRecognition.startListening({
          continuous,
          language,
          interimResults: true
        })
      } else if (useGoogleCloud) {
        await startGoogleCloudRecognition()
      } else {
        throw new Error('Speech recognition is not supported in your browser')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice recognition'
      setError(errorMessage)
      onError?.(errorMessage)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    weStartedListeningRef.current = false
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current)
      maxDurationTimeoutRef.current = null
    }
    const usedCloud = useAzure || useMedicalModel || (useGoogleCloud && !browserSupportsSpeechRecognition)
    if (usedCloud) {
      stopCloudRecognition()
    } else {
      SpeechRecognition.stopListening()
    }
    setIsListening(false)
  }
  stopListeningRef.current = stopListening

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
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current)
      maxDurationTimeoutRef.current = setTimeout(() => {
        maxDurationTimeoutRef.current = null
        stopListening()
      }, CLOUD_MAX_DURATION_MS)
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
      // Better audio = better accuracy: reduce echo, noise, normalize volume
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(typeof navigator.mediaDevices.getSupportedConstraints?.().sampleRate === 'boolean' && { sampleRate: 48000 })
        }
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ audio: true })
      )
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      
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
      if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current)
      maxDurationTimeoutRef.current = setTimeout(() => {
        maxDurationTimeoutRef.current = null
        stopListening()
      }, CLOUD_MAX_DURATION_MS)
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
    return variant === 'inline' ? null : (
      <div className={`text-xs text-slate-500 ${className}`}>
        Voice input not supported in this browser
      </div>
    )
  }

  const button = (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`
        flex items-center justify-center rounded-full
        transition-all duration-200
        ${variant === 'inline'
          ? 'w-7 h-7 focus:ring-1 focus:ring-offset-0'
          : 'w-8 h-8 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1'
        }
        ${isListening
          ? `bg-red-400 hover:bg-red-500 text-white ${variant === 'inline' ? 'animate-heartbeat' : 'animate-pulse'}`
          : variant === 'inline'
            ? 'bg-transparent border border-transparent hover:bg-slate-100/60 text-slate-500 hover:text-slate-600'
            : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={error ? `${isListening ? 'Stop recording' : 'Start voice input'} — ${error}` : isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening ? (
        <svg className={variant === 'inline' ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 9a1 1 0 10-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className={variant === 'inline' ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )

  if (variant === 'inline') {
    return (
      <div className={`relative flex items-center shrink-0 ${className}`}>
        {button}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {button}
      {error && (
        <span className="text-xs text-red-600" title={error}>
          ⚠️ {error}
        </span>
      )}
      {isListening && !useMedicalModel && browserSupportsSpeechRecognition && !useAzure && (
        <span className="text-xs text-slate-500 animate-pulse">
          Listening...
        </span>
      )}
      {isListening && (useMedicalModel || useAzure || !browserSupportsSpeechRecognition) && (
        <span className="text-xs text-slate-500 animate-pulse">
          Recording...
        </span>
      )}
    </div>
  )
}
