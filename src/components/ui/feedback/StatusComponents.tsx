"use client"

// ============================================================================
// LoadingSpinner - Full-screen loading indicator with message
// ============================================================================

interface LoadingSpinnerProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ message = "Loading...", size = "lg", className = "" }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: "32px",
    md: "48px",
    lg: "64px"
  }

  const spinnerSize = sizeMap[size]

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${className}`}>
      <div className="text-center">
        <div className="loading mx-auto" style={{ width: spinnerSize, height: spinnerSize }}>
          <svg width="64px" height="48px" viewBox="0 0 64 48" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
            <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="back"></polyline>
            <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="front"></polyline>
          </svg>
        </div>
        {message && <p className="mt-4 text-gray-600">{message}</p>}
      </div>
    </div>
  )
}

// Inline spinner component for use in smaller contexts
export function InlineSpinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg", className?: string }) {
  const sizeMap = {
    sm: "32px",
    md: "48px",
    lg: "64px"
  }

  const spinnerSize = sizeMap[size]

  return (
    <div className={`loading ${className}`} style={{ width: spinnerSize, height: spinnerSize }}>
      <svg width="64px" height="48px" viewBox="0 0 64 48" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
        <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="back"></polyline>
        <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="front"></polyline>
      </svg>
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

