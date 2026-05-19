"use client"

import { InputHTMLAttributes, forwardRef } from "react"

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className = "", id, ...rest },
  ref
) {
  const fieldId = id || (label ? label.replace(/\s+/g, "-").toLowerCase() : undefined)

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={fieldId} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        className={[
          "hms-input w-full",
          error ? "border-red-300 focus:ring-red-400" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
})
