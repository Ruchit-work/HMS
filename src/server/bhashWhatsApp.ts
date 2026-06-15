export interface SendMessageResponse {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: number
}

/** Read env at request time — module-level reads can be empty on Vercel builds. */
function getBhashConfig() {
  return {
    user: process.env.BHASHSMS_USER?.trim() || "",
    pass: process.env.BHASHSMS_PASSWORD?.trim() || "",
    sender: process.env.BHASHSMS_SENDER?.trim() || "BUZWAP",
    /** OTP and legacy templates (sendmsg.php — often needs separate SMS credits). */
    templateApiUrl:
      process.env.BHASHSMS_TEMPLATE_API_URL?.trim() ||
      process.env.BHASHSMS_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsg.php",
    /** Utility templates: confirmation, etc. (sendmsgutil.php — WA Utility credits). */
    utilTemplateApiUrl:
      process.env.BHASHSMS_UTIL_TEMPLATE_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutil.php",
    /** Appointment confirmation — UTILITY template via sendmsgutil.php (WA Utility credits). */
    confirmationApiUrl:
      process.env.BHASHSMS_CONFIRMATION_API_URL?.trim() ||
      process.env.BHASHSMS_UTIL_TEMPLATE_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutil.php",
    utilReplyApiUrl:
      process.env.BHASHSMS_UTIL_REPLY_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutilreply.php",
  }
}

export function isBhashSmsConfigured(): boolean {
  const { user, pass } = getBhashConfig()
  return !!(user && pass)
}

export function getBhashConfirmationApiUrl(): string {
  return getBhashConfig().confirmationApiUrl
}

export function shouldUseBhashSms(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER?.toLowerCase().trim()
  if (provider === "meta") return false
  if (provider === "bhashsms" || provider === "bhash") return true
  return isBhashSmsConfigured()
}

/** Extract 10-digit Indian mobile from any phone string. */
export function extractTenDigitPhone(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/^whatsapp:/i, "").replace(/\D/g, "")
  if (!digits) return null

  const ten =
    digits.length === 10
      ? digits
      : digits.startsWith("91") && digits.length >= 12
        ? digits.slice(-10)
        : digits.length > 10
          ? digits.slice(-10)
          : null

  return ten && ten.length === 10 ? ten : null
}

/** Normalize phone for Bhash session replies (utilreply — often 91xxxxxxxxxx). */
export function formatPhoneForBhash(phone: string): string | null {
  const ten = extractTenDigitPhone(phone)
  if (!ten) return null

  const phoneFormat = process.env.BHASHSMS_PHONE_FORMAT?.toLowerCase().trim()
  if (phoneFormat === "10digit" || phoneFormat === "10") {
    return ten
  }

  return `91${ten}`
}

/** Template APIs (sendmsg.php, sendmsgutil.php): phone without 91. utilreply: often 91 prefix. */
function phoneFormatsForApi(phone: string, apiUrl: string): string[] {
  const ten = extractTenDigitPhone(phone)
  if (!ten) return []

  const with91 = `91${ten}`
  const isTemplateApi =
    apiUrl.includes("sendmsgutil.php") ||
    (apiUrl.includes("sendmsg.php") && !apiUrl.includes("util"))

  if (isTemplateApi) {
    return [...new Set([ten, with91])]
  }

  const primary = formatPhoneForBhash(phone)
  if (!primary) return []
  return [...new Set([primary, with91, ten])]
}

/** Template APIs: Bhash docs say phone without 91 — use one format to avoid duplicate sends. */
function phoneForTemplateApi(phone: string): string[] {
  const ten = extractTenDigitPhone(phone)
  return ten ? [ten] : []
}

/** Plain text only — markdown/emoji-heavy messages may not deliver on some Bhash routes. */
export function sanitizeBhashOutboundText(message: string): string {
  return message
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .trim()
}

function parseBhashResponse(body: string): SendMessageResponse {
  const trimmed = body.trim()
  if (/^s\.\d+/i.test(trimmed)) {
    return { success: true, messageId: trimmed.split(/\s/)[0] }
  }

  const normalized = trimmed.toLowerCase()
  if (
    normalized === "success" ||
    normalized === "sent" ||
    normalized === "submitted" ||
    normalized === "queued"
  ) {
    return { success: true, messageId: `bhash-${Date.now()}` }
  }

  return {
    success: false,
    error: trimmed || "BhashSMS API returned an error",
  }
}

