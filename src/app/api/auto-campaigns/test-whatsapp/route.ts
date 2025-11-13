/**
 * Test WhatsApp API
 * Simple endpoint to test cron job and WhatsApp sending
 * This endpoint just sends a test WhatsApp message without creating campaigns
 */

import { NextResponse } from "next/server"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

/**
 * GET /api/auto-campaigns/test-whatsapp
 * Sends a test WhatsApp message to all active patients
 */
export async function GET(request: Request) {
  const isCronTrigger = request.headers.get("x-vercel-cron") !== null
  const triggerSource = isCronTrigger ? "cron" : "manual"
  
  console.log(`[test-whatsapp] ${triggerSource.toUpperCase()} trigger at ${new Date().toISOString()}`)
  
  try {
    const initResult = initFirebaseAdmin("test-whatsapp API")
    if (!initResult.ok) {
      return NextResponse.json(
        { error: "Server not configured for admin" },
        { status: 500 }
      )
    }

    const db = admin.firestore()

    // Get all active patients with phone numbers
    const patientsSnapshot = await db
      .collection("patients")
      .where("status", "in", ["active"])
      .get()

    if (patientsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No active patients found",
        patientsCount: 0,
        whatsAppSent: 0,
        triggeredBy: triggerSource,
      })
    }

    // Simple test message
    const testMessage = `🧪 *Test Message - Cron Job Working!*

This is a test message to verify the cron job is running correctly.

Current time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}

If you received this message, the cron job is working! ✅`

    // Send WhatsApp to all active patients
    const whatsAppPromises: Promise<void>[] = []
    let successCount = 0
    let failCount = 0

    patientsSnapshot.forEach((doc) => {
      const patientData = doc.data()
      const phone = patientData.phone || patientData.phoneNumber || patientData.contact

      if (phone && phone.trim() !== "") {
        whatsAppPromises.push(
          sendWhatsAppNotification({
            to: phone,
            message: testMessage,
          })
            .then((result) => {
              if (result.success) {
                successCount++
                console.log(`[test-whatsapp] Successfully sent WhatsApp to ${phone}`)
              } else {
                failCount++
                console.error(`[test-whatsapp] Failed to send WhatsApp to ${phone}:`, result.error)
              }
            })
            .catch((error) => {
              failCount++
              console.error(`[test-whatsapp] Error sending WhatsApp to ${phone}:`, error)
            })
        )
      }
    })

    // Wait for all messages to be sent
    await Promise.all(whatsAppPromises)

    console.log(`[test-whatsapp] Completed: ${successCount} sent, ${failCount} failed`)

    return NextResponse.json({
      success: true,
      message: "Test WhatsApp messages sent",
      patientsCount: patientsSnapshot.size,
      whatsAppSent: successCount,
      whatsAppFailed: failCount,
      triggeredBy: triggerSource,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[test-whatsapp] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        triggeredBy: triggerSource,
      },
      { status: 500 }
    )
  }
}

