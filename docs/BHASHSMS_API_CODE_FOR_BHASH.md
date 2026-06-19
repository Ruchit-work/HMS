# BhashSMS — Custom Reply API (`sendmsgutilreply.php`)

```
Account:    MIVS_Technologies
Sender:     BUZWAP
Webhook:    https://hospitalmanagementsystem-hazel.vercel.app/api/meta-webhook
Test phone: 7359057367  (inbound from Bhash: 917359057367)
```

---

## ENV

```env
WHATSAPP_PROVIDER=bhashsms
BHASHSMS_USER=MIVS_Technologies
BHASHSMS_PASSWORD=******
BHASHSMS_SENDER=BUZWAP
BHASHSMS_UTIL_REPLY_API_URL=http://bhashsms.com/api/sendmsgutilreply.php
BHASHSMS_PHONE_FORMAT=10digit
```

---

## INBOUND (Bhash → HMS)

```http
GET https://hospitalmanagementsystem-hazel.vercel.app/api/meta-webhook?fromphone=917359057367&message=Hi&fromname=Ruchit
```

```typescript
// src/app/api/meta-webhook/route.ts

function getBhashInboundFromSearchParams(searchParams: URLSearchParams) {
  const from =
    searchParams.get("fromphone") ||
    searchParams.get("from_phone") ||
    searchParams.get("phone") ||
    searchParams.get("from")
  const text =
    searchParams.get("message") ||
    searchParams.get("text") ||
    searchParams.get("body")

  if (!from?.trim() || !text?.trim()) return null
  return { from: from.trim(), text: text.trim() }
}

async function handleBhashInboundCallback(req: Request): Promise<Response | null> {
  const { searchParams } = new URL(req.url)
  const inbound = getBhashInboundFromSearchParams(searchParams)
  if (!inbound) return null

  console.log("[Bhash inbound]", {
    from: inbound.from,
    message: inbound.text.slice(0, 100),
    params: Object.fromEntries(searchParams.entries()),
  })

  await handleInboundTextMessage(inbound.from, inbound.text)
  return NextResponse.json({ success: true })
}

// GET + POST both call handleBhashInboundCallback(req)
```

---

## OUTBOUND — `sendmsgutilreply.php`

```http
GET http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&priority=wa&phone=9606918405&text=Hello!\r\nWelcome to Harmony Medical Services.\r\nHow can we help you today?\r\nReply BOOK to book an appointment\r\nReply HELP for assistance&stype=normal&htype=normal
```

| Param | Value |
|-------|-------|
| user | MIVS_Technologies |
| pass | account password |
| sender | BUZWAP |
| priority | wa |
| phone | 10 digit (e.g. 9606918405) |
| text | plain text; newlines as literal `\r\n`; spaces as spaces (NOT `+`) |
| stype | normal |
| htype | normal |

---

## CODE — `src/server/bhashWhatsApp.ts`

