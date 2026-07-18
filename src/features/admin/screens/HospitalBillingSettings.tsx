"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CreditCard, Info, RotateCcw, Save, Wallet } from "lucide-react"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import { Button } from "@/shared/components"
import {
  DEFAULT_HOSPITAL_BILLING_SETTINGS,
  enabledPaymentMethods,
  normalizeHospitalBillingSettings,
  validateHospitalBillingSettings,
  type HospitalBillingSettings,
  type PaidAppointmentCancellationPolicy,
  type PaymentMethodKey,
  type RefundPolicy,
} from "@/shared/utils/billingSettings"

type Notify = (type: "success" | "error", message: string) => void

const REFUND_OPTIONS: Array<{ value: RefundPolicy; title: string; description: string }> = [
  {
    value: "disabled",
    title: "Refunds Disabled",
    description: "Hide every refund control and reject refund APIs with a hospital policy message.",
  },
  {
    value: "manual_approval",
    title: "Manual Approval",
    description: "Patient or staff creates a refund request. Hospital Admin must approve before revenue is adjusted.",
  },
  {
    value: "automatic",
    title: "Automatic Refund",
    description: "Paid cancellations that opt into auto-refund are processed immediately and revenue is adjusted.",
  },
]

const CANCEL_OPTIONS: Array<{
  value: PaidAppointmentCancellationPolicy
  title: string
  description: string
}> = [
  {
    value: "disallow",
    title: "Do Not Allow Cancellation",
    description: 'Show: "This appointment has already been paid and cannot be cancelled."',
  },
  {
    value: "keep_payment",
    title: "Cancel & Keep Payment",
    description: "Appointment becomes cancelled. Payment stays paid and revenue remains (non-refundable fee).",
  },
  {
    value: "create_refund_request",
    title: "Cancel & Create Refund Request",
    description: "Appointment is marked for refund workflow. Revenue adjusts only after admin approval.",
  },
  {
    value: "auto_refund",
    title: "Cancel & Auto Refund",
    description: "Cancellation immediately refunds payment and removes the amount from revenue.",
  },
]

const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
}

function RadioCard({
  name,
  value,
  checked,
  title,
  description,
  onChange,
}: {
  name: string
  value: string
  checked: boolean
  title: string
  description: string
  onChange: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
        checked
          ? "border-cyan-400 bg-cyan-50/70 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <input
        type="radio"
        className="mt-1"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </label>
  )
}

