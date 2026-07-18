import {
  bhashSendMediaTemplate,
  bhashSendUtilityTemplate,
  shouldUseBhashSms,
} from "@/server/bhashWhatsApp"
import {
  sanitizeBhashParam,
  type BhashConfirmationTemplateParams,
} from "@/server/bhashAppointmentTemplate"
import { formatWhatsAppRecipient } from "@/shared/utils/campaigns/whatsapp"

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

async function sendUtilityTemplate(options: {
  to?: string | null
  fallbackRecipients?: Array<string | null | undefined>
  templateEnvKey: string
  defaultTemplateName: string
  params: string[]
  logLabel: string
}): Promise<boolean> {
  if (!shouldUseBhashSms()) return false

  const recipientPhone = resolveRecipientPhone(options.to, options.fallbackRecipients)
  if (!recipientPhone) return false

  const templateName =
    process.env[options.templateEnvKey]?.trim() || options.defaultTemplateName

  const result = await bhashSendUtilityTemplate(
    recipientPhone,
    templateName,
    options.params
  )

  console.log(`[BhashSMS ${options.logLabel}]`, {
    api: "sendmsgutil.php",
    template: templateName,
    phone: recipientPhone,
    paramCount: options.params.length,
    params: options.params,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  })

  return result.success
}

/** {{1}} name {{2}} doctor {{3}} date {{4}} time */
export async function sendBhashReminderTemplateIfConfigured(options: {
  to?: string | null
  patientName: string
  doctorName: string
  appointmentDate: string
  appointmentTime: string
}): Promise<boolean> {
  return sendUtilityTemplate({
    to: options.to,
    templateEnvKey: "BHASHSMS_REMINDER_TEMPLATE",
    defaultTemplateName: "appointment_reminder",
    logLabel: "reminder",
    params: [
      sanitizeBhashParam(options.patientName.trim() || "Patient"),
      sanitizeBhashParam(options.doctorName.trim() || "Doctor"),
      formatDateForTemplate(options.appointmentDate),
      formatTimeForTemplate(options.appointmentTime),
    ],
  })
}

/** {{1}} name {{2}} review link */
export async function sendBhashCheckupCompleteTemplateIfConfigured(options: {
  to?: string | null
  patientName: string
  reviewLink: string
}): Promise<boolean> {
  const review =
    options.reviewLink?.trim() ||
    "Please contact reception to share your feedback"

  return sendUtilityTemplate({
    to: options.to,
    templateEnvKey: "BHASHSMS_CHECKUP_COMPLETE_TEMPLATE",
    defaultTemplateName: "mivs_checkup_comp",
    logLabel: "checkup_complete",
    params: [
      sanitizeBhashParam(options.patientName.trim() || "Patient"),
      sanitizeBhashParam(review),
    ],
  })
}

/** {{1}} name {{2}} doctor {{3}} date {{4}} time */
export async function sendBhashMissedAppointmentTemplateIfConfigured(options: {
  to?: string | null
  patientName: string
  doctorName: string
  appointmentDate: string
  appointmentTime: string
}): Promise<boolean> {
  return sendUtilityTemplate({
    to: options.to,
    templateEnvKey: "BHASHSMS_MISSED_APPOINTMENT_TEMPLATE",
    defaultTemplateName: "missed_appointment",
    logLabel: "missed_appointment",
    params: [
      sanitizeBhashParam(options.patientName.trim() || "Patient"),
      sanitizeBhashParam(options.doctorName.trim() || "Doctor"),
      formatDateForTemplate(options.appointmentDate),
      formatTimeForTemplate(options.appointmentTime),
    ],
  })
}

/** {{1}} first name {{2}} patient id {{3}} full name */
export async function sendBhashWelcomeTemplateIfConfigured(options: {
  to?: string | null
  fallbackRecipients?: Array<string | null | undefined>
  firstName?: string
  patientId?: string
  fullName?: string
}): Promise<boolean> {
  const fullName =
    options.fullName?.trim() ||
    options.firstName?.trim() ||
    "Patient"

  return sendUtilityTemplate({
    to: options.to,
    fallbackRecipients: options.fallbackRecipients,
    templateEnvKey: "BHASHSMS_WELCOME_TEMPLATE",
    defaultTemplateName: "mivs_patient_create",
    logLabel: "welcome",
    params: [
      sanitizeBhashParam(options.firstName?.trim() || fullName),
      sanitizeBhashParam(options.patientId?.trim() || "N/A"),
      sanitizeBhashParam(fullName),
    ],
  })
}

function getPrescriptionDeliveryMode(): "document" | "link" {
  const mode = process.env.BHASHSMS_PRESCRIPTION_DELIVERY?.toLowerCase().trim()
  return mode === "link" ? "link" : "document"
}

/**
 * Prescription PDF via sendmsgutil.php + document header.
 *
 * sendmsgutil.php?text=prescription_pdf&stype=normal&Params=name,appointmentId
 *   &htype=document&url=https://your-domain.com/files/prescription.pdf
 *
 * Bhash template: UTILITY, Text+Document, {{1}} name, {{2}} appointment id
 */
export async function sendBhashPrescriptionDocumentTemplateIfConfigured(options: {
  to?: string | null
  documentUrl: string
  patientName: string
  appointmentId: string
}): Promise<boolean> {
  if (!shouldUseBhashSms()) return false

  const recipientPhone = resolveRecipientPhone(options.to)
  if (!recipientPhone || !options.documentUrl?.trim()) return false

  const templateName =
    process.env.BHASHSMS_PRESCRIPTION_TEMPLATE?.trim() ||
    process.env.BHASHSMS_DOCUMENT_TEMPLATE?.trim() ||
    "mivs_appointment"

  const patientName = sanitizeBhashParam(options.patientName.trim() || "Patient")
  const appointmentId = sanitizeBhashParam(options.appointmentId.trim() || "N/A")
  const documentUrl = options.documentUrl.trim()

  if (getPrescriptionDeliveryMode() === "link") {
    const params = [patientName, sanitizeBhashParam(documentUrl), appointmentId]
    const result = await bhashSendUtilityTemplate(recipientPhone, templateName, params)
    console.log("[BhashSMS prescription_pdf]", {
      api: "sendmsgutil.php",
      mode: "link",
      template: templateName,
      phone: recipientPhone,
      params,
      success: result.success,
      error: result.error,
    })
    return result.success
  }

  const params = [patientName, appointmentId]
  const result = await bhashSendMediaTemplate(
    recipientPhone,
    templateName,
    params,
    "document",
    documentUrl
  )

  console.log("[BhashSMS prescription_pdf]", {
    api: "sendmsgutil.php",
    mode: "document",
    template: templateName,
    phone: recipientPhone,
    htype: "document",
    url: documentUrl,
    params,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  })

  return result.success
}

export type { BhashConfirmationTemplateParams }
