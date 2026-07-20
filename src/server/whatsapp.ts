import { sendTextMessage as metaSendTextMessage } from "@/server/metaWhatsApp"
import { bhashSendTextMessage, shouldUseBhashSms } from "@/server/bhashWhatsApp"
import { formatWhatsAppRecipient } from "@/shared/utils/campaigns/whatsapp"

export async function getMessageStatus(
  _messageId: string
): Promise<{
  status?: string
  errorCode?: number
  errorMessage?: string
  dateSent?: Date
  dateUpdated?: Date
} | null> {
  return null
}

export interface WhatsAppButton {
  type: "url" | "phone" | "text"
  title: string
  url?: string
  phone?: string
}

/**
 * Outbound WhatsApp for campaigns / notifications.
 * When WHATSAPP_PROVIDER=bhashsms, uses Bhash util-reply (session window).
 * Meta contentSid templates are ignored under Bhash — plain text is sent instead.
 */
export async function sendWhatsAppNotification(options: {
  to?: string | null | undefined
  fallbackRecipients?: Array<string | null | undefined>
  message: string
  mediaUrl?: string | string[]
  buttons?: WhatsAppButton[]
  contentSid?: string
  contentVariables?: Record<string, string>
}): Promise<{
  success: boolean
  sid?: string
  status?: string
  error?: string
  errorCode?: number
  rateLimitReached?: boolean
}> {
  const usingBhash = shouldUseBhashSms()
  if (
    !usingBhash &&
    (!process.env.META_WHATSAPP_ACCESS_TOKEN || !process.env.META_WHATSAPP_PHONE_NUMBER_ID)
  ) {
    return {
      success: false,
      error:
        "WhatsApp credentials not configured. Please set META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID environment variables.",
    }
  }

  if (usingBhash) {
    const { user, pass } = {
      user: process.env.BHASHSMS_USER?.trim(),
      pass: process.env.BHASHSMS_PASSWORD?.trim(),
    }
    if (!user || !pass) {
      return {
        success: false,
        error: "BhashSMS credentials not configured (BHASHSMS_USER / BHASHSMS_PASSWORD).",
      }
    }
  }

  const recipients = [options.to, ...(options.fallbackRecipients ?? [])]
  let recipientPhone: string | null = null

  for (const recipient of recipients) {
    if (!recipient) continue
    const formatted = formatWhatsAppRecipient(recipient)
    if (formatted) {
      recipientPhone = formatted.replace(/^whatsapp:/i, "")
      break
    }
  }

  if (!recipientPhone) {
    return { success: false, error: "No valid recipient for WhatsApp notification" }
  }

  try {
    let messageBody = options.message

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

    const hospitalName =
      process.env.HOSPITAL_NAME?.trim() || "Harmony Medical Services"
    messageBody += `\n\n_This is an automated message from ${hospitalName}._`

    // Bhash path — campaigns/notifications (util-reply; works in open WhatsApp session)
    if (usingBhash) {
      if (options.contentSid) {
        console.log("[WhatsApp campaign] Bhash ignores Meta contentSid; sending plain text", {
          phone: recipientPhone.replace(/\d(?=\d{4})/g, "*"),
          contentSid: options.contentSid,
        })
      }

      const result = await bhashSendTextMessage(recipientPhone, messageBody)
      console.log("[WhatsApp campaign] Bhash send", {
        phone: recipientPhone.replace(/\d(?=\d{4})/g, "*"),
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      })

      if (result.success) {
        return {
          success: true,
          sid: result.messageId || `bhash-${Date.now()}`,
          status: "sent",
        }
      }

      return {
        success: false,
        error:
          result.error ||
          "BhashSMS campaign send failed. Util-reply requires an open WhatsApp session (user messaged recently). For cold outreach, configure a Bhash marketing/utility template.",
        errorCode: result.errorCode,
      }
    }

    // Meta path
    const result = await metaSendTextMessage(recipientPhone, messageBody)

    if (result.success) {
      return {
        success: true,
        sid: result.messageId,
        status: "sent",
      }
    }

    const isRateLimit =
      result.errorCode === 4 ||
      result.error?.includes("rate limit") ||
      result.error?.includes("429")

    return {
      success: false,
      error: result.error || "Failed to send WhatsApp message",
      errorCode: result.errorCode,
      rateLimitReached: isRateLimit,
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : "Unknown WhatsApp error"
    const errorCode =
      typeof error === "object" && error && "code" in error
        ? Number((error as { code?: number }).code)
        : undefined
    return { success: false, error: err, errorCode }
  }
}
