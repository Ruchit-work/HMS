"use client"

// ============================================================================
// LoadingSpinner — reserved for essential waits (auth init, long jobs).
// Prefer TabSkeleton / table skeletons for dashboard content.
// ============================================================================

interface LoadingSpinnerProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
  /** When true, compact section placeholder — no full-screen takeover */
  inline?: boolean
}

export function LoadingSpinner({ message = "Loading...", size = "md", className = "", inline = false }: LoadingSpinnerProps) {
  if (inline) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 py-10 ${className}`} role="status" aria-label={message}>
        <div className="h-2 w-36 animate-pulse rounded-full bg-slate-200" />
        <div className="h-2 w-24 animate-pulse rounded-full bg-slate-100" />
        {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      </div>
    )
  }

  const sizeMap = {
    sm: "32px",
    md: "48px",
    lg: "56px",
  }

  const spinnerSize = sizeMap[size]

  return (
    <div className={`min-h-screen flex items-center justify-center bg-slate-50 ${className}`} role="status" aria-label={message}>
      <div className="text-center">
        <div className="loading mx-auto" style={{ width: spinnerSize, height: spinnerSize }}>
          <svg width="64px" height="48px" viewBox="0 0 64 48" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
            <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="back"></polyline>
            <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="front"></polyline>
          </svg>
        </div>
        {message && <p className="mt-4 text-sm text-slate-500">{message}</p>}
      </div>
    </div>
  )
}

export function InlineSpinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeMap = {
    sm: "24px",
    md: "32px",
    lg: "40px",
  }

  const spinnerSize = sizeMap[size]

  return (
    <div className={`loading ${className}`} style={{ width: spinnerSize, height: spinnerSize }} role="status" aria-label="Loading">
      <svg width="64px" height="48px" viewBox="0 0 64 48" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
        <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="back"></polyline>
        <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="front"></polyline>
      </svg>
    </div>
  )
}

export default LoadingSpinner

// SuccessToast lives in shared — re-exported for backward-compatible imports
export { SuccessToast } from "@/shared/components/SuccessToast"
