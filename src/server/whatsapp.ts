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

/**
 * Fetch message status from Twilio
 */
export async function getMessageStatus(sid: string): Promise<{ status?: string; errorCode?: number; errorMessage?: string; dateSent?: Date; dateUpdated?: Date } | null> {
  const client = getClient()
  if (!client) {
    return null
  }

  try {
    const message = await client.messages(sid).fetch()
    return {
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateSent: message.dateSent,
      dateUpdated: message.dateUpdated,
    }
  } catch (error) {
    console.error("[WhatsApp] Failed to fetch message status:", error)
    return null
  }
}

export interface WhatsAppButton {
  type: "url" | "phone" | "text"
  title: string
  url?: string
  phone?: string
}

export async function sendWhatsAppNotification(options: {
  to?: string | null | undefined
  fallbackRecipients?: Array<string | null | undefined>
  message: string
  mediaUrl?: string | string[]
  buttons?: WhatsAppButton[]
}): Promise<{ success: boolean; sid?: string; status?: string; error?: string }> {
  const client = getClient()
  const sender = normalizeSender()

  if (!client) {
    const error = "Twilio client not configured - check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN"
    console.error("[WhatsApp]", error)
    return { success: false, error }
  }

  if (!sender) {
    const error = "Twilio WhatsApp sender not configured - check TWILIO_WHATSAPP_FROM"
    console.error("[WhatsApp]", error)
    return { success: false, error }
  }

  const recipients = [options.to, ...(options.fallbackRecipients ?? [])]
  const recipient = recipients
    .map((value) => formatWhatsAppRecipient(value ?? undefined))
    .find((value): value is string => Boolean(value))

  if (!recipient) {
    const error = "No valid recipient for WhatsApp notification"
    console.error("[WhatsApp]", error)
    return { success: false, error }
  }

  try {
    // Format message with buttons if provided
    let messageBody = options.message
    
    // Add buttons as clickable links in the message
    // WhatsApp automatically makes URLs and phone numbers clickable
    // Format them to look like buttons (they'll appear as clickable in WhatsApp)
    if (options.buttons && Array.isArray(options.buttons) && options.buttons.length > 0) {
      const buttons = options.buttons // Store in const so TypeScript knows it's defined
      messageBody += "\n\n"
      buttons.forEach((button, index) => {
        if (button.type === "url" && button.url) {
          // Format as clickable link button (WhatsApp will make URL clickable)
          messageBody += `🔗 *${button.title}*\n${button.url}\n`
        } else if (button.type === "phone" && button.phone) {
          // Format phone number as clickable call button
          // WhatsApp automatically detects phone numbers and makes them clickable
          const cleanPhone = button.phone.replace(/[^\d+]/g, "")
          messageBody += `📞 *${button.title}*\n${cleanPhone}\n`
        } else if (button.type === "text") {
          messageBody += `📋 *${button.title}*\n`
        }
        // Add separator between buttons (except last one)
        if (index < buttons.length - 1) {
          messageBody += "\n"
        }
      })
    }
    
    // Add footer
    messageBody += "\n\n_This is an automated message from Harmony Medical Services._"

    const payload: MessageListInstanceCreateOptions = {
      from: sender,
      to: recipient,
      body: messageBody,
    }

    if (options.mediaUrl) {
      payload.mediaUrl = Array.isArray(options.mediaUrl) ? options.mediaUrl : [options.mediaUrl]
    }

    // Note: Interactive buttons require WhatsApp Business API approval and message templates
    // For now, we use clickable links which work immediately without approval
    // To use interactive buttons, you need to:
    // 1. Register message templates with WhatsApp
    // 2. Use Twilio's Content API
    // 3. Get WhatsApp Business API approval

    const response = await client.messages.create(payload)
    
    if (response.status === 'failed' || response.errorCode) {
      console.error("[WhatsApp] Message failed:", {
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        status: response.status,
      })
    }
    
    return { success: true, sid: response.sid, status: response.status, error: response.errorMessage || undefined }
  } catch (error: any) {
    const err = error instanceof Error ? error.message : "Unknown Twilio error"
    console.error("[WhatsApp] Failed to send WhatsApp message:", err)
    return { success: false, error: err }
  }
}
