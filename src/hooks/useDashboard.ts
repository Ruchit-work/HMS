"use client"

import { useCallback, useEffect, useState } from "react"
import { listAppointments } from "@/services/AppointmentService"
import { listPatients } from "@/services/PatientService"
import type { AppointmentRecord } from "@/services/AppointmentService"
import type { PatientRecord } from "@/services/PatientService"
import {
  filterAppointmentsByBranch,
  filterPatientsByBranch,
} from "@/utils/branch/branchFilters"

export type UseDashboardOptions = {
  includePatients?: boolean
  includeAppointments?: boolean
  /** Optional branch filter applied client-side (same as analytics tabs). */
  branchId?: string | null
  enabled?: boolean
}

/**
 * One-shot dashboard / analytics data load (patients + appointments).
 * Matches the analytics tab fetch pattern without changing filter math in callers.
 */
export function useDashboard(
  hospitalId: string | null | undefined,
  options: UseDashboardOptions = {}
) {
  const {
    includePatients = true,
    includeAppointments = true,
    branchId = null,
    enabled = true,
  } = options

  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!hospitalId || !enabled) {
      setPatients([])
      setAppointments([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [patientList, appointmentList] = await Promise.all([
        includePatients ? listPatients(hospitalId) : Promise.resolve([] as PatientRecord[]),
        includeAppointments
          ? listAppointments(hospitalId)
          : Promise.resolve([] as AppointmentRecord[]),
      ])

      let nextPatients = filterPatientsByBranch(
        patientList as Array<PatientRecord & { defaultBranchId?: string }>,
        branchId,
        { unassigned: "exclude" }
      ) as PatientRecord[]
      let nextAppointments = filterAppointmentsByBranch(
        appointmentList as Array<AppointmentRecord & { branchId?: string }>,
        branchId,
        { unassigned: "exclude" }
      ) as AppointmentRecord[]

      setPatients(nextPatients)
      setAppointments(nextAppointments)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load dashboard data"))
    } finally {
      setLoading(false)
    }
  }, [hospitalId, includePatients, includeAppointments, branchId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    patients,
    appointments,
    loading,
    error,
    refresh,
  }
}

export default useDashboard
