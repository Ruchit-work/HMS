export interface SendWhatsAppPayload {
  to: string
  message: string
  mediaUrl?: string | string[]
}

export interface SendWhatsAppResponse {
  success: boolean
  sid?: string
  status?: string
  to?: string
  error?: string
}

export const DEFAULT_WHATSAPP_COUNTRY_CODE = "+91"

export function formatWhatsAppRecipient(
  raw?: string | null,
  defaultCountryCode: string = DEFAULT_WHATSAPP_COUNTRY_CODE
): string | null {
  if (!raw) return null

  let normalized = raw.trim()
  if (!normalized) return null

  if (normalized.toLowerCase().startsWith("whatsapp:")) {
    normalized = normalized.slice("whatsapp:".length)
  }

  normalized = normalized.replace(/[^+\d]/g, "")
  if (!normalized) return null

  if (!normalized.startsWith("+")) {
    if (normalized.length === 10 && defaultCountryCode.startsWith("+")) {
      normalized = `${defaultCountryCode}${normalized}`
    } else {
      normalized = `+${normalized}`
    }
  }

  return normalized.startsWith("whatsapp:") ? normalized : `whatsapp:${normalized}`
}

export async function sendWhatsAppMessage(
  payload: SendWhatsAppPayload
): Promise<SendWhatsAppResponse> {
  try {
    const response = await fetch("/api/notifications/send-whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || "Failed to send WhatsApp message",
      }
    }

    return {
      success: true,
      sid: data.sid,
      status: data.status,
      to: data.to,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
