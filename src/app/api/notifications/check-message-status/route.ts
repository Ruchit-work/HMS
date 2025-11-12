import { NextResponse } from "next/server"
import { getMessageStatus } from "@/server/whatsapp"

export async function GET(request: Request) {
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
    console.error("Failed to check message status:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

