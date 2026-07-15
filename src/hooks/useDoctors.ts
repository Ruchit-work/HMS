"use client"

import { useCallback, useEffect, useState } from "react"
import {
  listActiveDoctors,
  listDoctors,
  subscribeActiveDoctors,
  type DoctorRecord,
} from "@/services/DoctorService"

export type UseDoctorsOptions = {
  /** Subscribe to active doctors in realtime. Default true when activeOnly is true. */
  realtime?: boolean
  /** Only active doctors. Default true. */
  activeOnly?: boolean
  enabled?: boolean
}

/**
 * Load hospital doctors (one-shot or realtime active list).
 * Preserves existing subscribeActiveDoctors / listActiveDoctors behavior.
 */
export function useDoctors(
  hospitalId: string | null | undefined,
  options: UseDoctorsOptions = {}
) {
  const { activeOnly = true, enabled = true } = options
  const realtime = options.realtime ?? activeOnly

  const [doctors, setDoctors] = useState<DoctorRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!hospitalId || !enabled) {
      setDoctors([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = activeOnly
        ? await listActiveDoctors(hospitalId)
        : await listDoctors(hospitalId)
      setDoctors(list)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load doctors"))
    } finally {
      setLoading(false)
    }
  }, [hospitalId, activeOnly, enabled])

  useEffect(() => {
    if (!hospitalId || !enabled) {
      setDoctors([])
      setLoading(false)
      return
    }

    if (realtime && activeOnly) {
      setLoading(true)
      const unsubscribe = subscribeActiveDoctors(
        hospitalId,
        (list) => {
          setDoctors(list)
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
        const list = activeOnly
          ? await listActiveDoctors(hospitalId)
          : await listDoctors(hospitalId)
        if (!cancelled) setDoctors(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load doctors"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hospitalId, enabled, realtime, activeOnly])

  return { doctors, setDoctors, loading, error, refresh }
}

export default useDoctors
