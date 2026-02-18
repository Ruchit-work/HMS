"use client"

import { useEffect, useState } from 'react'
import { sanitizeErrorMessage, makeConcise } from '@/utils/errors/messageSanitizer'

interface NotificationProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
  durationMs?: number
  countdownSeconds?: number
  onCountdownComplete?: () => void
  /** If true, sanitizes technical error messages to user-friendly ones */
  sanitize?: boolean
  /** Maximum message length (default: 120 characters) */
  maxLength?: number
}

export default function Notification({
  type,
  message,
  onClose,
  durationMs,
  countdownSeconds,
  onCountdownComplete,
  sanitize = true,
  maxLength = 120,
}: NotificationProps) {
  // Auto-determine duration based on type if not provided
  const defaultDuration = durationMs ?? (type === 'error' ? 8000 : type === 'success' ? 5000 : 6000)
  
  // Sanitize and make concise
  const displayMessage = sanitize && type === 'error' 
    ? makeConcise(sanitizeErrorMessage(message), maxLength)
    : makeConcise(message, maxLength)
  const [remaining, setRemaining] = useState<number | null>(
    countdownSeconds !== undefined ? countdownSeconds : null
  )

  useEffect(() => {
    const timer = setTimeout(onClose, defaultDuration)
    return () => clearTimeout(timer)
  }, [onClose, defaultDuration])

  useEffect(() => {
    if (remaining === null) return
    if (remaining <= 0) {
      onCountdownComplete?.()
      return
    }

    const interval = setInterval(() => {
      setRemaining(prev => (prev !== null ? prev - 1 : prev))
    }, 1000)

    return () => clearInterval(interval)
  }, [remaining, onCountdownComplete])

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`rounded-lg shadow-lg p-4 min-w-[300px] max-w-md overflow-hidden ${
        type === 'success' ? 'bg-green-50 border-l-4 border-green-500' :
        type === 'error' ? 'bg-red-50 border-l-4 border-red-500' :
        'bg-blue-50 border-l-4 border-blue-500'
      }`}>
        <div className="flex items-start gap-3">
          <span className="text-xl">
            {type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              type === 'success' ? 'text-green-800' :
              type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {displayMessage}
            </p>
            {remaining !== null && remaining > 0 && (
              <p className={`text-xs mt-1 font-semibold ${
                type === 'success' ? 'text-green-700' :
                type === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                Redirecting in {remaining}…
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 rounded"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
        
        {/* Auto-close progress bar */}
        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full animate-shrink ${
              type === 'success' ? 'bg-green-500' :
              type === 'error' ? 'bg-red-500' :
              'bg-blue-500'
            }`}
            style={{ animation: `shrink ${defaultDuration / 1000}s linear forwards` }}
          />
        </div>
      </div>
    </div>
  )
}



