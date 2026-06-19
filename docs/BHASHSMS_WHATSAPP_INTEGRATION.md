# BhashSMS — Code Reference (HMS)

```
Account:   MIVS_Technologies
Sender:    BUZWAP
Webhook:   https://hospitalmanagementsystem-hazel.vercel.app/api/meta-webhook
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
BHASHSMS_UTIL_TEMPLATE_API_URL=http://bhashsms.com/api/sendmsgutil.php
BHASHSMS_CONFIRMATION_API_URL=http://bhashsms.com/api/sendmsgutil.php
BHASHSMS_CONFIRMATION_TEMPLATE=confirmation
BHASHSMS_REMINDER_TEMPLATE=appointment_reminder
BHASHSMS_MISSED_APPOINTMENT_TEMPLATE=missed_appointment
BHASHSMS_CHECKUP_COMPLETE_TEMPLATE=mivs_checkup_comp
BHASHSMS_WELCOME_TEMPLATE=mivs_patient_create
BHASHSMS_PRESCRIPTION_TEMPLATE=mivs_appointment
BHASHSMS_DOCUMENT_TEMPLATE=mivs_appointment
BHASHSMS_OTP_TEMPLATE=otp
BHASHSMS_PHONE_FORMAT=10digit
```

---

## API 1 — INBOUND (Bhash → HMS)

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

## API 2 — OUTBOUND BOT (`sendmsgutilreply.php`)

```http
GET http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&priority=wa&phone=7359057367&text=MESSAGE&stype=normal&htype=normal
```

| Param | Value |
|-------|-------|
| user | MIVS_Technologies |
| pass | account password |
| sender | BUZWAP |
| priority | wa |
| phone | 7359057367 (10 digit) |
| text | plain text (URL-encoded) |
| stype | normal |
| htype | normal |

```typescript
// src/server/bhashWhatsApp.ts

function getBhashConfig() {
  return {
    user: process.env.BHASHSMS_USER?.trim() || "",
    pass: process.env.BHASHSMS_PASSWORD?.trim() || "",
    sender: process.env.BHASHSMS_SENDER?.trim() || "BUZWAP",
    utilReplyApiUrl:
      process.env.BHASHSMS_UTIL_REPLY_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutilreply.php",
    utilTemplateApiUrl:
      process.env.BHASHSMS_UTIL_TEMPLATE_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutil.php",
    confirmationApiUrl:
      process.env.BHASHSMS_CONFIRMATION_API_URL?.trim() ||
      process.env.BHASHSMS_UTIL_TEMPLATE_API_URL?.trim() ||
      "http://bhashsms.com/api/sendmsgutil.php",
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

function buildBhashQueryString(config, params: Record<string, string>): string {
  const segments = [
    `user=${encodeURIComponent(config.user)}`,
    `pass=${encodeURIComponent(config.pass)}`,
    `sender=${encodeURIComponent(config.sender)}`,
    `priority=wa`,
  ]
  for (const [key, value] of Object.entries(params)) {
    if (key === "Params") {
      segments.push(`Params=${value}`)  // literal commas — NOT %2C
    } else {
      segments.push(`${key}=${encodeURIComponent(value)}`)
    }
  }
  return segments.join("&")
}

async function bhashGet(params: Record<string, string>, apiUrl?: string) {
  const config = getBhashConfig()
  const query = buildBhashQueryString(config, params)
  const response = await fetch(`${apiUrl}?${query}`, { method: "GET", cache: "no-store" })
  const body = await response.text()

  console.log("[BhashSMS]", {
    api: apiUrl?.includes("utilreply") ? "utilreply" : "sendmsgutil",
    phone: params.phone,
    text: params.text?.slice(0, 40),
    hasParams: !!params.Params,
    requestUrl: `${apiUrl}?${query.replace(/pass=[^&]+/, "pass=***")}`,
    httpStatus: response.status,
    response: body.trim().slice(0, 200),
    success: parsed.success,
  })
  return parseBhashResponse(body)
}

function parseBhashResponse(body: string) {
  const trimmed = body.trim()
  if (/^s\.\d+/i.test(trimmed)) {
    return { success: true, messageId: trimmed.split(/\s/)[0] }  // e.g. S.641114
  }
  return { success: false, error: trimmed }
}

export async function bhashSendTextMessage(to: string, message: string) {
  const apiUrl = getBhashConfig().utilReplyApiUrl
  const phone = formatPhoneForBhash(to)
  const text = sanitizeBhashOutboundText(message)
  return bhashGet({ phone, text, stype: "normal", htype: "normal" }, apiUrl)
}
```

```typescript
// src/server/metaWhatsApp.ts — routes all bot text to utilreply

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

```typescript
// src/server/bhashWhatsApp.ts — buttons/lists → plain text → utilreply

