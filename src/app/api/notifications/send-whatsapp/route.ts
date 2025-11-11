import { NextResponse } from "next/server"
import twilio from "twilio"
import type { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM

function getTwilioClient() {
  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials. Ensure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set.")
  }
  return twilio(accountSid, authToken)
}

function normalizeWhatsAppNumber(value: string): string {
  if (!value) return value
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`
}

export async function POST(request: Request) {
  try {
    if (!whatsappFrom) {
      return NextResponse.json(
        { error: "Missing TWILIO_WHATSAPP_FROM configuration." },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
    }

    const { to, message, mediaUrl } = body as {
      to?: string
      message?: string
      mediaUrl?: string | string[]
    }

    if (!to || !message) {
      return NextResponse.json(
        { error: "Both 'to' and 'message' fields are required." },
        { status: 400 }
      )
    }

    const client = getTwilioClient()

    const payload: MessageListInstanceCreateOptions = {
      from: normalizeWhatsAppNumber(whatsappFrom),
      to: normalizeWhatsAppNumber(to),
      body: message,
    }

    if (mediaUrl) {
      payload.mediaUrl = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl]
    }

    const twilioResponse = await client.messages.create(payload)

    return NextResponse.json({
      success: true,
      sid: twilioResponse.sid,
      status: twilioResponse.status,
      to: twilioResponse.to,
    })
  } catch (error) {
    console.error("Failed to send WhatsApp message", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error sending WhatsApp message.",
      },
      { status: 500 }
    )
  }
}
