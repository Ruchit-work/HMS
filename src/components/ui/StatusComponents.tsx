"use client"

// ============================================================================
// LoadingSpinner - Full-screen loading indicator with message
// ============================================================================

interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  )
}

// Default export for backward compatibility
export default LoadingSpinner

// ============================================================================
// SuccessToast - Success notification toast with auto-close
// ============================================================================

interface SuccessToastProps {
  message: string
  onClose: () => void
  className?: string
}

export function SuccessToast({ message, onClose, className = '' }: SuccessToastProps) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center space-x-2 rounded-lg bg-emerald-500 px-6 py-3 text-white shadow-lg animate-pulse ${className}`}
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-emerald-200 hover:text-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

