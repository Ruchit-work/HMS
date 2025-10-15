"use client"

import { useEffect } from 'react'

interface NotificationProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose: () => void
}

export default function Notification({ type, message, onClose }: NotificationProps) {
  // Auto-close after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 10000) // 10 seconds

    return () => clearTimeout(timer)
  }, [onClose])

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
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
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
            style={{ animation: 'shrink 10s linear forwards' }}
          />
        </div>
      </div>
    </div>
  )
}

