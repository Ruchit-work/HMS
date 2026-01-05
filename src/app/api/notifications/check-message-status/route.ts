import { NextResponse } from "next/server"
import { getMessageStatus } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function GET(request: Request) {
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
    const url = new URL(request.url)
    const sid = url.searchParams.get("sid")

    if (!sid) {
      return NextResponse.json(
        { error: "Message SID is required. Use ?sid=SM..." },
        { status: 400 }
      )
    }

    const status = await getMessageStatus(sid)

    if (!status) {
      return NextResponse.json(
        { error: "Failed to fetch message status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sid,
      status: status.status,
      errorCode: status.errorCode,
      errorMessage: status.errorMessage,
      dateSent: status.dateSent,
      dateUpdated: status.dateUpdated,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

