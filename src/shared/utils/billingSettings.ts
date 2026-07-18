export type RefundPolicy = "disabled" | "manual_approval" | "automatic"

export type PaidAppointmentCancellationPolicy =
  | "disallow"
  | "keep_payment"
  | "create_refund_request"
  | "auto_refund"

export type PaymentMethodKey = "cash" | "upi" | "card" | "bank_transfer" | "cheque"

export interface HospitalBillingSettings {
  refundPolicy: RefundPolicy
  paidAppointmentCancellation: PaidAppointmentCancellationPolicy
  allowPartialPayment: boolean
  minimumAdvancePercent: number
  autoCreateRecheckup: boolean
  recheckupStartsUnpaid: boolean
  defaultRecheckupFee: number
  paymentMethods: Record<PaymentMethodKey, boolean>
  billingOptions: {
    generateTransactionIds: boolean
    requirePaymentNotes: boolean
    allowManualPaymentEntry: boolean
    allowBillingAdjustments: boolean
  }
}

/**
 * Backward-compatible defaults for hospitals created before billing settings
 * existed. Defaults intentionally match the legacy production behaviour.
 */
export const DEFAULT_HOSPITAL_BILLING_SETTINGS: HospitalBillingSettings = {
  refundPolicy: "disabled",
  paidAppointmentCancellation: "keep_payment",
  allowPartialPayment: true,
  minimumAdvancePercent: 20,
  autoCreateRecheckup: true,
  recheckupStartsUnpaid: true,
  defaultRecheckupFee: 0,
  paymentMethods: {
    cash: true,
    upi: true,
    card: true,
    bank_transfer: false,
    cheque: false,
  },
  billingOptions: {
    generateTransactionIds: true,
    requirePaymentNotes: false,
    allowManualPaymentEntry: true,
    allowBillingAdjustments: false,
  },
}

const REFUND_POLICIES = new Set<RefundPolicy>(["disabled", "manual_approval", "automatic"])
const CANCELLATION_POLICIES = new Set<PaidAppointmentCancellationPolicy>([
  "disallow",
  "keep_payment",
  "create_refund_request",
  "auto_refund",
])

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/** Merge persisted partial/legacy settings with safe defaults. */
export function normalizeHospitalBillingSettings(value: unknown): HospitalBillingSettings {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const methods =
    input.paymentMethods && typeof input.paymentMethods === "object"
      ? (input.paymentMethods as Record<string, unknown>)
      : {}
  const options =
    input.billingOptions && typeof input.billingOptions === "object"
      ? (input.billingOptions as Record<string, unknown>)
      : {}

  const refundPolicy = REFUND_POLICIES.has(input.refundPolicy as RefundPolicy)
    ? (input.refundPolicy as RefundPolicy)
    : DEFAULT_HOSPITAL_BILLING_SETTINGS.refundPolicy
  const paidAppointmentCancellation = CANCELLATION_POLICIES.has(
    input.paidAppointmentCancellation as PaidAppointmentCancellationPolicy
  )
    ? (input.paidAppointmentCancellation as PaidAppointmentCancellationPolicy)
    : DEFAULT_HOSPITAL_BILLING_SETTINGS.paidAppointmentCancellation

  return {
    refundPolicy,
    paidAppointmentCancellation,
    allowPartialPayment: asBoolean(
      input.allowPartialPayment,
      DEFAULT_HOSPITAL_BILLING_SETTINGS.allowPartialPayment
    ),
    minimumAdvancePercent: Math.min(
      100,
      Math.max(
        0,
        asFiniteNumber(
          input.minimumAdvancePercent,
          DEFAULT_HOSPITAL_BILLING_SETTINGS.minimumAdvancePercent
        )
      )
    ),
    autoCreateRecheckup: asBoolean(
      input.autoCreateRecheckup,
      DEFAULT_HOSPITAL_BILLING_SETTINGS.autoCreateRecheckup
    ),
    recheckupStartsUnpaid: asBoolean(
      input.recheckupStartsUnpaid,
      DEFAULT_HOSPITAL_BILLING_SETTINGS.recheckupStartsUnpaid
    ),
    defaultRecheckupFee: Math.max(
      0,
      asFiniteNumber(
        input.defaultRecheckupFee,
        DEFAULT_HOSPITAL_BILLING_SETTINGS.defaultRecheckupFee
      )
    ),
    paymentMethods: {
      cash: asBoolean(methods.cash, DEFAULT_HOSPITAL_BILLING_SETTINGS.paymentMethods.cash),
      upi: asBoolean(methods.upi, DEFAULT_HOSPITAL_BILLING_SETTINGS.paymentMethods.upi),
      card: asBoolean(methods.card, DEFAULT_HOSPITAL_BILLING_SETTINGS.paymentMethods.card),
      bank_transfer: asBoolean(
        methods.bank_transfer,
        DEFAULT_HOSPITAL_BILLING_SETTINGS.paymentMethods.bank_transfer
      ),
      cheque: asBoolean(methods.cheque, DEFAULT_HOSPITAL_BILLING_SETTINGS.paymentMethods.cheque),
    },
    billingOptions: {
      generateTransactionIds: asBoolean(
        options.generateTransactionIds,
        DEFAULT_HOSPITAL_BILLING_SETTINGS.billingOptions.generateTransactionIds
      ),
      requirePaymentNotes: asBoolean(
        options.requirePaymentNotes,
        DEFAULT_HOSPITAL_BILLING_SETTINGS.billingOptions.requirePaymentNotes
      ),
      allowManualPaymentEntry: asBoolean(
        options.allowManualPaymentEntry,
        DEFAULT_HOSPITAL_BILLING_SETTINGS.billingOptions.allowManualPaymentEntry
      ),
      allowBillingAdjustments: asBoolean(
        options.allowBillingAdjustments,
        DEFAULT_HOSPITAL_BILLING_SETTINGS.billingOptions.allowBillingAdjustments
      ),
    },
  }
}

