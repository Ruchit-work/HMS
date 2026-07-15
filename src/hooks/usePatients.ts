"use client"

import { useCallback, useEffect, useState } from "react"
import {
  listBookablePatients,
  listPatients,
  subscribePatients,
  type PatientRecord,
} from "@/services/PatientService"

export type UsePatientsOptions = {
  /** status in ["active","inactive"] — booking UIs. Default false. */
  bookable?: boolean
  /** Realtime subscription. Default false (one-shot list). */
  realtime?: boolean
  enabled?: boolean
}

/**
 * Load hospital patients (bookable list, full list, or realtime).
 */
export function usePatients(
  hospitalId: string | null | undefined,
  options: UsePatientsOptions = {}
) {
  const { bookable = false, realtime = false, enabled = true } = options

  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!hospitalId || !enabled) {
      setPatients([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = bookable
        ? await listBookablePatients(hospitalId)
        : await listPatients(hospitalId)
      setPatients(list)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load patients"))
    } finally {
      setLoading(false)
    }
  }, [hospitalId, bookable, enabled])

  useEffect(() => {
    if (!hospitalId || !enabled) {
      setPatients([])
      setLoading(false)
      return
    }

    if (realtime) {
      setLoading(true)
      const unsubscribe = subscribePatients(
        hospitalId,
        (list) => {
          setPatients(list)
          setLoading(false)
        },
        (err) => {
          setError(err)
          setLoading(false)
        }
      )
      return () => unsubscribe()
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = bookable
          ? await listBookablePatients(hospitalId)
          : await listPatients(hospitalId)
        if (!cancelled) setPatients(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load patients"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hospitalId, enabled, realtime, bookable])

  return { patients, setPatients, loading, error, refresh }
}

export default usePatients
