import twilio from "twilio"
import type { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message"
import { formatWhatsAppRecipient } from "@/utils/whatsapp"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM

let cachedClient: twilio.Twilio | null | undefined

function getClient(): twilio.Twilio | null {
  if (cachedClient !== undefined) {
    return cachedClient
  }

  if (!accountSid || !authToken) {
    console.warn("Twilio credentials are missing; WhatsApp message skipped.")
    cachedClient = null
    return cachedClient
  }

  try {
    cachedClient = twilio(accountSid, authToken)
  } catch (error) {
    console.warn("Unable to initialize Twilio client", error)
    cachedClient = null
  }

  return cachedClient
}

function normalizeSender(): string | null {
  if (!whatsappFrom) {
    console.warn("TWILIO_WHATSAPP_FROM not set; WhatsApp message skipped.")
    return null
  }

  return whatsappFrom.startsWith("whatsapp:") ? whatsappFrom : `whatsapp:${whatsappFrom}`
}

export async function sendWhatsAppNotification(options: {
  to?: string | null | undefined
  fallbackRecipients?: Array<string | null | undefined>
  message: string
  mediaUrl?: string | string[]
}): Promise<{ success: boolean; sid?: string; status?: string; error?: string }> {
  const client = getClient()
  const sender = normalizeSender()

  if (!client || !sender) {
    return { success: false, error: "Twilio not configured" }
  }

  const recipients = [options.to, ...(options.fallbackRecipients ?? [])]
  const recipient = recipients
    .map((value) => formatWhatsAppRecipient(value ?? undefined))
    .find((value): value is string => Boolean(value))

  if (!recipient) {
    const message = "No valid recipient for WhatsApp notification"
    console.warn(message)
    return { success: false, error: message }
  }

  try {
    const payload: MessageListInstanceCreateOptions = {
      from: sender,
      to: recipient,
      body: options.message,
    }

    if (options.mediaUrl) {
      payload.mediaUrl = Array.isArray(options.mediaUrl) ? options.mediaUrl : [options.mediaUrl]
    }

    const response = await client.messages.create(payload)
    return { success: true, sid: response.sid, status: response.status, error: undefined }
  } catch (error) {
    const err = error instanceof Error ? error.message : "Unknown Twilio error"
    console.warn("Failed to send WhatsApp message", error)
    return { success: false, error: err }
  }
}
