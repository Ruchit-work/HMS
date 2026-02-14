import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const initResult = initFirebaseAdmin("prescription-pdf-api")
    if (!initResult.ok) {
      return new NextResponse("Server configuration error", { status: 500 })
    }

    const db = admin.firestore()
    const { appointmentId } = await params

    if (!appointmentId) {
      return new NextResponse("Appointment ID required", { status: 400 })
    }

    // Get PDF from Firestore (stored when completion WhatsApp was sent)
    const pdfDoc = await db.collection("prescriptionPDFs").doc(appointmentId).get()

    if (!pdfDoc.exists) {
      return new NextResponse("Prescription PDF not found", { status: 404 })
    }

    const pdfData = pdfDoc.data()!
    const expiresAt = pdfData.expiresAt ? new Date(pdfData.expiresAt) : null

    if (expiresAt && new Date() > expiresAt) {
      return new NextResponse("PDF link has expired", { status: 410 })
    }

    const base64Data = pdfData.pdfBase64
    if (!base64Data) {
      return new NextResponse("PDF data missing", { status: 500 })
    }

    const pdfBuffer = Buffer.from(base64Data, "base64")
    const patientName = pdfData.patientName || "Patient"
    const dateStr = pdfData.appointmentDate || new Date().toISOString().split("T")[0]
    const filename = `Prescription_${String(patientName).replace(/\s+/g, "_")}_${dateStr}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    })
  } catch {
    return new NextResponse("Error loading prescription PDF", { status: 500 })
  }
}
