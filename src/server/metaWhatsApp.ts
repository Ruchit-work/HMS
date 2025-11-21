/**
 * Meta WhatsApp Business API Integration
 * Handles sending messages and Flows via Meta's WhatsApp Cloud API
 */

const META_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN
const META_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID
const META_BUSINESS_ACCOUNT_ID = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID
const META_API_VERSION = process.env.META_WHATSAPP_API_VERSION || "v22.0"

const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaWhatsAppMessage {
  messaging_product: "whatsapp"
  to: string
  type: "text" | "template" | "interactive" | "flow"
  text?: {
    body: string
    preview_url?: boolean
  }
  template?: {
    name: string
    language: {
      code: string
    }
    components?: Array<{
      type: string
      parameters?: Array<{
        type: string
        text?: string
        image?: { link: string }
      }>
    }>
  }
  interactive?: {
    type: "button" | "list" | "flow"
    body?: {
      text: string
    }
    action?: {
      buttons?: Array<{
        type: "reply"
        reply: {
          id: string
          title: string
        }
      }>
      button?: string
      sections?: Array<{
        title: string
        rows: Array<{
          id: string
          title: string
          description?: string
        }>
      }>
    }
    footer?: {
      text: string
    }
  }
  flow?: {
    version: string
    screen: string
    data?: Record<string, any>
  }
}

export interface MetaWhatsAppFlowMessage {
  messaging_product: "whatsapp"
  to: string
  type: "interactive"
  interactive: {
    type: "flow"
    header?: {
      type: "text"
      text: string
    }
    body: {
      text: string
    }
    footer?: {
      text: string
    }
    action: {
      name: "flow"
      parameters: {
        flow_token: string
        flow_id: string
        flow_cta: string
        flow_action_payload?: Record<string, any>
        flow_action?: "navigate" | "data_exchange"
        screen?: string
      }
    }
  }
}

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
 * Send a simple text message via Meta WhatsApp
 */
export async function sendTextMessage(
  to: string,
  message: string,
  previewUrl: boolean = false
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

  const payload: MetaWhatsAppMessage = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: {
      body: message,
      preview_url: previewUrl,
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

/**
 * Send an interactive Flow message for appointment booking
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

  const payload: MetaWhatsAppFlowMessage = {
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
 * Send an interactive button message
 */
export async function sendButtonMessage(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  footerText?: string
): Promise<SendMessageResponse> {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    return {
      success: false,
      error: "Meta WhatsApp credentials not configured",
    }
  }

  if (buttons.length > 3) {
    return {
      success: false,
      error: "Maximum 3 buttons allowed",
    }
  }

  const phoneNumber = formatPhoneNumber(to)
  if (!phoneNumber) {
    return {
      success: false,
      error: "Invalid phone number",
    }
  }

  const payload: MetaWhatsAppMessage = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: bodyText,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
      footer: footerText
        ? {
            text: footerText,
          }
        : undefined,
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
      console.error("[Meta WhatsApp] Error sending button:", data)
      return {
        success: false,
        error: data.error?.message || "Failed to send button message",
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
 * Send a template message via Meta WhatsApp
 * Templates must be pre-approved by Meta before use
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "en_US",
  templateComponents?: Array<{
    type: string
    parameters?: Array<{
      type: string
      text?: string
      image?: { link: string }
    }>
  }>
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

  const payload: MetaWhatsAppMessage = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      ...(templateComponents && { components: templateComponents }),
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
      console.error("[Meta WhatsApp] Error sending template:", data)
      return {
        success: false,
        error: data.error?.message || "Failed to send template message",
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
 * Send a list message (for doctor selection, etc.)
 */
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string
    rows: Array<{
      id: string
      title: string
      description?: string
    }>
  }>,
  footerText?: string
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

  const payload: MetaWhatsAppMessage = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: bodyText,
      },
      action: {
        button: buttonText,
        sections: sections,
      },
      footer: footerText
        ? {
            text: footerText,
          }
        : undefined,
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
      console.error("[Meta WhatsApp] Error sending list:", data)
      return {
        success: false,
        error: data.error?.message || "Failed to send list message",
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

