import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

interface Params {
  admissionId: string
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
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
    const initResult = initFirebaseAdmin("receptionist-update-admission API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { admissionId } = await context.params
    if (!admissionId) {
      return Response.json({ error: "Missing admissionId" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (typeof body?.expectedDischargeAt === "string") {
      updates.expectedDischargeAt = body.expectedDischargeAt
    }
    if (typeof body?.notes === "string") {
      updates.notes = body.notes.trim() || null
    }
    if (body?.charges && typeof body.charges === "object") {
      updates.charges = {
        doctorRoundFee: Number(body.charges.doctorRoundFee || 0),
        nurseRoundFee: Number(body.charges.nurseRoundFee || 0),
        medicineCharges: Number(body.charges.medicineCharges || 0),
        injectionCharges: Number(body.charges.injectionCharges || 0),
        bottleCharges: Number(body.charges.bottleCharges || 0),
        facilityCharges: Number(body.charges.facilityCharges || 0),
        otherCharges: Number(body.charges.otherCharges || 0),
        otherDescription:
          typeof body.charges.otherDescription === "string" && body.charges.otherDescription.trim()
            ? body.charges.otherDescription.trim()
            : null,
      }
    }
    if (body?.paymentTerms === "standard" || body?.paymentTerms === "pay_later_after_discharge") {
      updates.paymentTerms = body.paymentTerms
    }
    if (body?.operationPackage && typeof body.operationPackage === "object") {
      updates.operationPackage = {
        packageId: String(body.operationPackage.packageId || ""),
        packageName: String(body.operationPackage.packageName || ""),
        fixedRate: Number(body.operationPackage.fixedRate || 0),
        paymentTiming:
          body.operationPackage.paymentTiming === "advance" ? "advance" : "after_operation",
        advancePaidAmount: Number(body.operationPackage.advancePaidAmount || 0),
        notes:
          typeof body.operationPackage.notes === "string" && body.operationPackage.notes.trim()
            ? body.operationPackage.notes.trim()
            : null,
      }
    } else if (body?.operationPackage === null) {
      updates.operationPackage = null
    }

    if (body?.depositAction && typeof body.depositAction === "object") {
      const actionType =
        body.depositAction.type === "topup" || body.depositAction.type === "refund"
          ? body.depositAction.type
          : null
      const amount = Math.max(0, Number(body.depositAction.amount || 0))
      if (!actionType || amount <= 0) {
        return Response.json({ error: "Invalid deposit action" }, { status: 400 })
      }

      const admissionRef = admin.firestore().collection("admissions").doc(admissionId)
      await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(admissionRef)
        if (!snap.exists) throw new Error("Admission not found")
        const data = snap.data() || {}
        const existingSummary =
          data.depositSummary && typeof data.depositSummary === "object"
            ? data.depositSummary
            : { totalDeposited: 0, totalAdjusted: 0, balance: 0 }
        const existingTransactions = Array.isArray(data.depositTransactions) ? data.depositTransactions : []
        const nextTotalDeposited =
          actionType === "topup"
            ? Number(existingSummary.totalDeposited || 0) + amount
            : Math.max(0, Number(existingSummary.totalDeposited || 0) - amount)
        const nextBalance = Math.max(0, nextTotalDeposited - Number(existingSummary.totalAdjusted || 0))
        const nextTransaction = {
          id: `${admissionId}-dep-${Date.now()}`,
          type: actionType,
          amount,
          note:
            typeof body.depositAction.note === "string" && body.depositAction.note.trim()
              ? body.depositAction.note.trim()
              : actionType === "topup"
                ? "Deposit top-up"
                : "Deposit refund",
          paymentMode:
            body.depositAction.paymentMode === "upi" ||
            body.depositAction.paymentMode === "card" ||
            body.depositAction.paymentMode === "cash" ||
            body.depositAction.paymentMode === "other"
              ? body.depositAction.paymentMode
              : "cash",
          createdAt: new Date().toISOString(),
          createdBy: auth.user?.uid || null,
        }

        tx.update(admissionRef, {
          updatedAt: new Date().toISOString(),
          depositSummary: {
            totalDeposited: nextTotalDeposited,
            totalAdjusted: Number(existingSummary.totalAdjusted || 0),
            balance: nextBalance,
          },
          depositTransactions: [...existingTransactions, nextTransaction],
        })
      })

      return Response.json({ success: true })
    }

    await admin.firestore().collection("admissions").doc(admissionId).update(updates)
    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to update admission" },
      { status: 500 }
    )
  }
}