```typescript
function getBhashConfig() {
  return {
    user: process.env.BHASHSMS_USER?.trim() || "",
    pass: process.env.BHASHSMS_PASSWORD?.trim() || "",
    sender: process.env.BHASHSMS_SENDER?.trim() || "BUZWAP",
    utilReplyApiUrl:
      process.env.BHASHSMS_UTIL_REPLY_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutilreply.php",
  }
}

export function shouldUseBhashSms(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER?.toLowerCase().trim()
  if (provider === "meta") return false
  if (provider === "bhashsms" || provider === "bhash") return true
  return isBhashSmsConfigured()
}

export function extractTenDigitPhone(phone: string): string | null {
  const digits = phone.replace(/^whatsapp:/i, "").replace(/\D/g, "")
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

export function formatPhoneForBhash(phone: string): string | null {
  const ten = extractTenDigitPhone(phone)
  if (!ten) return null
  const phoneFormat = process.env.BHASHSMS_PHONE_FORMAT?.toLowerCase().trim()
  if (!phoneFormat || phoneFormat === "10digit" || phoneFormat === "10") return ten
  if (phoneFormat === "91" || phoneFormat === "country" || phoneFormat === "e164") {
    return `91${ten}`
  }
  return ten
}

export function sanitizeBhashOutboundText(message: string): string {
  return message
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .trim()
}

export function encodeBhashUtilReplyText(message: string): string {
  const normalized = message.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const withLiteralCrlf = normalized.split("\n").join("\\r\\n")

  return withLiteralCrlf
    .replace(/%/g, "%25")
    .replace(/&/g, "%26")
    .replace(/#/g, "%23")
    .replace(/\?/g, "%3F")
}

function buildBhashUtilReplyQueryString(config, params) {
  return [
    `user=${encodeURIComponent(config.user)}`,
    `pass=${encodeURIComponent(config.pass)}`,
    `sender=${encodeURIComponent(config.sender)}`,
    `priority=wa`,
    `phone=${params.phone}`,
    `text=${encodeBhashUtilReplyText(params.text)}`,
    `stype=${params.stype}`,
    `htype=${params.htype}`,
  ].join("&")
}

function parseBhashResponse(body: string) {
  const trimmed = body.trim()
  if (/^s\.\d+/i.test(trimmed)) {
    return { success: true, messageId: trimmed.split(/\s/)[0] }  // e.g. S.641114
  }
  return { success: false, error: trimmed }
}

async function bhashGet(params: Record<string, string>, apiUrl: string) {
  const config = getBhashConfig()
  const query = buildBhashQueryString(config, params)

  const response = await fetch(`${apiUrl}?${query}`, { method: "GET", cache: "no-store" })
  const body = await response.text()
  const parsed = parseBhashResponse(body)

  console.log("[BhashSMS]", {
    api: "utilreply",
    phone: params.phone,
    text: params.text?.slice(0, 40),
    requestUrl: `${apiUrl}?${query.replace(/pass=[^&]+/, "pass=***")}`,
    httpStatus: response.status,
    response: body.trim().slice(0, 200),
    success: parsed.success,
    error: parsed.error,
  })

  return parsed
}

export async function bhashSendTextMessage(to: string, message: string) {
  const apiUrl = getBhashConfig().utilReplyApiUrl
  const phone = formatPhoneForBhash(to)
  if (!phone) {
    return { success: false, error: "Invalid phone number for BhashSMS" }
  }

  const text = sanitizeBhashOutboundText(message)
  const params = {
    phone,
    text,
    stype: "normal",
    htype: "normal",
  }
  return bhashGet(params, apiUrl, { utilReply: true })
}
```

```typescript
// Buttons / lists → plain text → sendmsgutilreply.php

export async function bhashSendMultiButtonMessage(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  footerText?: string
) {
  let message = footerText ? `${bodyText}\n\n_${footerText}_` : bodyText
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
) {
  let message = footerText ? `${bodyText}\n\n_${footerText}_` : bodyText
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
```

---

## CODE — `src/server/metaWhatsApp.ts` (routes to utilreply)

```typescript
export async function sendTextMessage(to: string, message: string) {
  if (shouldUseBhashSms()) {
    return bhashSendTextMessage(to, message)
  }
  // Meta API...
}

export async function sendMultiButtonMessage(to, bodyText, buttons, footerText) {
  if (shouldUseBhashSms()) {
    return bhashSendMultiButtonMessage(to, bodyText, buttons, footerText)
  }
  // Meta API...
}

export async function sendListMessage(to, bodyText, buttonText, sections, footerText) {
  if (shouldUseBhashSms()) {
    return bhashSendListMessage(to, bodyText, buttonText, sections, footerText)
  }
  // Meta API...
}
```

---

## CODE — `src/app/api/meta-webhook/route.ts` (bot → utilreply)

```typescript
async function handleInboundTextMessage(from: string, text: string) {
  const trimmedText = text.trim().toLowerCase()

  const greetings = ["hello", "hi", "hy", "hey", "hii", "hiii", "hlo", "helo", "hie", "hai"]
  if (greetings.some((g) => trimmedText === g || trimmedText.startsWith(g + " "))) {
    await clearSession(from)
    await handleGreeting(from)
    return
  }

  if (trimmedText === "book" || trimmedText === "book appointment" || trimmedText === "1") {
    await startBookingWithFlow(from)
    return
  }

  if (trimmedText === "help" || trimmedText === "help center" || trimmedText === "2") {
    await handleHelpCenter(from)
    return
  }

  if (trimmedText === "yes" || trimmedText === "register") {
    await handleRegistrationPrompt(from)
    return
  }

  await handleBookingConversation(from, text)
}

async function handleGreeting(phone: string) {
  if (shouldUseBhashSms()) {
    const text = !patient
      ? "Hello!\nWelcome to Harmony Medical Services.\nWe don't have your profile yet.\nReply YES to register\nReply HELP for assistance"
      : "Hello!\nWelcome to Harmony Medical Services.\nHow can we help you today?\nReply BOOK to book an appointment\nReply HELP for assistance"
    const result = await sendTextMessage(phone, text)
    if (!result.success) {
      console.error("[WhatsApp greeting] Bhash plain text send failed", result.error)
    }
    return
  }
}

async function startBookingWithFlow(phone: string) {
  if (!patient) {
    await sendTextMessage(phone,
      `❌ We couldn't find your patient profile.\n\n📝 *Please register first to book appointments:*\n\n${baseUrl}\n\nOr contact reception:\nPhone: +91-XXXXXXXXXX\n\nAfter registration, you can book appointments via WhatsApp! 🏥`
    )
    return
  }
  await startBookingConversation(phone)
}

