import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

interface Params {
  admissionId: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function countCalendarDaysInclusive(fromIso: string, toIso: string) {
  const fromDate = new Date(fromIso)
  const toDate = new Date(toIso)
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) return 1
  if (toDate.getTime() <= fromDate.getTime()) return 1
  const startUtcDay = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
  const endUtcDay = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate())
  return Math.max(1, Math.floor((endUtcDay - startUtcDay) / DAY_MS) + 1)
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-discharge API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { doctorFee, prescriptionCharges, prescriptionNames, otherCharges, otherDescription, notes } = await req.json().catch(() => ({}))

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
    let appointmentRef: FirebaseFirestore.DocumentReference | null = null
    if (appointmentId) {
      const rootAppointmentRef = firestore.collection("appointments").doc(appointmentId)
      const rootAppointmentSnap = await rootAppointmentRef.get()
      if (rootAppointmentSnap.exists) {
        appointmentRef = rootAppointmentRef
      } else {
        const hospitalsSnap = await firestore
          .collection("hospitals")
          .where("status", "==", "active")
          .limit(25)
          .get()
        for (const hospitalDoc of hospitalsSnap.docs) {
          const scopedRef = firestore
            .collection(`hospitals/${hospitalDoc.id}/appointments`)
            .doc(appointmentId)
          const scopedSnap = await scopedRef.get()
          if (scopedSnap.exists) {
            appointmentRef = scopedRef
            break
          }
        }
      }
    }

    const roomId = String(admissionData.roomId || "")
    const roomRef = roomId ? firestore.collection("rooms").doc(roomId) : null

    const checkInAt = admissionData.checkInAt ? new Date(admissionData.checkInAt) : new Date()
    const checkOutAt = new Date()
    const diffMs = checkOutAt.getTime() - checkInAt.getTime()
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    const existingRoomStays = Array.isArray(admissionData.roomStays) ? admissionData.roomStays : []
    const normalizedRoomStays = existingRoomStays.map((stay: any) => ({ ...stay }))
    if (normalizedRoomStays.length > 0) {
      const lastIndex = normalizedRoomStays.length - 1
      normalizedRoomStays[lastIndex] = {
        ...normalizedRoomStays[lastIndex],
        toAt: checkOutAt.toISOString(),
      }
    } else {
      normalizedRoomStays.push({
        roomId: String(admissionData.roomId || ""),
        roomNumber: String(admissionData.roomNumber || ""),
        roomType: String(admissionData.roomType || "general"),
        customRoomTypeName: admissionData.customRoomTypeName || null,
        ratePerDay: Number(admissionData.roomRatePerDay || 0),
        fromAt: String(admissionData.checkInAt || checkOutAt.toISOString()),
        toAt: checkOutAt.toISOString(),
      })
    }

    const roomStayBreakdown = normalizedRoomStays.map((stay: any) => {
      const fromDate = new Date(String(stay.fromAt || checkOutAt.toISOString()))
      const toDate = new Date(String(stay.toAt || checkOutAt.toISOString()))
      const stayDays = countCalendarDaysInclusive(fromDate.toISOString(), toDate.toISOString())
      const ratePerDay = Number(stay.ratePerDay || 0)
      const amount = stayDays * ratePerDay
      return {
        roomId: String(stay.roomId || ""),
        roomNumber: String(stay.roomNumber || ""),
        roomType: String(stay.roomType || ""),
        customRoomTypeName: stay.customRoomTypeName || null,
        ratePerDay,
        fromAt: fromDate.toISOString(),
        toAt: toDate.toISOString(),
        stayDays,
        amount,
      }
    })
    const roomCharges = roomStayBreakdown.reduce((sum, segment) => sum + Number(segment.amount || 0), 0)

    const admissionCharges = admissionData.charges && typeof admissionData.charges === "object" ? admissionData.charges : {}
    const chargeLineItems = Array.isArray(admissionData.chargeLineItems) ? admissionData.chargeLineItems : []
    const parsedDoctorFee =
      doctorFee !== undefined && doctorFee !== null && doctorFee !== ""
        ? Number(doctorFee)
        : Number(admissionCharges.doctorRoundFee || 0)
    const parsedCustomPrescriptionCharges = Number(prescriptionCharges || 0)
    const parsedOtherCharges = otherCharges ? Number(otherCharges) : 0
    const nurseFee = Number(admissionCharges.nurseRoundFee || 0)
    const medicineCharges = Number(admissionCharges.medicineCharges || 0)
    const injectionCharges = Number(admissionCharges.injectionCharges || 0)
    const bottleCharges = Number(admissionCharges.bottleCharges || 0)
    const facilityCharges = Number(admissionCharges.facilityCharges || 0)
    const admissionOtherCharges = Number(admissionCharges.otherCharges || 0)
    const operationPackage =
      admissionData.operationPackage && typeof admissionData.operationPackage === "object"
        ? admissionData.operationPackage
        : null
    const packageFixedRate = Number(operationPackage?.fixedRate || 0)
    const packageAdvancePaidAmount = Number(operationPackage?.advancePaidAmount || 0)
    const packageDueAmount = Math.max(
      0,
      operationPackage?.paymentTiming === "advance"
        ? packageFixedRate - packageAdvancePaidAmount
        : packageFixedRate
    )
    const packageInclusive = Boolean(operationPackage)
    const depositSummary =
      admissionData.depositSummary && typeof admissionData.depositSummary === "object"
        ? admissionData.depositSummary
        : { totalDeposited: 0, totalAdjusted: 0, balance: 0 }
    const totalDeposited = Number(depositSummary.totalDeposited || 0)

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
      } catch {

      }
    }

    const billingRecordRef = firestore.collection("billing_records").doc()
    const grossTotal =
      (packageInclusive
        ? packageDueAmount
        : roomCharges +
          parsedDoctorFee +
          nurseFee +
          medicineCharges +
          injectionCharges +
          bottleCharges +
          facilityCharges +
          admissionOtherCharges +
          parsedCustomPrescriptionCharges +
          parsedOtherCharges)
    const depositUsed = Math.min(totalDeposited, grossTotal)
    const netPayable = Math.max(0, grossTotal - totalDeposited)
    const refundAmount = Math.max(0, totalDeposited - grossTotal)

    const billingPayload = {
      roomBillingPolicy: "calendar_day_full_charge",
      admissionId,
      appointmentId,
      patientId: String(admissionData.patientId || ""),
      patientUid: patientUidFromAdmission || null,
      patientName: patientNameResolved,
      doctorId: String(admissionData.doctorId || ""),
      doctorName: admissionData.doctorName || null,
      roomCharges: packageInclusive ? 0 : roomCharges,
      roomStayBreakdown,
      doctorFee: packageInclusive ? 0 : parsedDoctorFee,
      otherServices: [
        !packageInclusive && nurseFee ? { description: "Nurse round charges", amount: nurseFee } : null,
        ...(!packageInclusive
          ? chargeLineItems.map((item: any) => ({
              description: `${String(item.category || "item").toUpperCase()}: ${String(item.name || "Charge item")}`,
              amount: Number(item.amount || 0),
            }))
          : []),
        !packageInclusive && chargeLineItems.length === 0 && medicineCharges
          ? { description: "Medicine charges", amount: medicineCharges }
          : null,
        !packageInclusive && chargeLineItems.length === 0 && injectionCharges
          ? { description: "Injection charges", amount: injectionCharges }
          : null,
        !packageInclusive && chargeLineItems.length === 0 && bottleCharges
          ? { description: "Bottle charges", amount: bottleCharges }
          : null,
        !packageInclusive && facilityCharges ? { description: "Facility charges", amount: facilityCharges } : null,
        !packageInclusive && admissionOtherCharges
          ? {
              description:
                typeof admissionCharges.otherDescription === "string" && admissionCharges.otherDescription.trim()
                  ? admissionCharges.otherDescription.trim()
                  : "Additional charges",
              amount: admissionOtherCharges,
            }
          : null,
        !packageInclusive && parsedOtherCharges
          ? { description: otherDescription || "Discharge charges", amount: parsedOtherCharges }
          : null,
        !packageInclusive && parsedCustomPrescriptionCharges
          ? {
              description:
                typeof prescriptionNames === "string" && prescriptionNames.trim()
                  ? `Prescription charges (custom): ${prescriptionNames.trim()}`
                  : "Prescription charges (custom)",
              amount: parsedCustomPrescriptionCharges,
            }
          : null,
      ].filter(Boolean),
      paymentTerms:
        admissionData.paymentTerms === "pay_later_after_discharge"
          ? "pay_later_after_discharge"
          : "standard",
      packageSummary: operationPackage
        ? {
            packageId: String(operationPackage.packageId || ""),
            packageName: String(operationPackage.packageName || "Package"),
            fixedRate: packageFixedRate,
            paymentTiming:
              operationPackage.paymentTiming === "advance" ? "advance" : "after_operation",
            advancePaidAmount: packageAdvancePaidAmount,
            dueAmount: packageDueAmount,
          }
        : null,
      chargeLineItems,
      depositSummary: {
        totalDeposited,
        totalAdjusted: depositUsed,
        balance: Math.max(0, totalDeposited - depositUsed),
      },
      depositTransactions: Array.isArray(admissionData.depositTransactions) ? admissionData.depositTransactions : [],
      grossTotal,
      netPayable,
      refundAmount,
      totalAmount: netPayable,
      generatedAt: checkOutAt.toISOString(),
      status: "pending",
      paymentMethod: null,
      paidAt: null,
      paymentReference: null,
    }
    if (operationPackage && packageDueAmount > 0) {
      billingPayload.otherServices.push({
        description: `Operation package - ${String(operationPackage.packageName || "Package")}`,
        amount: packageDueAmount,
      })
    }
    if (depositUsed > 0) {
      billingPayload.otherServices.push({
        description: "Deposit adjusted",
        amount: -depositUsed,
      })
    }
    if (refundAmount > 0) {
      billingPayload.otherServices.push({
        description: "Deposit refund due",
        amount: refundAmount,
      })
    }

    await firestore.runTransaction(async (tx) => {
      const existingDepositTransactions = Array.isArray(admissionData.depositTransactions)
        ? admissionData.depositTransactions
        : []
      tx.update(admissionRef, {
        status: "completed",
        checkOutAt: checkOutAt.toISOString(),
        roomStays: normalizedRoomStays,
        dischargeRequest:
          admissionData.dischargeRequest && typeof admissionData.dischargeRequest === "object"
            ? {
                ...admissionData.dischargeRequest,
                status: "processed",
              }
            : null,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : admissionData.notes || null,
        depositSummary: {
          totalDeposited,
          totalAdjusted: depositUsed,
          balance: refundAmount,
        },
        depositTransactions:
          refundAmount > 0
            ? [
                ...existingDepositTransactions,
                {
                  id: `${admissionId}-dep-refund-${Date.now()}`,
                  type: "refund",
                  amount: refundAmount,
                  note: "Refund due at discharge",
                  paymentMode: null,
                  createdAt: checkOutAt.toISOString(),
                  createdBy: auth.user?.uid || null,
                },
              ]
            : existingDepositTransactions,
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

    return Response.json(
      { error: error?.message || "Failed to discharge patient" },
      { status: 500 }
    )
  }
}



