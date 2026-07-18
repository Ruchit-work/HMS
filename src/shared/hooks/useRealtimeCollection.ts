"use client"

import { useEffect, useState } from "react"
import type { Unsubscribe } from "firebase/firestore"

export type UseRealtimeCollectionOptions = {
  /** When false, skip subscription. Default true. */
  enabled?: boolean
}

/**
 * Generic realtime Firestore subscription hook.
 * Pass a subscribe factory that returns an unsubscribe function.
 */
export function useRealtimeCollection<T>(
  key: string | null | undefined,
  subscribe: ((onData: (items: T[]) => void, onError?: (error: Error) => void) => Unsubscribe) | null,
  options: UseRealtimeCollectionOptions = {}
) {
  const { enabled = true } = options
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(Boolean(enabled && key && subscribe))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !key || !subscribe) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribe(
      (next) => {
        setItems(next)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [key, enabled, subscribe])

  return { items, setItems, loading, error }
}

export default useRealtimeCollection
