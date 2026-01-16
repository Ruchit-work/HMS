import { useEffect, useRef } from 'react'

/**
 * Hook to handle Enter key submission in forms
 * @param onSubmit - Function to call when Enter is pressed
 * @param enabled - Whether the hook is enabled
 * @param dependencies - Dependencies that should trigger re-registration
 */
export function useEnterKeySubmit(
  onSubmit: () => void,
  enabled: boolean = true,
  dependencies: any[] = []
) {
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on Enter key
      if (e.key !== 'Enter') return

      // Don't trigger if user is typing in textarea or if Ctrl/Cmd+Enter (for new lines)
      const target = e.target as HTMLElement
      if (
        target.tagName === 'TEXTAREA' ||
        e.ctrlKey ||
        e.metaKey ||
        target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text' && !target.closest('form')
      ) {
        return
      }

      // Don't trigger if user is in a modal or dropdown
      if (target.closest('[role="dialog"]') || target.closest('[data-dropdown-menu]')) {
        return
      }

      // Find the form element
      const form = target.closest('form')
      if (!form) return

      // Check if form has a submit button that's not disabled
      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement
      if (submitButton && !submitButton.disabled) {
        e.preventDefault()
        onSubmit()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
    // We intentionally spread dynamic dependencies here; eslint can't analyze it statically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onSubmit, ...dependencies])

  return formRef
}