export async function bhashSendMultiButtonMessage(to, bodyText, buttons, footerText) {
  let message = footerText ? `${bodyText}\n\n_${footerText}_` : bodyText
  message += "\n\n*Options:*"
  buttons.slice(0, 3).forEach((btn, index) => {
    message += `\n${index + 1}. ${btn.title}`
  })
  message += "\n\nReply with the option number or name."
  return bhashSendTextMessage(to, message)
}

export async function bhashSendListMessage(to, bodyText, buttonText, sections, footerText) {
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

## API 3 — OUTBOUND TEMPLATE (`sendmsgutil.php`)

```http
GET http://bhashsms.com/api/sendmsgutil.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&priority=wa&phone=7359057367&text=TEMPLATE_NAME&stype=normal&Params=p1,p2,p3
```

```http
# OTP (auth)
GET http://bhashsms.com/api/sendmsgutil.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&priority=wa&phone=7359057367&text=otp&stype=auth&Params=123456
```

```http
# Document (prescription PDF)
GET http://bhashsms.com/api/sendmsgutil.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&priority=wa&phone=7359057367&text=mivs_appointment&stype=normal&Params=Ruchit,APT-001&htype=document&url=https://example.com/file.pdf
```

| Param | Value |
|-------|-------|
| phone | 7359057367 (10 digit) |
| text | template name |
| stype | normal (utility) or auth (OTP) |
| Params | comma-separated, literal `,` not `%2C` |
| htype | document (only for PDF) |
| url | PDF URL (only for document) |

```typescript
// src/server/bhashWhatsApp.ts

export function encodeBhashTemplateParams(parameters: string[]): string {
  return parameters
    .map((part) => part.trim().replace(/ /g, "+"))
    .join(",")
}

export async function bhashSendUtilityTemplate(to, templateName, parameters) {
  const ten = extractTenDigitPhone(to)
  return bhashGet(
    {
      phone: ten,
      text: templateName,
      stype: "normal",
      Params: encodeBhashTemplateParams(parameters),
    },
    getBhashConfirmationApiUrl()
  )
}

export async function bhashSendMediaTemplate(to, templateName, parameters, mediaType, mediaUrl) {
  return bhashGet(
    {
      phone: extractTenDigitPhone(to),
      text: templateName,
      stype: "normal",
      Params: encodeBhashTemplateParams(parameters),
      htype: mediaType,
      url: mediaUrl,
    },
    getBhashConfirmationApiUrl()
  )
}

export async function bhashSendTemplateMessage(to, templateName, parameters, options) {
  const baseParams = {
    text: templateName,
    stype: options?.auth ? "auth" : "normal",
  }
  if (parameters?.length) {
    baseParams.Params = encodeBhashTemplateParams(parameters)
  }
  return bhashGet({ phone: extractTenDigitPhone(to), ...baseParams }, options?.apiUrl)
}
```

```typescript
// src/server/bhashAppointmentTemplate.ts — confirmation (7 params)

// Template body on Bhash panel:
// Hello {{1}}, Your appointment has been confirmed {{2}}.
// Doctor: {{3}} Date: {{4}} Time: {{5}} Appointment ID: {{6}} Payment: {{7}}

export function getBhashConfirmationTemplateName(): string {
  return process.env.BHASHSMS_CONFIRMATION_TEMPLATE?.trim() || "confirmation"
}

export function buildBhashConfirmationParams(input): string[] {
  return [
    sanitizeBhashParam(input.patientName),           // {{1}}
    sanitizeBhashParam(input.confirmedVia),           // {{2}}
    formatDoctorForTemplate(input.doctorName, input.doctorSpecialization), // {{3}}
    formatDateForTemplate(input.appointmentDate),    // {{4}}
    formatTimeForTemplate(input.appointmentTime),    // {{5}}
    sanitizeBhashParam(input.appointmentId),         // {{6}}
    formatPaymentForTemplate(input.paymentMethod, input.paymentAmount, input.paymentStatus), // {{7}}
  ]
}

export async function sendBhashConfirmationTemplateIfConfigured(options) {
  const result = await bhashSendConfirmationUtilityTemplate(
    recipientPhone,
    getBhashConfirmationTemplateName(),
    buildBhashConfirmationParams(options.params)
  )
  console.log("[BhashSMS confirmation]", {
    api: "sendmsgutil.php",
    template: templateName,
    phone: recipientPhone,
    params: templateParams,
    success: result.success,
    messageId: result.messageId,
  })
  return result.success
}
```

```typescript
// Template names (env → default)

BHASHSMS_CONFIRMATION_TEMPLATE      → confirmation
BHASHSMS_REMINDER_TEMPLATE          → appointment_reminder
BHASHSMS_MISSED_APPOINTMENT_TEMPLATE → missed_appointment
BHASHSMS_CHECKUP_COMPLETE_TEMPLATE  → mivs_checkup_comp
BHASHSMS_WELCOME_TEMPLATE           → mivs_patient_create
BHASHSMS_PRESCRIPTION_TEMPLATE      → mivs_appointment
BHASHSMS_OTP_TEMPLATE               → otp
```

---

## BOT FLOW CODE (`meta-webhook/route.ts`)

```typescript
async function handleInboundTextMessage(from: string, text: string) {
  const trimmedText = text.trim().toLowerCase()

  // Hi → greeting
  const greetings = ["hello", "hi", "hy", "hey", "hii", "hiii", "hlo", "helo", "hie", "hai"]
  if (greetings.some((g) => trimmedText === g || trimmedText.startsWith(g + " "))) {
    await clearSession(from)
    await handleGreeting(from)
    return
  }

  // BOOK → booking
  if (trimmedText === "book" || trimmedText === "book appointment" || trimmedText === "1") {
    await startBookingWithFlow(from)
    return
  }

  // HELP
  if (trimmedText === "help" || trimmedText === "help center" || trimmedText === "2") {
    await handleHelpCenter(from)
    return
  }

  // YES → register
  if (trimmedText === "yes" || trimmedText === "register") {
    await handleRegistrationPrompt(from)
    return
  }

  await handleBookingConversation(from, text)
}

async function handleGreeting(phone: string) {
  if (shouldUseBhashSms()) {
    const text = !patient
      ? "Hello! Welcome to Harmony Medical Services.\n\nWe don't have your profile yet.\n\nReply YES to register\nReply HELP for assistance"
      : "Hello! Welcome to Harmony Medical Services.\n\nHow can we help you today?\n\nReply BOOK to book an appointment\nReply HELP for assistance"
    await sendTextMessage(phone, text)  // → sendmsgutilreply.php
    return
  }
}

async function startBookingWithFlow(phone: string) {
  if (!patient) {
    await sendTextMessage(phone, `❌ We couldn't find your patient profile.\n\n📝 *Please register first...*`)
    return
  }
  await startBookingConversation(phone)  // → sendLanguagePicker() → sendListMessage() → utilreply
}

