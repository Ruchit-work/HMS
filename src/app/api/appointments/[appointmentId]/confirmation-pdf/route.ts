import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest } from "@/shared/utils/firebase/apiAuth"
import { pdfAccessTokensMatch } from "@/shared/utils/pdfAccessToken"

// Handle OPTIONS for CORS (Meta WhatsApp document fetch)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

async function authorizePdfAccess(
  request: Request,
  accessToken: string | undefined
): Promise<boolean> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (pdfAccessTokensMatch(token, accessToken)) {
    return true
  }

  const auth = await authenticateRequest(request)
  return Boolean(auth.success && auth.user)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const initResult = initFirebaseAdmin("appointment-pdf-api")
    if (!initResult.ok) {
      return new NextResponse("Server configuration error", { status: 500 })
    }

    const db = admin.firestore()
    const { appointmentId } = await params

    const pdfDoc = await db.collection("appointmentPDFs").doc(appointmentId).get()

    if (!pdfDoc.exists) {
      return new NextResponse("PDF not found", { status: 404 })
    }

    const pdfData = pdfDoc.data()!
    const expiresAt = new Date(pdfData.expiresAt)

    if (new Date() > expiresAt) {
      return new NextResponse("PDF link has expired", { status: 410 })
    }

    if (!(await authorizePdfAccess(request, pdfData.accessToken))) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    const base64Data = pdfData.pdfBase64
    if (!base64Data) {
      return new NextResponse("PDF data missing", { status: 500 })
    }
    const pdfBuffer = Buffer.from(base64Data, "base64")

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Appointment-Confirmation-${appointmentId}.pdf"`,
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    })
  } catch {
    return new NextResponse("Error generating PDF", { status: 500 })
  }
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> }
) {
  const response = await GET(request, context)
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  })
}