function ToggleRow({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean
  title: string
  description: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof CreditCard
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="hms-content-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export default function HospitalBillingSettings({ onNotify }: { onNotify: Notify }) {
  const { activeHospitalId, activeHospital, isSuperAdmin } = useMultiHospital()
  const [settings, setSettings] = useState<HospitalBillingSettings>(DEFAULT_HOSPITAL_BILLING_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const hospitalLabel = activeHospital?.name || activeHospitalId || "Selected hospital"

  const load = useCallback(async () => {
    if (!activeHospitalId) {
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
      setDirty(false)
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Failed to load billing settings")
      setSettings(DEFAULT_HOSPITAL_BILLING_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId, onNotify])

  useEffect(() => {
    void load()
  }, [load])

  const update = <K extends keyof HospitalBillingSettings>(key: K, value: HospitalBillingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const validationError = useMemo(() => validateHospitalBillingSettings(settings), [settings])

  const handleSave = async () => {
    if (!activeHospitalId) return
    if (validationError) {
      onNotify("error", validationError)
      return
    }
    setSaving(true)
    try {
      await authedFetchJson(
        "/api/admin/hospital-billing-settings",
        {
          method: "PUT",
          body: JSON.stringify({ hospitalId: activeHospitalId, settings }),
        },
        "Failed to save billing settings"
      )
      setDirty(false)
      onNotify("success", "Billing & Payment settings saved for this hospital.")
    } catch (error) {
      onNotify("error", error instanceof Error ? error.message : "Failed to save billing settings")
    } finally {
      setSaving(false)
    }
  }

  if (!activeHospitalId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Select a hospital before editing Billing & Payment Settings.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
            Hospital Settings · Billing & Payment
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Financial policies for {hospitalLabel}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            These rules control refunds, paid cancellations, advances, recheckups, and accepted payment methods for this
            hospital only. {isSuperAdmin ? "You are editing as Platform Super Admin for the selected tenant." : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} loading={saving} disabled={loading || !dirty}>
            <Save className="h-3.5 w-3.5" />
            Save settings
          </Button>
        </div>
      </div>

      {validationError ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <SectionCard
            icon={RotateCcw}
            title="Refund Policy"
            description="Configure how this hospital handles refunds."
          >
            <div className="grid gap-3 lg:grid-cols-3">
              {REFUND_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="refundPolicy"
                  value={option.value}
                  checked={settings.refundPolicy === option.value}
                  title={option.title}
                  description={option.description}
                  onChange={() => update("refundPolicy", option.value)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            icon={Wallet}
            title="Paid Appointment Cancellation"
            description="Choose what should happen when a paid appointment is cancelled."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {CANCEL_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="paidAppointmentCancellation"
                  value={option.value}
                  checked={settings.paidAppointmentCancellation === option.value}
                  title={option.title}
                  description={option.description}
                  onChange={() => update("paidAppointmentCancellation", option.value)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            icon={CreditCard}
            title="Advance Payment"
            description="Control whether partial / advance collections are allowed."
          >
            <ToggleRow
              checked={settings.allowPartialPayment}
              title="Allow Partial Payment"
              description="When enabled, front desk can collect a minimum advance instead of the full amount."
              onChange={(next) => update("allowPartialPayment", next)}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="block text-sm font-semibold text-slate-900">Minimum Advance %</label>
              <p className="mt-0.5 text-xs text-slate-500">Required when partial payment is enabled. Range 0–100.</p>
              <input
                type="number"
                min={0}
                max={100}
                disabled={!settings.allowPartialPayment}
                value={settings.minimumAdvancePercent}
                onChange={(e) => update("minimumAdvancePercent", Number(e.target.value))}
                className="mt-2 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={Info}
            title="Recheckup Policy"
            description="Defaults for auto-created recheckup appointments."
          >
            <ToggleRow
              checked={settings.autoCreateRecheckup}
              title="Auto Create Recheckup"
              description="Allow doctors to auto-create a follow-up appointment from the consultation workflow."
              onChange={(next) => update("autoCreateRecheckup", next)}
            />
            <ToggleRow
              checked={settings.recheckupStartsUnpaid}
              title="Recheckup Starts As Unpaid"
              description="Recommended ON. Recheckups should not contribute to revenue until reception collects payment."
              onChange={(next) => update("recheckupStartsUnpaid", next)}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="block text-sm font-semibold text-slate-900">Default Recheckup Fee</label>
              <p className="mt-0.5 text-xs text-slate-500">
                Used when a recheckup fee is not taken from the doctor profile. Set 0 to bill only the doctor fee.
              </p>
              <input
                type="number"
                min={0}
                value={settings.defaultRecheckupFee}
                onChange={(e) => update("defaultRecheckupFee", Number(e.target.value))}
                className="mt-2 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={CreditCard}
            title="Accepted Payment Methods"
            description="Only enabled methods appear in booking and collection screens."
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(METHOD_LABELS) as PaymentMethodKey[]).map((method) => (
                <ToggleRow
                  key={method}
                  checked={settings.paymentMethods[method]}
                  title={METHOD_LABELS[method]}
                  description={
                    method === "bank_transfer" || method === "cheque"
                      ? "Future-ready for offline / gateway settlement."
                      : "Available for front-desk collection."
                  }
                  onChange={(next) =>
                    update("paymentMethods", {
                      ...settings.paymentMethods,
                      [method]: next,
                    })
                  }
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Currently enabled: {enabledPaymentMethods(settings).map((m) => METHOD_LABELS[m]).join(", ") || "None"}
            </p>
          </SectionCard>

          <SectionCard
            icon={Wallet}
            title="Billing Options"
            description="Operational controls for invoices and payment capture."
          >
            <ToggleRow
              checked={settings.billingOptions.generateTransactionIds}
              title="Generate Transaction IDs"
              description="Automatically create transaction references when payment is recorded."
              onChange={(next) =>
                update("billingOptions", {
                  ...settings.billingOptions,
                  generateTransactionIds: next,
                })
              }
            />
            <ToggleRow
              checked={settings.billingOptions.requirePaymentNotes}
              title="Require Payment Notes"
              description="Require a note when recording a payment (useful for audits)."
              onChange={(next) =>
                update("billingOptions", {
                  ...settings.billingOptions,
                  requirePaymentNotes: next,
                })
              }
            />
            <ToggleRow
              checked={settings.billingOptions.allowManualPaymentEntry}
              title="Allow Manual Payment Entry"
              description="Allow reception to record walk-in / offline payments from Billing."
              onChange={(next) =>
                update("billingOptions", {
                  ...settings.billingOptions,
                  allowManualPaymentEntry: next,
                })
              }
            />
            <ToggleRow
              checked={settings.billingOptions.allowBillingAdjustments}
              title="Allow Billing Adjustments"
              description="Permit discretionary amount adjustments on invoices."
              onChange={(next) =>
                update("billingOptions", {
                  ...settings.billingOptions,
                  allowBillingAdjustments: next,
                })
              }
            />
          </SectionCard>
        </>
      )}
    </div>
  )
}
