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

export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
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
    const initResult = initFirebaseAdmin("receptionist-process-billing API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

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
      return Response.json({ error: "Billing can be processed only for admitted patients" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const roomStays = Array.isArray(admissionData.roomStays) ? admissionData.roomStays : []
    const normalizedRoomStays = roomStays.length
      ? roomStays
      : [
          {
            roomId: String(admissionData.roomId || ""),
            roomNumber: String(admissionData.roomNumber || ""),
            roomType: String(admissionData.roomType || "general"),
            customRoomTypeName: admissionData.customRoomTypeName || null,
            ratePerDay: Number(admissionData.roomRatePerDay || 0),
            fromAt: String(admissionData.checkInAt || nowIso),
            toAt: null,
          },
        ]

    const roomStayBreakdown = normalizedRoomStays.map((stay: any) => {
      const fromDate = new Date(String(stay.fromAt || nowIso))
      const toDate = new Date(String(stay.toAt || nowIso))
      const stayDays = countCalendarDaysInclusive(fromDate.toISOString(), toDate.toISOString())
      const ratePerDay = Number(stay.ratePerDay || 0)
      return {
        roomId: String(stay.roomId || ""),
        roomNumber: String(stay.roomNumber || ""),
        roomType: String(stay.roomType || ""),
        customRoomTypeName: stay.customRoomTypeName || null,
        ratePerDay,
        fromAt: fromDate.toISOString(),
        toAt: toDate.toISOString(),
        stayDays,
        amount: stayDays * ratePerDay,
      }
    })

    const roomCharges = roomStayBreakdown.reduce((sum, segment) => sum + Number(segment.amount || 0), 0)
    const extraCharges = admissionData.charges || {}
    const chargeLineItems = Array.isArray(admissionData.chargeLineItems) ? admissionData.chargeLineItems : []
    const doctorFee = Number(extraCharges.doctorRoundFee || 0)
    const nurseFee = Number(extraCharges.nurseRoundFee || 0)
    const medicineCharges = Number(extraCharges.medicineCharges || 0)
    const injectionCharges = Number(extraCharges.injectionCharges || 0)
    const bottleCharges = Number(extraCharges.bottleCharges || 0)
    const facilityCharges = Number(extraCharges.facilityCharges || 0)
    const otherCharges = Number(extraCharges.otherCharges || 0)
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
    const grossTotal =
      (packageInclusive
        ? packageDueAmount
        : roomCharges +
          doctorFee +
          nurseFee +
          medicineCharges +
          injectionCharges +
          bottleCharges +
          facilityCharges +
          otherCharges)
    const totalDeposited = Number(admissionData?.depositSummary?.totalDeposited || 0)
    const depositUsed = Math.min(totalDeposited, grossTotal)
    const netPayable = Math.max(0, grossTotal - totalDeposited)
    const refundAmount = Math.max(0, totalDeposited - grossTotal)

    const existingBillingSnap = await firestore
      .collection("billing_records")
      .where("admissionId", "==", admissionId)
      .limit(20)
      .get()
    const existingPendingDoc = existingBillingSnap.docs.find((docSnap) => {
      const data = docSnap.data() || {}
      return data.status === "pending"
    })

    const billingPayload = {
      roomBillingPolicy: "calendar_day_full_charge",
      admissionId,
      appointmentId: String(admissionData.appointmentId || ""),
      patientId: String(admissionData.patientId || ""),
      patientUid: String(admissionData.patientUid || "") || null,
      patientName: admissionData.patientName || null,
      doctorId: String(admissionData.doctorId || ""),
      doctorName: admissionData.doctorName || null,
      roomCharges: packageInclusive ? 0 : roomCharges,
      roomStayBreakdown,
      doctorFee: packageInclusive ? 0 : doctorFee,
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
        !packageInclusive && otherCharges
          ? {
              description:
                typeof extraCharges.otherDescription === "string" && extraCharges.otherDescription.trim()
                  ? extraCharges.otherDescription.trim()
                  : "Additional charges",
              amount: otherCharges,
            }
          : null,
        operationPackage && packageDueAmount > 0
          ? {
              description: `Operation package - ${String(operationPackage.packageName || "Package")}`,
              amount: packageDueAmount,
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
      generatedAt: nowIso,
      status: "pending",
      paymentMethod: null,
      paidAt: null,
      paymentReference: null,
      updatedAt: nowIso,
    }

    let billingId = ""
    if (existingPendingDoc) {
      await existingPendingDoc.ref.set(billingPayload, { merge: true })
      billingId = existingPendingDoc.id
    } else {
      const newBillingRef = firestore.collection("billing_records").doc()
      await newBillingRef.set({
        ...billingPayload,
        createdAt: nowIso,
      })
      billingId = newBillingRef.id
    }

    await admissionRef.set(
      {
        billingId,
        updatedAt: nowIso,
      },
      { merge: true }
    )

    return Response.json({ success: true, billingId, totalAmount: netPayable, grossTotal, roomCharges })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to process billing" },
      { status: 500 }
    )
  }
}
