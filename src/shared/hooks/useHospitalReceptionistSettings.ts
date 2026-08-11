"use client"

import { useCallback, useEffect, useState } from "react"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import {
  DEFAULT_RECEPTIONIST_SETTINGS,
  mergeReceptionistSettings,
} from "@/shared/constants/receptionistDefaults"
import type { HospitalReceptionistSettings } from "@/types/hospital"

// Module-level in-memory cache for hospital receptionist settings to eliminate re-fetching on modal open
const settingsCache = new Map<string, HospitalReceptionistSettings>()

export function clearHospitalReceptionistSettingsCache(hospitalId?: string) {
  if (hospitalId) {
    settingsCache.delete(hospitalId)
  } else {
    settingsCache.clear()
  }
}

export function useHospitalReceptionistSettings() {
  const { activeHospitalId } = useMultiHospital()

  // Synchronously initialize from cache if available for the active hospital
  const initialSettings = activeHospitalId
    ? settingsCache.get(activeHospitalId) ?? null
    : DEFAULT_RECEPTIONIST_SETTINGS

  const [settings, setSettings] = useState<HospitalReceptionistSettings | null>(initialSettings)
  const [loading, setLoading] = useState<boolean>(initialSettings === null)

  const reload = useCallback(async (force = false) => {
    if (!activeHospitalId) {
      setSettings(DEFAULT_RECEPTIONIST_SETTINGS)
      setLoading(false)
      return
    }

    if (!force) {
      const cached = settingsCache.get(activeHospitalId)
      if (cached) {
        setSettings(cached)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    try {
      const data = await authedFetchJson<{ settings: HospitalReceptionistSettings }>(
        `/api/admin/hospital-receptionist-settings?hospitalId=${encodeURIComponent(activeHospitalId)}`,
        {},
        "Failed to load receptionist settings"
      )
      const merged = mergeReceptionistSettings(data?.settings)
      settingsCache.set(activeHospitalId, merged)
      setSettings(merged)
    } catch {
      const fallback = mergeReceptionistSettings(null)
      settingsCache.set(activeHospitalId, fallback)
      setSettings(fallback)
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId])

  useEffect(() => {
    if (!activeHospitalId) {
      setSettings(DEFAULT_RECEPTIONIST_SETTINGS)
      setLoading(false)
      return
    }

    const cached = settingsCache.get(activeHospitalId)
    if (cached) {
      setSettings(cached)
      setLoading(false)
      return
    }

    void reload()
  }, [activeHospitalId, reload])

  const isResolved = !loading && settings !== null
  const resolvedSettings = settings ?? DEFAULT_RECEPTIONIST_SETTINGS

  return {
    settings: resolvedSettings,
    rawSettings: settings,
    loading,
    isResolved,
    reload: () => reload(true),
    interfaceMode: resolvedSettings.interfaceMode,
    enabledModules: resolvedSettings.enabledModules,
    addPatientFields: isResolved ? resolvedSettings.formFields.addPatient : null,
    bookAppointmentFields: isResolved ? resolvedSettings.formFields.bookAppointment : null,
    resolvedAddPatientFields: resolvedSettings.formFields.addPatient,
    resolvedBookAppointmentFields: resolvedSettings.formFields.bookAppointment,
  }
}
