/**
 * Meta WhatsApp Business API Integration
 * Handles sending messages via Meta's WhatsApp Cloud API
 */

const META_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID
const META_API_VERSION = process.env.META_WHATSAPP_API_VERSION || "v22.0"

const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

export interface SendMessageResponse {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: number
}

/**
 * Format phone number for Meta WhatsApp (E.164 format: +1234567890)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ""
  
  // Remove whatsapp: prefix if present
  let normalized = phone.replace(/^whatsapp:/, "").trim()
  
  // Remove all non-digit characters except +
  normalized = normalized.replace(/[^\d+]/g, "")
  
  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // If it's a 10-digit number, assume it's Indian (+91)
    if (normalized.length === 10) {
      normalized = `+91${normalized}`
    } else {
      normalized = `+${normalized}`
    }
  }
  
  return normalized
}

/**
 * Send a WhatsApp Flow message
 */
export async function sendFlowMessage(
  to: string,
  flowId: string,
  flowToken: string,
  headerText?: string,
  bodyText?: string,
  footerText?: string,
  flowData?: Record<string, any>
): Promise<SendMessageResponse> {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    return {
      success: false,
      error: "Meta WhatsApp credentials not configured",
    }
  }

  const phoneNumber = formatPhoneNumber(to)
  if (!phoneNumber) {
    return {
      success: false,
      error: "Invalid phone number",
    }
  }

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "flow",
      header: headerText
        ? {
            type: "text",
            text: headerText,
          }
        : undefined,
      body: {
        text: bodyText || "Please fill out the form to book your appointment",
      },
      footer: footerText
        ? {
            text: footerText,
          }
        : undefined,
      action: {
        name: "flow",
        parameters: {
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: "Book Appointment",
          flow_action: "navigate",
          flow_action_payload: flowData || {},
        },
      },
    },
  }

  try {
    const response = await fetch(
      `${META_API_BASE_URL}/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("[Meta WhatsApp] Error sending flow:", data)
      return {
        success: false,
        error: data.error?.message || "Failed to send flow message",
        errorCode: data.error?.code,
      }
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error("[Meta WhatsApp] Exception:", error)
    return {
      success: false,
      error: error.message || "Unknown error",
    }
  }
}

/**
 * Send a text message via Meta WhatsApp
 */
export async function sendTextMessage(
  to: string,
  message: string
): Promise<SendMessageResponse> {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    return {
      success: false,
      error: "Meta WhatsApp credentials not configured. Check META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID",
    }
  }

  const phoneNumber = formatPhoneNumber(to)
  if (!phoneNumber) {
    return {
      success: false,
      error: "Invalid phone number",
    }
  }

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: {
      body: message,
    },
  }

  try {
    const response = await fetch(
      `${META_API_BASE_URL}/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("[Meta WhatsApp] Error sending message:", data)
      return {
        success: false,
        error: data.error?.message || "Failed to send message",
        errorCode: data.error?.code,
      }
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error("[Meta WhatsApp] Exception:", error)
    return {
      success: false,
      error: error.message || "Unknown error",
    }
  }
}

