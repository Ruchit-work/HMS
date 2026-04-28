import { NextResponse } from "next/server"
import { sendTextMessage } from "@/server/metaWhatsApp"
import { applyRateLimit } from "@/utils/shared/rateLimit"

/**
 * Public API route for sending WhatsApp messages during patient signup
 * This endpoint doesn't require authentication as it's used during account creation
 */
export async function POST(request: Request) {
  try {
    const rateLimitResult = await applyRateLimit(request, "GENERAL")
    if (rateLimitResult instanceof Response) {
      return rateLimitResult
    }

    // Check if Meta WhatsApp is configured
    const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
    if (!metaAccessToken) {
      return NextResponse.json(
        { 
          success: false,
          error: "WhatsApp service is not configured. Please contact support." 
        },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid request payload." 
        },
        { status: 400 }
      )
    }

    const { to, message } = body as {
      to?: string
      message?: string
    }

    if (!to || !message) {
      return NextResponse.json(
        { 
          success: false,
          error: "Both 'to' and 'message' fields are required." 
        },
        { status: 400 }
      )
    }

    // Normalize phone number (remove whatsapp: prefix if present)
    let normalizedTo = to.trim()
    if (normalizedTo.toLowerCase().startsWith("whatsapp:")) {
      normalizedTo = normalizedTo.replace(/^whatsapp:/i, "")
    }
    
    // Ensure phone number starts with +
    if (!normalizedTo.startsWith("+")) {
      normalizedTo = `+${normalizedTo}`
    }

    if (!/^\+\d{8,15}$/.test(normalizedTo)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid phone number format.",
        },
        { status: 400 }
      )
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage || trimmedMessage.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: "Message must be between 1 and 1000 characters.",
        },
        { status: 400 }
      )
    }

    // Send via Meta WhatsApp
    const result = await sendTextMessage(normalizedTo, trimmedMessage)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to send WhatsApp message.",
          errorCode: result.errorCode,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sid: result.messageId,
      status: "sent",
      to: normalizedTo,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error sending WhatsApp message.",
      },
      { status: 500 }
    )
  }
}
