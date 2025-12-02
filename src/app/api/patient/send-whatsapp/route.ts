import { NextResponse } from "next/server"
import { sendTextMessage } from "@/server/metaWhatsApp"

/**
 * Public API route for sending WhatsApp messages during patient signup
 * This endpoint doesn't require authentication as it's used during account creation
 */
export async function POST(request: Request) {
  try {
    // Check if Meta WhatsApp is configured
    const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
    if (!metaAccessToken) {
      console.error("[Patient WhatsApp] Missing META_WHATSAPP_ACCESS_TOKEN configuration")
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

    // Send via Meta WhatsApp
    const result = await sendTextMessage(normalizedTo, message)

    if (!result.success) {
      console.error("[Patient WhatsApp] Failed to send message:", {
        phone: normalizedTo,
        error: result.error,
        errorCode: result.errorCode,
      })
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
    console.error("[Patient WhatsApp] Exception sending message:", error)
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
