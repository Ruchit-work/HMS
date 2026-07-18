import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { assertAdmissionHospitalAccess } from "@/shared/utils/firebase/serverHospitalQueries"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"

interface Params {
  admissionId: string
}

const DAY_MS = 24 * 60 * 60 * 1000

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
    const firestore = admin.firestore()
    const admissionRef = firestore.collection("admissions").doc(admissionId)

    if (body?.plannedAction === "ready_to_admit") {
      const nowIso = new Date().toISOString()
      const nowMs = Date.now()
      const readyWindowEndMs = nowMs + DAY_MS
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(admissionRef)
        if (!snap.exists) throw new Error("Admission not found")
        const data = snap.data() || {}
        if (!(await assertAdmissionHospitalAccess(auth.user!.uid, data))) {
          throw new Error("Forbidden: hospital access mismatch")
        }
        const status = String(data.status || "")
        if (status !== "scheduled") {
          throw new Error("Only scheduled admissions can be marked ready to admit")
        }
        const doctorId = String(data.doctorId || "").trim()
        if (!doctorId || doctorId === "unassigned") {
          throw new Error("Please assign a doctor before marking ready to admit")
        }
        const roomId = String(data.roomId || "")
        if (!roomId) throw new Error("Room not assigned to this admission")

        const plannedIso = String(data.plannedAdmitAt || data.checkInAt || "")
        const plannedMs = new Date(plannedIso).getTime()
        if (!Number.isFinite(plannedMs)) {
          throw new Error("Valid planned admission time is required")
        }
        if (plannedMs < nowMs || plannedMs > readyWindowEndMs) {
          throw new Error("Ready to admit is allowed only within 24 hours before planned time")
        }

        const roomRef = firestore.collection("rooms").doc(roomId)
        const roomSnap = await tx.get(roomRef)
        if (!roomSnap.exists) throw new Error("Assigned room not found")
        const roomData = roomSnap.data() || {}
        const roomStatus = String(roomData.status || "")
        if (roomStatus && roomStatus !== "available" && roomStatus !== "occupied") {
          throw new Error("Assigned room is not available for admission")
        }

        tx.update(admissionRef, {
          status: "admitted",
          checkInAt: nowIso,
          updatedAt: nowIso,
        })
        tx.update(roomRef, {
          status: "occupied",
          updatedAt: nowIso,
        })
      })
      return Response.json({ success: true })
    }

    if (body?.plannedAction === "postpone") {
      const plannedAdmitAt =
        typeof body?.plannedAdmitAt === "string" ? body.plannedAdmitAt.trim() : ""
      const plannedMs = new Date(plannedAdmitAt).getTime()
      if (!plannedAdmitAt || !Number.isFinite(plannedMs)) {
        return Response.json({ error: "Valid plannedAdmitAt is required for postponing" }, { status: 400 })
      }
      if (plannedMs <= Date.now()) {
        return Response.json({ error: "Planned admit date/time must be in the future" }, { status: 400 })
      }
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(admissionRef)
        if (!snap.exists) throw new Error("Admission not found")
        const data = snap.data() || {}
        if (!(await assertAdmissionHospitalAccess(auth.user!.uid, data))) {
          throw new Error("Forbidden: hospital access mismatch")
        }
        const status = String(data.status || "")
        if (status !== "scheduled") {
          throw new Error("Only scheduled admissions can be postponed")
        }
        tx.update(admissionRef, {
          status: "scheduled",
          plannedAdmitAt,
          checkInAt: plannedAdmitAt,
          updatedAt: new Date().toISOString(),
        })
      })
      return Response.json({ success: true })
    }

    const existingSnap = await admissionRef.get()
    if (!existingSnap.exists) {
      return Response.json({ error: "Admission not found" }, { status: 404 })
    }
    if (!(await assertAdmissionHospitalAccess(auth.user!.uid, existingSnap.data()))) {
      return Response.json({ error: "Forbidden: hospital access mismatch" }, { status: 403 })
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (typeof body?.expectedDischargeAt === "string") {
      updates.expectedDischargeAt = body.expectedDischargeAt
    }
    if (typeof body?.notes === "string") {
      updates.notes = body.notes.trim() || null
    }
    if (typeof body?.doctorId === "string" && body.doctorId.trim()) {
      updates.doctorId = body.doctorId.trim()
    }
    if (typeof body?.doctorName === "string") {
      updates.doctorName = body.doctorName.trim() || "To be assigned"
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

      await firestore.runTransaction(async (tx) => {
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

    await admissionRef.update(updates)
    const existingData = existingSnap.data() || {}
    const billingFields = ["charges", "paymentTerms", "operationPackage"].filter(
      (field) => Object.prototype.hasOwnProperty.call(updates, field)
    )
    if (billingFields.length > 0 && typeof existingData.hospitalId === "string") {
      void auditLogger.logForUser(auth.user, {
        hospitalId: existingData.hospitalId,
        branchId:
          typeof existingData.branchId === "string" ? existingData.branchId : null,
        module: "Billing",
        entityType: "admission",
        entityId: admissionId,
        action: AUDIT_ACTIONS.BILL_EDITED,
        summary: `Bill details for admission ${existingData.ipdNo || admissionId} were edited.`,
        metadata: { fields: billingFields },
      })
    }
    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to update admission" },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(_req)
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
    const initResult = initFirebaseAdmin("receptionist-delete-admission API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }
    const { admissionId } = await context.params
    if (!admissionId) {
      return Response.json({ error: "Missing admissionId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const admissionRef = firestore.collection("admissions").doc(admissionId)
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(admissionRef)
      if (!snap.exists) throw new Error("Admission not found")
      const data = snap.data() || {}
      const status = String(data.status || "")
      const checkOutAt = data.checkOutAt ? String(data.checkOutAt) : ""
      if (status === "admitted" && !checkOutAt) {
        throw new Error("Cannot delete an active admitted patient")
      }

      const roomId = String(data.roomId || "")
      if (roomId && status === "scheduled") {
        const roomRef = firestore.collection("rooms").doc(roomId)
        tx.set(
          roomRef,
          {
            status: "available",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      }
      tx.delete(admissionRef)
    })

    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to delete admission" },
      { status: 500 }
    )
  }
}