async function startBookingConversation(phone: string) {
  await sessionRef.set({
    state: "selecting_language",
    needsRegistration: false,
    patientUid: patient.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  await sendLanguagePicker(phone)
}

async function sendLanguagePicker(phone: string) {
  const listResponse = await sendListMessage(
    phone,
    "🌐 *Select Language*\n\nPlease choose your preferred language:",
    "🌐 Choose Language",
    [{
      title: "Available Languages",
      rows: [
        { id: "lang_english", title: "🇬🇧 English", description: "Continue in English" },
        { id: "lang_gujarati", title: "🇮🇳 ગુજરાતી (Gujarati)", description: "ગુજરાતીમાં ચાલુ રાખો" },
      ],
    }],
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    await sendTextMessage(phone,
      "🌐 *Select Language:*\n\nPlease reply with:\n• \"english\" for English\n• \"gujarati\" for ગુજરાતી"
    )
  }
}

// Booking states: selecting_language → selecting_branch → selecting_date → selecting_time → confirming
// All steps call sendTextMessage() / sendListMessage() / sendMultiButtonMessage() → sendmsgutilreply.php
```

---

## `text` VALUES SENT TO `sendmsgutilreply.php`

```text
# Hi — registered patient (sent as text=Hello!\r\nWelcome to Harmony Medical Services.\r\n...)
Hello!
Welcome to Harmony Medical Services.
How can we help you today?
Reply BOOK to book an appointment
Reply HELP for assistance
```

```text
# Hi — unregistered patient
Hello!
Welcome to Harmony Medical Services.
We don't have your profile yet.
Reply YES to register
Reply HELP for assistance
```

```text
# Language picker (after BOOK)
Select Language

Please choose your preferred language:

Choose Language

Available Languages
1. English — Continue in English
2. Gujarati (Gujarati) — Continue in Gujarati

Reply with the option number or name.
```

```text
# Branch selection
Please select your branch:

Select your branch or click 'Next' to use default:

Options:
1. Main Branch
2. Next (Use Default)

Reply with the option number or name.
```

```text
# After branch selected
Branch selected: Main Branch

Now select your date:
```

```text
# Date selection
Let's pick your appointment date. Available dates will be shown next.

Select Appointment Date

Tap the button below to see all available dates:

Available Dates
1. Monday, 23 June 2026
2. Tuesday, 24 June 2026

Reply with the option number or name.
```

```text
# Time selection
Select Appointment Time

Choose your preferred time slot:

Available Times
1. 9:00 AM
2. 9:30 AM

Reply with the option number or name.
```

```text
# Confirm booking
Appointment Details

Date: Monday, 23 June 2026
Time: 9:30 AM

Please confirm. Doctor will be assigned by reception.

Options:
1. Confirm
2. Cancel

Reply with the option number or name.
```

```text
# Booking cancelled
Booking cancelled.

You can start a new booking anytime by typing 'Book' or clicking the 'Book Appointment' button.
```

---

## TEST URLs

```http
# Simple test
http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&phone=7359057367&text=Test+reply+from+HMS+bot&priority=wa&stype=normal&htype=normal
```

```http
# Hi greeting (exact format Bhash expects)
http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&phone=9606918405&text=Hello!\r\nWelcome to Harmony Medical Services.\r\nHow can we help you today?\r\nReply BOOK to book an appointment\r\nReply HELP for assistance&priority=wa&stype=normal&htype=normal
```

---

## FAILED LOG

```json
[Bhash inbound] { from: "917359057367", message: "Hi" }

[BhashSMS] {
  api: "utilreply",
  phone: "7359057367",
  requestUrl: "http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=***&sender=BUZWAP&priority=wa&phone=7359057367&text=Hello!+Welcome+to+Harmony+Medical+Services...&stype=normal&htype=normal",
  httpStatus: 200,
  response: "S.641114",
  success: true
}
```

```
API returns S.641114 (success) but patient does NOT receive message on WhatsApp.
Check DLR for: S.641114 | phone: 7359057367 | sender: BUZWAP | account: MIVS_Technologies
```

---

## SOURCE FILES (utilreply only)

```
src/server/bhashWhatsApp.ts         — bhashSendTextMessage, bhashSendListMessage, bhashSendMultiButtonMessage
src/server/metaWhatsApp.ts          — sendTextMessage, sendListMessage, sendMultiButtonMessage
src/app/api/meta-webhook/route.ts   — inbound webhook + booking bot replies
```
