"use client"

/**
 * Soft route transition indicator — no full-page spinner.
 * Keeps the app feeling instant during quick navigations.
 */
export default function GlobalLoading() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-transparent"
      role="status"
      aria-label="Loading"
    >
      <div className="h-full w-1/3 animate-[slide-in-right_0.9s_ease-in-out_infinite] bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-500 opacity-90" />
    </div>
  )
}
