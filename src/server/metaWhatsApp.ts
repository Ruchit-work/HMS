
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

  // Build parameters object
  const parameters: Record<string, any> = {
    flow_token: flowToken,
    flow_id: flowId,
    flow_message_version: "3",
    flow_cta: "Book Appointment",
    flow_action: "navigate",
  }

  // Only add flow_action_payload if we have valid data
  if (flowData && typeof flowData === "object" && flowData !== null && Object.keys(flowData).length > 0) {
    parameters.flow_action_payload = flowData
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
        parameters,
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
 * Send a button message with multiple buttons via Meta WhatsApp
 * Meta WhatsApp supports up to 3 buttons
 */
export async function sendMultiButtonMessage(
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

  const phoneNumber = formatPhoneNumber(to)
  if (!phoneNumber) {
    return {
      success: false,
      error: "Invalid phone number",
    }
  }

  // Limit to 3 buttons (Meta WhatsApp maximum)
  const buttonsToSend = buttons.slice(0, 3).map((btn) => ({
    type: "reply" as const,
    reply: {
      id: btn.id,
      title: btn.title,
    },
  }))

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: bodyText,
      },
      footer: footerText
        ? {
            text: footerText,
          }
        : undefined,
      action: {
        buttons: buttonsToSend,
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
      console.error("[Meta WhatsApp] Error sending multi-button:", data)
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
 * Send a button message via Meta WhatsApp
 */
export async function sendButtonMessage(
  to: string,
  bodyText: string,
  footerText?: string,
  buttonId: string = "book_appointment",
  buttonTitle: string = "Book Appointment"
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
      type: "button",
      body: {
        text: bodyText,
      },
      footer: footerText
        ? {
            text: footerText,
          }
        : undefined,
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: buttonId,
              title: buttonTitle,
            },
          },
        ],
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
 * Send a list message via Meta WhatsApp
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

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: bodyText,
      },
      footer: footerText
        ? {
            text: footerText,
          }
        : undefined,
      action: {
        button: buttonText,
        sections: sections,
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

/**
 * Send a document via Meta WhatsApp
 * Note: Meta requires the document to be hosted on a publicly accessible URL
 */
export async function sendDocumentMessage(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
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
    type: "document",
    document: {
      link: documentUrl,
      filename: filename,
      caption: caption,
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
      console.error("[Meta WhatsApp] Error sending document:", data)
      return {
        success: false,
        error: data.error?.message || "Failed to send document",
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
      
      // Provide more helpful error messages
      let errorMessage = data.error?.message || "Failed to send message"
      const errorCode = data.error?.code
      
      // Handle specific error codes
      if (errorCode === 190 || errorMessage?.includes("Malformed access token") || errorMessage?.includes("Invalid OAuth access token")) {
        errorMessage = "Access token is invalid or expired. Please generate a new token from Meta Business Manager."
      } else if (errorCode === 131047) {
        errorMessage = "Recipient phone number is not registered with WhatsApp."
      } else if (errorCode === 131048) {
        errorMessage = "Recipient has not opted in to receive messages from your business."
      } else if (errorCode === 4 || errorCode === 80007) {
        errorMessage = "Rate limit exceeded. Please wait before sending more messages."
      }
      
      return {
        success: false,
        error: errorMessage,
        errorCode: errorCode,
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

