"use client"

import { useCallback, useEffect, useState } from "react"
import {
  listAppointments,
  listAppointmentsByDoctor,
  subscribeDoctorAppointments,
  type AppointmentRecord,
} from "@/services/AppointmentService"

export type UseAppointmentsOptions = {
  doctorId?: string | null
  branchId?: string | null
  /** Realtime subscription for doctor appointments. Default false. */
  realtime?: boolean
  /** Drop whatsapp_pending rows (doctor queue pattern). Default false. */
  excludeWhatsAppPending?: boolean
  enabled?: boolean
}

function applyWhatsAppFilter(
  list: AppointmentRecord[],
  exclude: boolean
): AppointmentRecord[] {
  if (!exclude) return list
  return list.filter((apt) => {
    const row = apt as AppointmentRecord & { whatsappPending?: boolean; status?: string }
    return row.status !== "whatsapp_pending" && !row.whatsappPending
  })
}

/**
 * Load hospital appointments (full list, by doctor, or realtime doctor queue).
 */
export function useAppointments(
  hospitalId: string | null | undefined,
  options: UseAppointmentsOptions = {}
) {
  const {
    doctorId = null,
    branchId = null,
    realtime = false,
    excludeWhatsAppPending = false,
    enabled = true,
  } = options

  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!hospitalId || !enabled) {
      setAppointments([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      let list: AppointmentRecord[]
      if (doctorId) {
        list = await listAppointmentsByDoctor(hospitalId, doctorId, { branchId })
      } else {
        list = await listAppointments(hospitalId)
      }
      setAppointments(applyWhatsAppFilter(list, excludeWhatsAppPending))
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load appointments"))
    } finally {
      setLoading(false)
    }
  }, [hospitalId, doctorId, branchId, excludeWhatsAppPending, enabled])

  useEffect(() => {
    if (!hospitalId || !enabled) {
      setAppointments([])
      setLoading(false)
      return
    }

    if (realtime && doctorId) {
      setLoading(true)
      const unsubscribe = subscribeDoctorAppointments(
        hospitalId,
        doctorId,
        (list) => {
          setAppointments(applyWhatsAppFilter(list, excludeWhatsAppPending))
          setLoading(false)
        },
        {
          branchId,
          onError: (err) => {
            setError(err)
            setLoading(false)
          },
        }
      )
      return () => unsubscribe()
    }

    void refresh()
  }, [hospitalId, doctorId, branchId, realtime, excludeWhatsAppPending, enabled, refresh])

  return { appointments, setAppointments, loading, error, refresh }
}

export default useAppointments
