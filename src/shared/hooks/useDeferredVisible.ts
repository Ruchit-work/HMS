"use client"

import { useEffect, useState } from "react"

/**
 * Delays showing a loading UI until `delayMs` has passed while `active` is true.
 * Prevents flash-of-spinner for fast operations (<300–500ms).
 */
export function useDeferredVisible(active: boolean, delayMs = 350): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const id = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(id)
  }, [active, delayMs])

  return visible
}
