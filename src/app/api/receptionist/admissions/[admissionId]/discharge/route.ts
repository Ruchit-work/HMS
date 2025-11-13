import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"

interface Params {
  admissionId: string
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const initResult = initFirebaseAdmin("receptionist-discharge API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { doctorFee, otherCharges, otherDescription, notes } = await req.json().catch(() => ({}))

    const { admissionId } = await context.params
    if (!admissionId) {
      return Response.json({ error: "Missing admissionId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const admissionRef = firestore.collection("admissions").doc(admissionId)
    const admissionSnap = await admissionRef.get()

    if (!admissionSnap.exists) {
      return Response.json({ error: "Admission not found" }, { status: 404 })
    }

    const admissionData = admissionSnap.data() || {}
    if (admissionData.status !== "admitted") {
      return Response.json({ error: "Admission is not currently active" }, { status: 400 })
    }

    const appointmentId = String(admissionData.appointmentId || "")
    const appointmentRef = appointmentId
      ? firestore.collection("appointments").doc(appointmentId)
      : null

    const roomId = String(admissionData.roomId || "")
    const roomRef = roomId ? firestore.collection("rooms").doc(roomId) : null

    const checkInAt = admissionData.checkInAt ? new Date(admissionData.checkInAt) : new Date()
    const checkOutAt = new Date()
    const diffMs = checkOutAt.getTime() - checkInAt.getTime()
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    const roomRate = Number(admissionData.roomRatePerDay || 0)
    const roomCharges = diffDays * roomRate

    const parsedDoctorFee = doctorFee ? Number(doctorFee) : 0
    const parsedOtherCharges = otherCharges ? Number(otherCharges) : 0

    const patientUidFromAdmission = String(admissionData.patientUid || "")
    let patientNameResolved: string | null = admissionData.patientName || null
    if ((!patientNameResolved || patientNameResolved.toLowerCase() === "unknown") && patientUidFromAdmission) {
      try {
        const patientDoc = await firestore.collection("patients").doc(patientUidFromAdmission).get()
        if (patientDoc.exists) {
          const patient = patientDoc.data() as any
          const composedName = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
          patientNameResolved = composedName || patient?.fullName || patientNameResolved
        }
      } catch (err) {
        console.warn("Failed to enrich patient name for billing record", err)
      }
    }

    const billingRecordRef = firestore.collection("billing_records").doc()
    const billingPayload = {
      admissionId,
      appointmentId,
      patientId: String(admissionData.patientId || ""),
      patientUid: patientUidFromAdmission || null,
      patientName: patientNameResolved,
      doctorId: String(admissionData.doctorId || ""),
      doctorName: admissionData.doctorName || null,
      roomCharges,
      doctorFee: parsedDoctorFee,
      otherServices: parsedOtherCharges
        ? [{ description: otherDescription || "Additional charges", amount: parsedOtherCharges }]
        : [],
      totalAmount: roomCharges + parsedDoctorFee + parsedOtherCharges,
      generatedAt: checkOutAt.toISOString(),
      status: "pending",
      paymentMethod: null,
      paidAt: null,
      paymentReference: null,
    }

    await firestore.runTransaction(async (tx) => {
      tx.update(admissionRef, {
        status: "completed",
        checkOutAt: checkOutAt.toISOString(),
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : admissionData.notes || null,
        billingId: billingRecordRef.id,
        updatedAt: checkOutAt.toISOString()
      })

      if (appointmentRef) {
        tx.update(appointmentRef, {
          status: "completed",
          updatedAt: checkOutAt.toISOString()
        })
      }

      if (roomRef) {
        tx.update(roomRef, {
          status: "available",
          updatedAt: checkOutAt.toISOString()
        })
      }

      tx.set(billingRecordRef, billingPayload)
    })

    return Response.json({
      success: true,
      billingId: billingRecordRef.id,
      roomCharges,
      totalAmount: billingPayload.totalAmount,
      stayDays: diffDays
    })
  } catch (error: any) {
    console.error("discharge error", error)
    return Response.json(
      { error: error?.message || "Failed to discharge patient" },
      { status: 500 }
    )
  }
}



