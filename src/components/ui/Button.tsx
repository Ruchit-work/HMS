"use client"

import { ButtonHTMLAttributes, forwardRef } from "react"

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost"
type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white border border-transparent hover:bg-[var(--color-primary-dark)] focus-visible:ring-[var(--color-primary)]",
  secondary:
    "bg-[var(--color-secondary)] text-white border border-transparent hover:bg-[var(--color-secondary-dark)] focus-visible:ring-[var(--color-secondary)]",
  outline:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400",
  danger:
    "bg-[var(--color-error)] text-white border border-transparent hover:bg-red-600 focus-visible:ring-red-500",
  ghost:
    "bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 focus-visible:ring-slate-400",
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-11 px-5 text-sm rounded-xl",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    disabled,
    className = "",
    children,
    type = "button",
    onClick,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={[
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <>
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          <span>{loadingText || children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
})