/** Bhash Params= must use literal commas between values (URLSearchParams encodes them and breaks templates). */
function buildBhashQueryString(
  config: { user: string; pass: string; sender: string },
  params: Record<string, string>
): string {
  const segments: string[] = [
    `user=${encodeURIComponent(config.user)}`,
    `pass=${encodeURIComponent(config.pass)}`,
    `sender=${encodeURIComponent(config.sender)}`,
    `priority=wa`,
  ]

  for (const [key, value] of Object.entries(params)) {
    if (key === "Params") {
      const encoded = value
        .split(",")
        .map((part) => encodeURIComponent(part.trim()))
        .join(",")
      segments.push(`Params=${encoded}`)
    } else {
      segments.push(`${key}=${encodeURIComponent(value)}`)
    }
  }

  return segments.join("&")
}

async function bhashGet(
  params: Record<string, string>,
  apiUrl?: string
): Promise<SendMessageResponse> {
  const config = getBhashConfig()
  const resolvedApiUrl = apiUrl || config.templateApiUrl

  if (!config.user || !config.pass) {
    console.error("[BhashSMS] credentials missing on server", {
      hasUser: !!config.user,
      hasPass: !!config.pass,
      provider: process.env.WHATSAPP_PROVIDER,
    })
    return { success: false, error: "BhashSMS credentials not configured" }
  }

  const query = buildBhashQueryString(config, params)

  try {
    const response = await fetch(`${resolvedApiUrl}?${query}`, {
      method: "GET",
      cache: "no-store",
    })
    const body = await response.text()
    const parsed = parseBhashResponse(body)
    const apiName = resolvedApiUrl.includes("utilreply")
      ? "utilreply"
      : resolvedApiUrl.includes("sendmsgutil")
        ? "sendmsgutil"
        : "sendmsg"
    console.log("[BhashSMS]", {
      api: apiName,
      phone: params.phone,
      text: params.text?.slice(0, 40),
      hasParams: !!params.Params,
      paramCount: params.Params ? params.Params.split(",").length : 0,
      httpStatus: response.status,
      response: body.trim().slice(0, 200),
      success: parsed.success,
      error: parsed.error,
    })
    if (!response.ok) {
      return {
        success: false,
        error: body.trim() || `BhashSMS HTTP ${response.status}`,
      }
    }
    return parsed
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
  const apiUrl = getBhashConfig().utilReplyApiUrl
  const phones = phoneFormatsForApi(to, apiUrl)
  if (phones.length === 0) {
    return { success: false, error: "Invalid phone number for BhashSMS" }
  }

  const text = sanitizeBhashOutboundText(message)
  const params = {
    text,
    stype: "normal",
    htype: "normal",
  }

  let lastResult: SendMessageResponse = {
    success: false,
    error: "BhashSMS send failed",
  }

  for (const phone of phones) {
    lastResult = await bhashGet({ phone, ...params }, apiUrl)
    if (lastResult.success) return lastResult
  }

  return lastResult
}

export async function bhashSendTemplateMessage(
  to: string,
  templateName: string,
  parameters?: string[],
  options?: {
    auth?: boolean
    mediaType?: "image" | "video" | "document"
    mediaUrl?: string
    apiUrl?: string
  }
): Promise<SendMessageResponse> {
  const config = getBhashConfig()
  const apiUrl =
    options?.apiUrl ||
    (options?.auth ? config.utilTemplateApiUrl : config.templateApiUrl)
  const phones = phoneForTemplateApi(to)
  if (phones.length === 0) {
    return { success: false, error: "Invalid phone number for BhashSMS" }
  }

  // Bhash: sendmsg.php?text=TEMPLATENAME&stype=normal&Params=param1,param2,...
  const baseParams: Record<string, string> = {
    text: templateName,
    stype: options?.auth ? "auth" : "normal",
    htype: "normal",
  }

  if (parameters?.length) {
    baseParams.Params = parameters.join(",")
  }

  if (options?.mediaType && options.mediaUrl) {
    baseParams.htype = options.mediaType
    baseParams.url = options.mediaUrl
  }

  let lastResult: SendMessageResponse = {
    success: false,
    error: "BhashSMS template send failed",
  }

  for (const phone of phones) {
    lastResult = await bhashGet({ phone, ...baseParams }, apiUrl)
    if (lastResult.success) return lastResult
  }

  return lastResult
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
