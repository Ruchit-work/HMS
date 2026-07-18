"use client"

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"

export interface FormFieldProps {
  label?: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`rx-form-field ${className}`.trim()}>
      {label ? (
        <label htmlFor={htmlFor} className="rx-form-label">
          {label}
          {required ? <span className="rx-required">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="rx-form-error-text" role="alert">
          <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="rx-form-helper">{hint}</p>
      ) : null}
    </div>
  )
}

export interface FormErrorBannerProps {
  message: string
  onDismiss?: () => void
}

export function FormErrorBanner({ message, onDismiss }: FormErrorBannerProps) {
  return (
    <div className="rx-form-error-banner mb-5" role="alert">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500">
          <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-red-800">{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export function FormActions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rx-form-actions ${className}`.trim()}>{children}</div>
}

export const FormInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(
  function FormInput({ className = "", error, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={["rx-form-input", error ? "rx-form-input--error" : "", className].filter(Boolean).join(" ")}
        {...rest}
      />
    )
  }
)

export const FormSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function FormSelect({ className = "", ...rest }, ref) {
    return <select ref={ref} className={["rx-form-select", className].filter(Boolean).join(" ")} {...rest} />
  }
)

export const FormTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
>(function FormTextarea({ className = "", error, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={["rx-form-textarea", error ? "rx-form-textarea--error" : "", className].filter(Boolean).join(" ")}
      {...rest}
    />
  )
})