async function startBookingConversation(phone: string) {
  await sessionRef.set({ state: "selecting_language", ... })
  await sendLanguagePicker(phone)
}

async function sendLanguagePicker(phone: string) {
  await sendListMessage(phone,
    "🌐 *Select Language*\n\nPlease choose your preferred language:",
    "🌐 Choose Language",
    [{ title: "Available Languages", rows: [
      { id: "lang_english", title: "🇬🇧 English", description: "Continue in English" },
      { id: "lang_gujarati", title: "🇮🇳 ગુજરાતી (Gujarati)", description: "ગુજરાતીમાં ચાલુ રાખો" },
    ]}],
    "Harmony Medical Services"
  )
  // fallback:
  await sendTextMessage(phone,
    "🌐 *Select Language:*\n\nPlease reply with:\n• \"english\" for English\n• \"gujarati\" for ગુજરાતી"
  )
}

// Booking states: selecting_language → selecting_branch → selecting_date → selecting_time → confirming
```

---

## MESSAGE `text` VALUES SENT TO `sendmsgutilreply.php`

```text
# Hi — registered patient
Hello! Welcome to Harmony Medical Services.

How can we help you today?

Reply BOOK to book an appointment
Reply HELP for assistance
```

```text
# Hi — unregistered patient
Hello! Welcome to Harmony Medical Services.

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
# utilreply — simple test
http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&phone=7359057367&text=Test+reply+from+HMS+bot&priority=wa&stype=normal&htype=normal
```

```http
# utilreply — Hi greeting (exact text we send)
http://bhashsms.com/api/sendmsgutilreply.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&phone=7359057367&text=Hello!+Welcome+to+Harmony+Medical+Services.%0A%0AHow+can+we+help+you+today%3F%0A%0AReply+BOOK+to+book+an+appointment%0AReply+HELP+for+assistance&priority=wa&stype=normal&htype=normal
```

```http
# sendmsgutil — confirmation template
http://bhashsms.com/api/sendmsgutil.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&phone=7359057367&text=confirmation&priority=wa&stype=normal&Params=Ruchit,via+WhatsApp,Dr.+Patel,Monday+23+June+2026,9:30+AM,APT-001,Cash+-+Rs+500+-+Paid
```

```http
# sendmsgutil — OTP
http://bhashsms.com/api/sendmsgutil.php?user=MIVS_Technologies&pass=PASS&sender=BUZWAP&phone=7359057367&text=otp&priority=wa&stype=auth&Params=123456
```

---

## FAILED LOG (delivery issue)

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

## SOURCE FILES

```
src/server/bhashWhatsApp.ts              — API calls (utilreply + sendmsgutil)
src/server/metaWhatsApp.ts               — routes to Bhash when WHATSAPP_PROVIDER=bhashsms
src/app/api/meta-webhook/route.ts        — inbound webhook + booking bot
src/server/bhashAppointmentTemplate.ts   — confirmation template params
src/server/bhashUtilityTemplates.ts      — reminder, missed, welcome, checkup, prescription
```
