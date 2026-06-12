import {
  bhashSendTemplateMessage,
  getBhashConfirmationApiUrl,
  shouldUseBhashSms,
} from "@/server/bhashWhatsApp"
import { formatWhatsAppRecipient } from "@/utils/campaigns/whatsapp"

/**
 * Bhash utility confirmation template (Templates WA → name: confirmation).
 *
 * API (sendmsg.php):
 * ...&text=confirmation&priority=wa&stype=normal&Params=p1,p2,p3,p4,p5,p6,p7
 *
 * Body:
 * Hello {{1}}, Your appointment has been confirmed {{2}}.
 * Doctor: {{3}} Date: {{4}} Time: {{5}} Appointment ID: {{6}} Payment: {{7}}
 */
export function getBhashConfirmationTemplateName(): string {
  return process.env.BHASHSMS_CONFIRMATION_TEMPLATE?.trim() || "confirmation"
}

export interface BhashConfirmationTemplateParams {
  /** {{1}} Patient name */
  patientName: string
  /** {{2}} e.g. "by our receptionist" */
  confirmedVia: string
  /** {{3}} Doctor name (specialization optional) */
  doctorName: string
  doctorSpecialization?: string
  /** {{4}} Date string (YYYY-MM-DD) or pre-formatted display */
  appointmentDate: string
  /** {{5}} Time string (HH:mm) or pre-formatted display */
  appointmentTime: string
  /** {{6}} */
  appointmentId: string
  /** {{7}} */
  paymentMethod?: string
  paymentAmount?: number
  paymentStatus?: string
}

/** Bhash Params are comma-separated — remove commas from each value. */
export function sanitizeBhashParam(value: string): string {
  return value.replace(/,/g, " ").replace(/\s+/g, " ").trim()
}

function formatDateForTemplate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const formatted = new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    return sanitizeBhashParam(formatted)
  }
  return sanitizeBhashParam(dateStr)
}

function formatTimeForTemplate(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number)
  if (!isNaN(h) && !isNaN(m)) {
    return sanitizeBhashParam(
      new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    )
  }
  return sanitizeBhashParam(timeStr)
}

function formatDoctorForTemplate(name: string, specialization?: string): string {
  const base = name.trim() || "our doctor"
  if (!specialization?.trim()) return sanitizeBhashParam(base)
  return sanitizeBhashParam(`${base} (${specialization.trim()})`)
}

function formatPaymentForTemplate(
  method?: string,
  amount?: number,
  status?: string
): string {
  const paymentMethod = (method || "Cash").trim()
  const paymentAmount = typeof amount === "number" ? amount : 0
  const statusLabel =
    status === "paid" || status === "Paid" ? "Paid" : "Pending"
  return sanitizeBhashParam(
    `${paymentMethod} - Rs ${paymentAmount} - ${statusLabel}`
  )
}

/** Build Params array for Bhash: Params=param1,param2,... */
export function buildBhashConfirmationParams(
  input: BhashConfirmationTemplateParams
): string[] {
  return [
    sanitizeBhashParam(input.patientName.trim() || "Patient"),
    sanitizeBhashParam(input.confirmedVia.trim() || "successfully"),
    formatDoctorForTemplate(input.doctorName, input.doctorSpecialization),
    formatDateForTemplate(input.appointmentDate),
    formatTimeForTemplate(input.appointmentTime),
    sanitizeBhashParam(input.appointmentId || "N/A"),
    formatPaymentForTemplate(
      input.paymentMethod,
      input.paymentAmount,
      input.paymentStatus
    ),
  ]
}

function resolveRecipientPhone(
  to?: string | null,
  fallbackRecipients?: Array<string | null | undefined>
): string | null {
  for (const recipient of [to, ...(fallbackRecipients ?? [])]) {
    if (!recipient) continue
    const formatted = formatWhatsAppRecipient(recipient)
    if (formatted) return formatted.replace(/^whatsapp:/i, "")
  }
  return null
}

/**
 * Sends Bhash utility template when WHATSAPP_PROVIDER=bhashsms and
 * BHASHSMS_CONFIRMATION_TEMPLATE is set. Returns true if sent successfully.
 */
export async function sendBhashConfirmationTemplateIfConfigured(options: {
  to?: string | null
  fallbackRecipients?: Array<string | null | undefined>
  params: BhashConfirmationTemplateParams
}): Promise<boolean> {
  if (!shouldUseBhashSms() || !process.env.BHASHSMS_CONFIRMATION_TEMPLATE) {
    return false
  }

  const recipientPhone = resolveRecipientPhone(options.to, options.fallbackRecipients)
  if (!recipientPhone) return false

  const templateName = getBhashConfirmationTemplateName()
  const templateParams = buildBhashConfirmationParams(options.params)
  const result = await bhashSendTemplateMessage(recipientPhone, templateName, templateParams, {
    apiUrl: getBhashConfirmationApiUrl(),
  })

  console.log("[BhashSMS template]", {
    template: templateName,
    phone: recipientPhone,
    paramCount: templateParams.length,
    params: templateParams,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  })

  return result.success
}
