"use client"

import { useCallback, useEffect, useState } from "react"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import {
  DEFAULT_HOSPITAL_BILLING_SETTINGS,
  enabledPaymentMethods,
  normalizeHospitalBillingSettings,
  type HospitalBillingSettings,
} from "@/shared/utils/billingSettings"
import type { PaymentMethodOption } from "@/features/payments/PaymentMethodSection"

const METHOD_ORDER: PaymentMethodOption[] = ["cash", "upi", "card", "bank_transfer", "cheque"]
const ONLINE_METHODS: PaymentMethodOption[] = ["upi", "card", "bank_transfer"]

export function useHospitalBillingSettings() {
  const { activeHospitalId } = useMultiHospital()
  const [settings, setSettings] = useState<HospitalBillingSettings>(DEFAULT_HOSPITAL_BILLING_SETTINGS)
  const [loading, setLoading] = useState(Boolean(activeHospitalId))

  const reload = useCallback(async () => {
    if (!activeHospitalId) {
      setSettings(DEFAULT_HOSPITAL_BILLING_SETTINGS)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await authedFetchJson<{ settings: HospitalBillingSettings }>(
        `/api/admin/hospital-billing-settings?hospitalId=${encodeURIComponent(activeHospitalId)}`,
        {},
        "Failed to load billing settings"
      )
      setSettings(normalizeHospitalBillingSettings(data.settings))
    } catch {
      setSettings(DEFAULT_HOSPITAL_BILLING_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId])

  useEffect(() => {
    void reload()
  }, [reload])

  const enabled = enabledPaymentMethods(settings)
  const frontDeskPaymentMethods = METHOD_ORDER.filter((method) =>
    enabled.includes(method)
  )
  const onlinePaymentMethods = ONLINE_METHODS.filter((method) => enabled.includes(method))

  return {
    settings,
    loading,
    reload,
    refundsEnabled: settings.refundPolicy !== "disabled",
    frontDeskPaymentMethods:
      frontDeskPaymentMethods.length > 0
        ? frontDeskPaymentMethods
        : (["cash"] as PaymentMethodOption[]),
    onlinePaymentMethods:
      onlinePaymentMethods.length > 0
        ? onlinePaymentMethods
        : (["upi"] as PaymentMethodOption[]),
  }
}
