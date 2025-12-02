// MIGRATED TO META WHATSAPP - Twilio code kept for rollback reference
// All WhatsApp messaging now uses Meta WhatsApp Business API

import { sendTextMessage as metaSendTextMessage, formatPhoneNumber } from "@/server/metaWhatsApp"
import { formatWhatsAppRecipient } from "@/utils/whatsapp"

// Twilio credentials kept in env but not used (for rollback if needed)
// const accountSid = process.env.TWILIO_ACCOUNT_SID
// const authToken = process.env.TWILIO_AUTH_TOKEN
// const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM

/**
 * Fetch message status from Meta WhatsApp
 * Note: Meta doesn't provide real-time status fetching like Twilio
 * This function is kept for compatibility but returns limited info
 */
export async function getMessageStatus(messageId: string): Promise<{ status?: string; errorCode?: number; errorMessage?: string; dateSent?: Date; dateUpdated?: Date } | null> {
  // Meta WhatsApp status is tracked via webhooks, not direct API calls
  // For compatibility, we return null (status tracking happens via webhook)
  console.warn("[WhatsApp] Message status fetching not available with Meta WhatsApp. Status is tracked via webhooks.")
  return null
}

export interface WhatsAppButton {
  type: "url" | "phone" | "text"
  title: string
  url?: string
  phone?: string
}

/**
 * Send WhatsApp notification via Meta WhatsApp Business API
 * This replaces the previous Twilio implementation
 * 
 * @param options - Notification options
 * @returns Promise with send result
 */
export async function sendWhatsAppNotification(options: {
  to?: string | null | undefined
  fallbackRecipients?: Array<string | null | undefined>
  message: string
  mediaUrl?: string | string[]
  buttons?: WhatsAppButton[]
  contentSid?: string // Content SID for approved WhatsApp template (Meta uses template names instead)
  contentVariables?: Record<string, string> // Variables for template
}): Promise<{ success: boolean; sid?: string; status?: string; error?: string; errorCode?: number; rateLimitReached?: boolean }> {
  // Find valid recipient from primary or fallback recipients
  const recipients = [options.to, ...(options.fallbackRecipients ?? [])]
  let recipientPhone: string | null = null

  for (const recipient of recipients) {
    if (!recipient) continue
    
    // Normalize phone number - remove whatsapp: prefix if present
    const formatted = formatWhatsAppRecipient(recipient)
    if (formatted) {
      // Remove whatsapp: prefix for Meta WhatsApp (it doesn't need it)
      recipientPhone = formatted.replace(/^whatsapp:/i, "")
      break
    }
  }

  if (!recipientPhone) {
    const error = "No valid recipient for WhatsApp notification"
    console.error("[Meta WhatsApp]", error)
    return { success: false, error }
  }

  try {
    // Format message body with buttons if provided
    let messageBody = options.message

    // Add buttons as clickable links in the message (Meta doesn't support inline buttons in plain text)
    if (options.buttons && Array.isArray(options.buttons) && options.buttons.length > 0) {
      messageBody += "\n\n"
      options.buttons.forEach((button, index) => {
        if (button.type === "url" && button.url) {
          messageBody += `🔗 *${button.title}*\n${button.url}\n`
        } else if (button.type === "phone" && button.phone) {
          const cleanPhone = button.phone.replace(/[^\d+]/g, "")
          messageBody += `📞 *${button.title}*\n${cleanPhone}\n`
        } else if (button.type === "text") {
          messageBody += `📋 *${button.title}*\n`
        }
        if (index < options.buttons!.length - 1) {
          messageBody += "\n"
        }
      })
    }

    messageBody += "\n\n_This is an automated message from Harmony Medical Services._"

    // Send via Meta WhatsApp
    const result = await metaSendTextMessage(recipientPhone, messageBody)

    if (result.success) {
      return {
        success: true,
        sid: result.messageId, // Use messageId as sid for compatibility
        status: "sent", // Meta doesn't provide immediate status
      }
    } else {
      // Check for rate limit errors
      const isRateLimit = result.errorCode === 4 || result.error?.includes("rate limit") || result.error?.includes("429")
      
      // Log detailed error information
      console.error(`[Meta WhatsApp] ❌ Failed to send message to ${recipientPhone}:`, {
        error: result.error,
        errorCode: result.errorCode,
        isRateLimit,
      })
      
      return {
        success: false,
        error: result.error || "Failed to send WhatsApp message",
        errorCode: result.errorCode,
        rateLimitReached: isRateLimit,
      }
    }
  } catch (error: any) {
    const err = error instanceof Error ? error.message : "Unknown Meta WhatsApp error"
    console.error("[Meta WhatsApp] Failed to send WhatsApp message:", err)
    
    return { success: false, error: err, errorCode: error.code }
  }
}
