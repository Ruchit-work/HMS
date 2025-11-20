/**
 * API endpoint to send WhatsApp Flow message for appointment booking
 * POST /api/whatsapp/send-flow
 */

import { NextResponse } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { sendFlowMessage, formatPhoneNumber } from "@/server/metaWhatsApp"

export async function POST(request: Request) {
  // Authenticate request
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  // Only admin and receptionist can send Flow messages
  if (auth.user && auth.user.role !== "admin" && auth.user.role !== "receptionist") {
    return NextResponse.json(
      { error: "Access denied. This endpoint requires admin or receptionist role." },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { to, flowId, flowToken, headerText, bodyText, footerText, flowData } = body

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 })
    }

    const flowIdToUse = flowId || process.env.META_WHATSAPP_FLOW_ID
    if (!flowIdToUse) {
      return NextResponse.json(
        { error: "Flow ID not configured. Set META_WHATSAPP_FLOW_ID or provide flowId in request." },
        { status: 400 }
      )
    }

    // Generate flow token if not provided
    const tokenToUse = flowToken || `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const result = await sendFlowMessage(
      to,
      flowIdToUse,
      tokenToUse,
      headerText,
      bodyText,
      footerText,
      flowData
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errorCode: result.errorCode },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      flowToken: tokenToUse,
    })
  } catch (error: any) {
    console.error("[send-flow] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send flow message" },
      { status: 500 }
    )
  }
}

