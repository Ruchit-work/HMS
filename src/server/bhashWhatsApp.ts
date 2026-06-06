export interface SendMessageResponse {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: number
}

const BHASH_API_URL =
  process.env.BHASHSMS_API_URL || "http://bhashsms.com/api/sendmsg.php"
const BHASH_USER = process.env.BHASHSMS_USER
const BHASH_PASS = process.env.BHASHSMS_PASSWORD
const BHASH_SENDER = process.env.BHASHSMS_SENDER || "BUZWAP"

export function isBhashSmsConfigured(): boolean {
  return !!(BHASH_USER && BHASH_PASS)
}

export function shouldUseBhashSms(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER?.toLowerCase()
  if (provider === "meta") return false
  if (provider === "bhashsms" || provider === "bhash") return isBhashSmsConfigured()
  return isBhashSmsConfigured()
}

/** BhashSMS expects 10-digit Indian numbers without country code. */
export function formatPhoneForBhash(phone: string): string | null {
  if (!phone) return null

  let digits = phone.replace(/^whatsapp:/i, "").replace(/\D/g, "")
  if (!digits) return null

  if (digits.startsWith("91") && digits.length >= 12) {
    digits = digits.slice(2)
  }

  if (digits.length === 10) return digits
  if (digits.length > 10) return digits.slice(-10)

  return null
}

function parseBhashResponse(body: string): SendMessageResponse {
  const normalized = body.trim().toLowerCase()
  if (
    normalized.includes("success") ||
    normalized.includes("sent") ||
    normalized.includes("submitted") ||
    normalized.includes("queued")
  ) {
    return { success: true, messageId: `bhash-${Date.now()}` }
  }

  return {
    success: false,
    error: body.trim() || "BhashSMS API returned an error",
  }
}

async function bhashGet(
  params: Record<string, string>
): Promise<SendMessageResponse> {
  if (!BHASH_USER || !BHASH_PASS) {
    return { success: false, error: "BhashSMS credentials not configured" }
  }

  const query = new URLSearchParams({
    user: BHASH_USER,
    pass: BHASH_PASS,
    sender: BHASH_SENDER,
    priority: "wa",
    ...params,
  })

  try {
    const response = await fetch(`${BHASH_API_URL}?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
    const body = await response.text()
    if (!response.ok) {
      return {
        success: false,
        error: body.trim() || `BhashSMS HTTP ${response.status}`,
      }
    }
    return parseBhashResponse(body)
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "BhashSMS request failed",
    }
  }
}

export async function bhashSendTextMessage(
  to: string,
  message: string
): Promise<SendMessageResponse> {
  const phone = formatPhoneForBhash(to)
  if (!phone) return { success: false, error: "Invalid phone number for BhashSMS" }

  return bhashGet({
    phone,
    text: message,
    stype: "normal",
    htype: "normal",
  })
}

export async function bhashSendTemplateMessage(
  to: string,
  templateName: string,
  parameters?: string[],
  options?: { auth?: boolean; mediaType?: "image" | "video" | "document"; mediaUrl?: string }
): Promise<SendMessageResponse> {
  const phone = formatPhoneForBhash(to)
  if (!phone) return { success: false, error: "Invalid phone number for BhashSMS" }

  const params: Record<string, string> = {
    phone,
    text: templateName,
    stype: options?.auth ? "auth" : "normal",
  }

  if (parameters?.length) {
    params.Params = parameters.join(",")
  }

  if (options?.mediaType && options.mediaUrl) {
    params.htype = options.mediaType
    params.url = options.mediaUrl
  }

  return bhashGet(params)
}

function appendFooter(body: string, footer?: string): string {
  return footer ? `${body}\n\n_${footer}_` : body
}

export async function bhashSendButtonMessage(
  to: string,
  bodyText: string,
  footerText?: string,
  _buttonId?: string,
  buttonTitle?: string
): Promise<SendMessageResponse> {
  let message = appendFooter(bodyText, footerText)
  if (buttonTitle) {
    message += `\n\n👉 Reply *${buttonTitle}* or type *book* to continue.`
  }
  return bhashSendTextMessage(to, message)
}

export async function bhashSendMultiButtonMessage(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  footerText?: string
): Promise<SendMessageResponse> {
  let message = appendFooter(bodyText, footerText)
  if (buttons.length > 0) {
    message += "\n\n*Options:*"
    buttons.slice(0, 3).forEach((btn, index) => {
      message += `\n${index + 1}. ${btn.title}`
    })
    message += "\n\nReply with the option number or name."
  }
  return bhashSendTextMessage(to, message)
}

export async function bhashSendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>,
  footerText?: string
): Promise<SendMessageResponse> {
  let message = appendFooter(bodyText, footerText)
  message += `\n\n*${buttonText}*`
  let optionIndex = 1
  for (const section of sections) {
    if (section.title) message += `\n\n*${section.title}*`
    for (const row of section.rows) {
      message += `\n${optionIndex}. ${row.title}`
      if (row.description) message += ` — ${row.description}`
      optionIndex += 1
    }
  }
  message += "\n\nReply with the option number or name."
  return bhashSendTextMessage(to, message)
}

export async function bhashSendFlowMessage(
  to: string,
  _flowId: string,
  _flowToken: string,
  headerText?: string,
  bodyText?: string,
  footerText?: string
): Promise<SendMessageResponse> {
  const parts = [headerText, bodyText || "Please reply *book* to start your appointment booking."]
  const message = appendFooter(parts.filter(Boolean).join("\n\n"), footerText)
  return bhashSendTextMessage(to, `${message}\n\nType *book* or *hi* to continue.`)
}

export async function bhashSendDocumentMessage(
  to: string,
  documentUrl: string,
  _filename: string,
  caption?: string
): Promise<SendMessageResponse> {
  const templateName = process.env.BHASHSMS_DOCUMENT_TEMPLATE
  if (templateName) {
    const params = caption ? [caption] : undefined
    return bhashSendTemplateMessage(to, templateName, params, {
      mediaType: "document",
      mediaUrl: documentUrl,
    })
  }

  const message = caption
    ? `${caption}\n\n📄 Document: ${documentUrl}`
    : `📄 Document: ${documentUrl}`
  return bhashSendTextMessage(to, message)
}
