import { useEffect, useRef } from 'react'

/**
 * Hook to auto-save form data to localStorage
 * @param data - The data to save
 * @param key - localStorage key
 * @param enabled - Whether auto-save is enabled
 * @param debounceMs - Debounce delay in milliseconds (default: 1000)
 */
export function useAutoSave<T>(
  data: T,
  key: string,
  enabled: boolean = true,
  debounceMs: number = 1000
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (!enabled) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data))
      } catch (error) {
        console.warn('Failed to save draft to localStorage:', error)
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, key, enabled, debounceMs])

  // Load draft on mount
  const loadDraft = (): T | null => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        return JSON.parse(saved) as T
      }
    } catch (error) {
      console.warn('Failed to load draft from localStorage:', error)
    }
    return null
  }

  // Clear draft
  const clearDraft = () => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear draft from localStorage:', error)
    }
  }

  return { loadDraft, clearDraft }
}

