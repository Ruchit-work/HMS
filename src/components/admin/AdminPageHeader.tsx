import type { ReactNode } from "react"

interface AdminPageHeaderProps {
  title: string
  description?: string
  /** Right side content: filters, dropdowns, action buttons */
  controls?: ReactNode
}

export default function AdminPageHeader({ title, description, controls }: AdminPageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 sm:rounded-2xl sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900 leading-tight truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          {controls && (
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3">
              {controls}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