export function enabledPaymentMethods(
  settings: HospitalBillingSettings
): PaymentMethodKey[] {
  return (Object.keys(settings.paymentMethods) as PaymentMethodKey[]).filter(
    (method) => settings.paymentMethods[method]
  )
}

/** Advance / partial amount from fee using hospital minimumAdvancePercent. */
export function computeAdvanceAmount(
  totalFee: number,
  settings: Pick<HospitalBillingSettings, "allowPartialPayment" | "minimumAdvancePercent">
): number {
  const fee = Math.max(0, Number(totalFee) || 0)
  if (!settings.allowPartialPayment) return fee
  const percent = Math.min(100, Math.max(0, Number(settings.minimumAdvancePercent) || 0))
  if (percent <= 0) return 0
  if (percent >= 100) return fee
  return Math.ceil((fee * percent) / 100)
}

export function validateHospitalBillingSettings(
  settings: HospitalBillingSettings
): string | null {
  if (settings.minimumAdvancePercent < 0 || settings.minimumAdvancePercent > 100) {
    return "Minimum advance percentage must be between 0 and 100."
  }
  if (settings.defaultRecheckupFee < 0) {
    return "Default recheckup fee cannot be negative."
  }
  if (enabledPaymentMethods(settings).length === 0) {
    return "Enable at least one accepted payment method."
  }
  if (
    settings.refundPolicy === "disabled" &&
    (settings.paidAppointmentCancellation === "create_refund_request" ||
      settings.paidAppointmentCancellation === "auto_refund")
  ) {
    return "Enable refunds before selecting a refund-based paid cancellation policy."
  }
  if (
    settings.refundPolicy === "manual_approval" &&
    settings.paidAppointmentCancellation === "auto_refund"
  ) {
    return "Automatic cancellation refunds require Automatic Refund policy."
  }
  if (
    settings.refundPolicy === "automatic" &&
    settings.paidAppointmentCancellation === "create_refund_request"
  ) {
    return "Manual refund requests require Manual Approval policy."
  }
  return null
}
