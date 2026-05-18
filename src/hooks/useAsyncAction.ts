"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Wraps async handlers so they only run once until finished (prevents double-click issues).
 */
export function useAsyncAction<T extends unknown[]>(
  action: (...args: T) => void | Promise<void>
) {
  const [loading, setLoading] = useState(false)
  const inFlightRef = useRef(false)

  const run = useCallback(
    async (...args: T) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setLoading(true)
      try {
        await Promise.resolve(action(...args))
      } finally {
        inFlightRef.current = false
        setLoading(false)
      }
    },
    [action]
  )

  return { run, loading, isRunning: loading }
}
