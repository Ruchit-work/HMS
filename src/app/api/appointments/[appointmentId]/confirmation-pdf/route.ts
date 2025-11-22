import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

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

    // Get PDF from Firestore
    const pdfDoc = await db.collection("appointmentPDFs").doc(appointmentId).get()
    
    if (!pdfDoc.exists) {
      return new NextResponse("PDF not found", { status: 404 })
    }

    const pdfData = pdfDoc.data()!
    const expiresAt = new Date(pdfData.expiresAt)
    
    // Check if expired
    if (new Date() > expiresAt) {
      return new NextResponse("PDF link has expired", { status: 410 })
    }

    const base64Data = pdfData.pdfBase64
    const pdfBuffer = Buffer.from(base64Data, "base64")

    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Appointment-Confirmation-${appointmentId}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error: any) {
    console.error("[Appointment PDF] Error:", error)
    return new NextResponse("Error generating PDF", { status: 500 })
  }
}

