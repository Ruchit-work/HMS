"use client"

import { useCallback, useEffect, useState } from "react"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import { DEFAULT_HOSPITAL_PRINT_SETTINGS, normalizeHospitalPrintSettings } from "@/shared/utils/printSettings"
import type { HospitalPrintSettings } from "@/types/print"

export function useHospitalPrintSettings() {
  const { activeHospital, activeHospitalId } = useMultiHospital()
  const [settings, setSettings] = useState<HospitalPrintSettings>(() => {
    if (activeHospital?.settings?.print) {
      return normalizeHospitalPrintSettings(activeHospital.settings.print)
    }
    return DEFAULT_HOSPITAL_PRINT_SETTINGS
  })
  const [loading, setLoading] = useState(Boolean(activeHospitalId))

  const reload = useCallback(async () => {
    if (!activeHospitalId) {
      setSettings(DEFAULT_HOSPITAL_PRINT_SETTINGS)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await authedFetchJson<{ settings: HospitalPrintSettings }>(
        `/api/admin/hospital-print-settings?hospitalId=${encodeURIComponent(activeHospitalId)}`,
        {},
        "Failed to load print settings"
      )
      const fetched = normalizeHospitalPrintSettings(data.settings)
      
      // Override empty header/address/phone with activeHospital values if available
      if (activeHospital?.name && fetched.headerTitle === DEFAULT_HOSPITAL_PRINT_SETTINGS.headerTitle) {
        fetched.headerTitle = activeHospital.name
      }
      if (activeHospital?.address && fetched.address === DEFAULT_HOSPITAL_PRINT_SETTINGS.address) {
        fetched.address = activeHospital.address
      }
      if (activeHospital?.phone && fetched.phone === DEFAULT_HOSPITAL_PRINT_SETTINGS.phone) {
        fetched.phone = activeHospital.phone
      }
      if (activeHospital?.email && fetched.email === DEFAULT_HOSPITAL_PRINT_SETTINGS.email) {
        fetched.email = activeHospital.email
      }

      setSettings(fetched)
    } catch {
      setSettings((prev) => ({
        ...DEFAULT_HOSPITAL_PRINT_SETTINGS,
        headerTitle: activeHospital?.name || DEFAULT_HOSPITAL_PRINT_SETTINGS.headerTitle,
        address: activeHospital?.address || DEFAULT_HOSPITAL_PRINT_SETTINGS.address,
        phone: activeHospital?.phone || DEFAULT_HOSPITAL_PRINT_SETTINGS.phone,
        email: activeHospital?.email || DEFAULT_HOSPITAL_PRINT_SETTINGS.email,
        ...prev,
      }))
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId, activeHospital])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    settings,
    loading,
    reload,
  }
}
