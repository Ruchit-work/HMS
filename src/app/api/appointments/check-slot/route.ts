import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { normalizeTime } from "@/utils/timeSlots"

const SLOT_COLLECTION = "appointmentSlots"

const getSlotDocId = (doctorId?: string, date?: string, time?: string) => {
  if (!doctorId || !date || !time) return null
  const normalizedTime = normalizeTime(time)
  return `${doctorId}_${date}_${normalizedTime}`.replace(/[:\s]/g, "-")
}

/**
 * GET /api/appointments/check-slot?doctorId=xxx&date=yyyy-mm-dd&time=HH:mm
 * Checks if a slot is available before booking
 * Public endpoint (used before payment collection)
 */
export async function GET(request: Request) {
  try {
    const initResult = initFirebaseAdmin("check-slot API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get("doctorId")
    const date = searchParams.get("date")
    const time = searchParams.get("time")

    if (!doctorId || !date || !time) {
      return NextResponse.json(
        { error: "Missing required parameters: doctorId, date, time" },
        { status: 400 }
      )
    }

    // Normalize time to 24-hour format before checking
    const normalizedTime = normalizeTime(time)
    const slotId = getSlotDocId(doctorId, date, normalizedTime)
    if (!slotId) {
      return NextResponse.json({ error: "Invalid slot information" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const slotRef = firestore.collection(SLOT_COLLECTION).doc(slotId)
    const slotSnap = await slotRef.get()

    if (slotSnap.exists) {
      return NextResponse.json({ available: false, error: "Slot is already booked" }, { status: 409 })
    }

    return NextResponse.json({ available: true })
  } catch (error: any) {
    console.error("[check-slot] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to check slot availability" },
      { status: 500 }
    )
  }
}

