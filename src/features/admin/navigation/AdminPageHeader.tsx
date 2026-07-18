import type { ReactNode } from "react"

interface AdminPageHeaderProps {
  title: string
  description?: string
  /** Right side content: filters, dropdowns, action buttons */
  controls?: ReactNode
  /** Tighter CRM-style header (Campaigns, etc.) */
  dense?: boolean
  /**
   * Super Admin HQ pages already render HqPageHeader.
   * When true, only the controls chrome is shown (search, tenant lens).
   */
  chromeOnly?: boolean
}

export default function AdminPageHeader({
  title,
  description,
  controls,
  dense = false,
  chromeOnly = false,
}: AdminPageHeaderProps) {
  if (chromeOnly) {
    if (!controls) return null
    return (
      <div className="mb-2">
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
          {controls}
        </div>
      </div>
    )
  }

  return (
    <div className={dense ? "mb-2" : "mb-3 sm:mb-4"}>
      <div
        className={`border border-slate-200/80 bg-white shadow-sm ${
          dense
            ? "rounded-xl px-3.5 py-2.5 sm:px-4"
            : "rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1
              className={`font-semibold leading-tight tracking-tight text-slate-900 truncate ${
                dense ? "text-base sm:text-lg" : "text-lg sm:text-xl"
              }`}
            >
              {title}
            </h1>
            {description && (
              <p
                className={`mt-0.5 leading-snug text-slate-500 ${
                  dense ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
                }`}
              >
                {description}
              </p>
            )}
          </div>
          {controls && (
            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              {controls}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
