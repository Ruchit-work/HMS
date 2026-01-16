import { NextResponse } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { sendTextMessage } from "@/server/metaWhatsApp"

// MIGRATED TO META WHATSAPP - Twilio code kept for rollback reference
// Twilio credentials kept in env but not used (for rollback if needed)
// const accountSid = process.env.TWILIO_ACCOUNT_SID
// const authToken = process.env.TWILIO_AUTH_TOKEN
// const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM

export async function POST(request: Request) {
  // Authenticate request - requires admin or receptionist role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "admin" && auth.user.role !== "receptionist") {
    return NextResponse.json(
      { error: "Access denied. This endpoint requires admin or receptionist role." },
      { status: 403 }
    )
  }

  try {
    // Check if Meta WhatsApp is configured
    const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
    if (!metaAccessToken) {
      return NextResponse.json(
        { error: "Missing META_WHATSAPP_ACCESS_TOKEN configuration." },
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

    // Normalize phone number (remove whatsapp: prefix if present)
    let normalizedTo = to
    if (normalizedTo && normalizedTo.startsWith("whatsapp:")) {
      normalizedTo = normalizedTo.replace(/^whatsapp:/i, "")
    }

    // Send via Meta WhatsApp
    const result = await sendTextMessage(normalizedTo || to, message)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to send WhatsApp message via Meta WhatsApp.",
          errorCode: result.errorCode,
        },
        { status: 500 }
      )
    }

    // Note: Media URL support will be added in future update
    if (mediaUrl) {
    }

    return NextResponse.json({
      success: true,
      sid: result.messageId, // Use messageId as sid for compatibility
      status: "sent", // Meta doesn't provide immediate status
      to: normalizedTo || to,
    })
  } catch (error) {
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
