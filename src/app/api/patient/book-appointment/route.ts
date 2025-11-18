import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

const SLOT_COLLECTION = "appointmentSlots"

const getSlotDocId = (doctorId?: string, date?: string, time?: string) => {
  if (!doctorId || !date || !time) return null
  return `${doctorId}_${date}_${time}`.replace(/[:\s]/g, "-")
}

export async function POST(request: Request) {
  const initResult = initFirebaseAdmin("patient-book-appointment")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server not configured for admin" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const mode = body?.mode || "create"
    const firestore = admin.firestore()

    if (mode === "create") {
      const appointmentData = body?.appointmentData
      if (!appointmentData) {
        return NextResponse.json({ error: "Missing appointment data" }, { status: 400 })
      }
      if (!appointmentData.doctorId || !appointmentData.appointmentDate || !appointmentData.appointmentTime) {
        return NextResponse.json({ error: "Missing doctor/time information" }, { status: 400 })
      }

      const slotId = getSlotDocId(appointmentData.doctorId, appointmentData.appointmentDate, appointmentData.appointmentTime)
      if (!slotId) {
        return NextResponse.json({ error: "Invalid slot information" }, { status: 400 })
      }

      const nowIso = new Date().toISOString()
      appointmentData.createdAt = appointmentData.createdAt || nowIso
      appointmentData.updatedAt = nowIso

      let appointmentId = ""

      await firestore.runTransaction(async (transaction) => {
        const slotRef = firestore.collection(SLOT_COLLECTION).doc(slotId)
        const slotSnap = await transaction.get(slotRef)
        if (slotSnap.exists) {
          throw new Error("SLOT_ALREADY_BOOKED")
        }

        const appointmentRef = firestore.collection("appointments").doc()
        appointmentId = appointmentRef.id
        transaction.set(appointmentRef, appointmentData)
        transaction.set(slotRef, {
          appointmentId,
          doctorId: appointmentData.doctorId,
          appointmentDate: appointmentData.appointmentDate,
          appointmentTime: appointmentData.appointmentTime,
          createdAt: nowIso,
        })
      })

      return NextResponse.json({ success: true, id: appointmentId })
    }

    if (mode === "reschedule") {
      const appointmentId: string | undefined = body?.appointmentId
      const appointmentDate: string | undefined = body?.appointmentDate
      const appointmentTime: string | undefined = body?.appointmentTime
      const patientUid: string | undefined = body?.patientUid

      if (!appointmentId || !appointmentDate || !appointmentTime) {
        return NextResponse.json({ error: "Missing reschedule parameters" }, { status: 400 })
      }

      await firestore.runTransaction(async (transaction) => {
        const appointmentRef = firestore.collection("appointments").doc(appointmentId)
        const appointmentSnap = await transaction.get(appointmentRef)
        if (!appointmentSnap.exists) {
          throw new Error("APPOINTMENT_NOT_FOUND")
        }

        const appointment = appointmentSnap.data() as Record<string, any>
        if (patientUid && appointment.patientUid && appointment.patientUid !== patientUid) {
          throw new Error("UNAUTHORIZED")
        }

        const doctorId = appointment.doctorId
        const newSlotId = getSlotDocId(doctorId, appointmentDate, appointmentTime)
        if (!newSlotId) {
          throw new Error("INVALID_SLOT")
        }

        const newSlotRef = firestore.collection(SLOT_COLLECTION).doc(newSlotId)
        const newSlotSnap = await transaction.get(newSlotRef)
        if (newSlotSnap.exists) {
          throw new Error("SLOT_ALREADY_BOOKED")
        }

        const oldSlotId = getSlotDocId(doctorId, appointment.appointmentDate, appointment.appointmentTime)
        if (oldSlotId) {
          const oldSlotRef = firestore.collection(SLOT_COLLECTION).doc(oldSlotId)
          transaction.delete(oldSlotRef)
        }

        transaction.update(appointmentRef, {
          appointmentDate,
          appointmentTime,
          updatedAt: new Date().toISOString(),
        })

        transaction.set(newSlotRef, {
          appointmentId,
          doctorId,
          appointmentDate,
          appointmentTime,
          createdAt: new Date().toISOString(),
        })
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error) {
    console.error("[patient/book-appointment]", error)
    const message = (error as Error).message
    if (message === "SLOT_ALREADY_BOOKED") {
      return NextResponse.json({ error: "This slot was just booked. Please choose another time." }, { status: 409 })
    }
    if (message === "APPOINTMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "You cannot modify this appointment" }, { status: 403 })
    }
    return NextResponse.json({ error: message || "Failed to process appointment" }, { status: 500 })
  }
}

