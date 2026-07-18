import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getHospitalCollectionPath,
  resolveAuthorizedHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { normalizeTime } from "@/shared/utils/timeSlots"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import { getHospitalBillingSettings } from "@/server/hospitalBillingSettings"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"

interface Params {
  appointmentId: string
}

const HOSPITAL_NO_REFUNDS = "This hospital does not provide refunds."
const PAID_CANNOT_CANCEL =
  "This appointment has already been paid and cannot be cancelled."

async function releaseAppointmentSlot(
  firestore: FirebaseFirestore.Firestore,
  appointment: Record<string, any>,
  appointmentId: string
): Promise<void> {
  const doctorId = String(appointment.doctorId || "")
  const date = String(appointment.appointmentDate || "")
  const rawTime = String(appointment.appointmentTime || "")
  if (!doctorId || !date || !rawTime) return

  const slotIds = new Set<string>()
  for (const time of [rawTime, normalizeTime(rawTime)]) {
    if (time) slotIds.add(`${doctorId}_${date}_${time.replace(/[:\s]/g, "-")}`)
  }

  for (const slotId of slotIds) {
    try {
      const slotRef = firestore.collection("appointmentSlots").doc(slotId)
      const slotSnap = await slotRef.get()
      if (!slotSnap.exists) continue
      const slotAppointmentId = slotSnap.data()?.appointmentId
      if (!slotAppointmentId || String(slotAppointmentId) === appointmentId) {
        await slotRef.delete()
      }
    } catch {
      // Slot may already be released — never fail the cancellation for this.
    }
  }
}

/**
 * POST /api/appointments/[appointmentId]/cancel
 *
 * Policy is hospital-configurable via settings.billing:
 * unpaid cancel, paid disallow / keep payment / refund request / auto refund.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const rateLimitResult = await applyRateLimit(request, "BOOKING")
  if (rateLimitResult instanceof Response) return rateLimitResult

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)

  const role = auth.user?.role || ""
  const uid = auth.user?.uid || ""
  if (!uid || !["admin", "receptionist", "patient", "doctor"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("appointment cancel API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const { appointmentId } = await context.params
    if (!appointmentId || appointmentId.trim().length === 0 || appointmentId.length > 128) {
      return NextResponse.json({ error: "Invalid appointment ID" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action: "cancel" | "request_refund" =
      body?.action === "request_refund" ? "request_refund" : "cancel"
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : ""
    const requestedHospitalId =
      typeof body?.hospitalId === "string" && body.hospitalId.trim() ? body.hospitalId.trim() : null

    const firestore = admin.firestore()
    const isStaff = role === "admin" || role === "receptionist"

    const candidateHospitalIds: string[] = []
    if (isStaff) {
      const authorized = await resolveAuthorizedHospitalId(uid, requestedHospitalId)
      if (!authorized) {
        return NextResponse.json(
          { error: "Hospital access denied or hospital context missing" },
          { status: 403 }
        )
      }
      candidateHospitalIds.push(authorized)
    } else if (requestedHospitalId) {
      candidateHospitalIds.push(requestedHospitalId)
    }

    let appointmentRef: FirebaseFirestore.DocumentReference | null = null
    let appointment: Record<string, any> | null = null
    let resolvedHospitalId: string | null = candidateHospitalIds[0] || null

    for (const hospitalId of candidateHospitalIds) {
      const ref = firestore
        .collection(getHospitalCollectionPath(hospitalId, "appointments"))
        .doc(appointmentId)
      const snap = await ref.get()
      if (snap.exists) {
        appointmentRef = ref
        appointment = snap.data() || {}
        resolvedHospitalId = hospitalId
        break
      }
    }
    if (!appointmentRef) {
      const rootRef = firestore.collection("appointments").doc(appointmentId)
      const rootSnap = await rootRef.get()
      if (rootSnap.exists) {
        appointmentRef = rootRef
        appointment = rootSnap.data() || {}
        resolvedHospitalId =
          typeof appointment.hospitalId === "string" && appointment.hospitalId.trim()
            ? appointment.hospitalId.trim()
            : resolvedHospitalId
      }
    }
    if (!appointmentRef || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    if (role === "patient") {
      const userPatientId =
        typeof auth.user?.data?.patientId === "string" ? auth.user.data.patientId : ""
      const owns =
        String(appointment.patientUid || "") === uid ||
        String(appointment.patientId || "") === uid ||
        (userPatientId !== "" && String(appointment.patientId || "") === userPatientId)
      if (!owns) {
        return NextResponse.json(
          { error: "You can only cancel your own appointments" },
          { status: 403 }
        )
      }
    } else if (role === "doctor") {
      if (String(appointment.doctorId || "") !== uid) {
        return NextResponse.json(
          { error: "You can only cancel your own appointments" },
          { status: 403 }
        )
      }
    }

    const billingSettings = await getHospitalBillingSettings(
      resolvedHospitalId || appointment.hospitalId || null
    )

    const currentStatus = String(appointment.status || "")
    const paymentStatus = String(appointment.paymentStatus || "").toLowerCase()
    const hasPaidAt = Boolean(appointment.paidAt) && String(appointment.paidAt).trim() !== ""
    const isRefunded = paymentStatus === "refunded"
    const isPaid = !isRefunded && (paymentStatus === "paid" || hasPaidAt)
    const refundAmount = Number(
      appointment.paymentAmount ?? appointment.totalConsultationFee ?? 0
    )

    if (currentStatus === "cancelled" || currentStatus === "doctor_cancelled") {
      return NextResponse.json({ error: "Appointment is already cancelled" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const hospitalId = String(resolvedHospitalId || appointment.hospitalId || "")
    const branchId =
      typeof appointment.branchId === "string" ? appointment.branchId : null
    const logCancellation = (policy: string) => {
      if (!hospitalId) return
      void auditLogger.logForUser(auth.user, {
        hospitalId,
        branchId,
        module: "Appointment",
        entityType: "appointment",
        entityId: appointmentId,
        action: AUDIT_ACTIONS.APPOINTMENT_CANCELLED,
        summary: `Appointment ${appointmentId} cancelled.`,
        metadata: { policy, paymentStatus, reason: reason || null },
      })
    }

    const createRefundRequest = async () => {
      if (billingSettings.refundPolicy === "disabled") {
        return NextResponse.json({ error: HOSPITAL_NO_REFUNDS }, { status: 403 })
      }
      if (!isPaid) {
        return NextResponse.json(
          {
            error:
              "Refund requests are only for paid appointments. Unpaid appointments can be cancelled directly.",
          },
          { status: 400 }
        )
      }
      if (currentStatus === "refund_requested" || appointment.refundRequested === true) {
        return NextResponse.json(
          { error: "A refund request is already pending for this appointment" },
          { status: 400 }
        )
      }

      if (billingSettings.refundPolicy === "automatic") {
        await appointmentRef!.update({
          status: "cancelled",
          billingStatus: "cancelled",
          remainingAmount: 0,
          paymentStatus: "refunded",
          refundApproved: true,
          refundRequested: false,
          paymentRefundedAmount: refundAmount,
          paymentRefundedAt: nowIso,
          cancelledAt: nowIso,
          cancelledBy: uid,
          cancelledByRole: role,
          ...(reason ? { cancellationReason: reason } : {}),
          updatedAt: nowIso,
        })
        await releaseAppointmentSlot(firestore, appointment!, appointmentId)
        logCancellation("automatic_refund")
        return NextResponse.json({
          success: true,
          status: "cancelled",
          paymentStatus: "refunded",
          message: "Appointment cancelled and refund processed automatically.",
        })
      }

      const refundRequestRef = await firestore.collection("refund_requests").add({
        appointmentId,
        hospitalId: appointment!.hospitalId || resolvedHospitalId || null,
        branchId: appointment!.branchId || null,
        patientId: appointment!.patientId || appointment!.patientUid || "",
        patientUid: appointment!.patientUid || null,
        doctorId: appointment!.doctorId || "",
        paymentAmount: refundAmount,
        paymentMethod: appointment!.paymentMethod || "cash",
        paymentType: appointment!.paymentType || "full",
        reason: reason || "cancellation_requested",
        status: "pending",
        requestedBy: uid,
        requestedByRole: role,
        createdAt: nowIso,
      })

      await appointmentRef!.update({
        status: "refund_requested",
        refundRequested: true,
        statusBeforeRefundRequest: currentStatus,
        updatedAt: nowIso,
      })

      if (hospitalId) {
        void auditLogger.logForUser(auth.user, {
          hospitalId,
          branchId,
          module: "Billing",
          entityType: "refund_request",
          entityId: refundRequestRef.id,
          action: AUDIT_ACTIONS.REFUND_REQUESTED,
          summary: `Refund of ₹${refundAmount.toLocaleString("en-IN")} requested for appointment ${appointmentId}.`,
          metadata: { appointmentId, amount: refundAmount },
        })
      }

      return NextResponse.json({
        success: true,
        status: "refund_requested",
        refundRequestId: refundRequestRef.id,
        message:
          "Refund request created. The appointment will be cancelled once the refund is approved.",
      })
    }

    if (action === "request_refund") {
      return createRefundRequest()
    }

    // action === "cancel"
    if (currentStatus === "completed" && !isPaid) {
      return NextResponse.json(
        { error: "Completed appointments cannot be cancelled" },
        { status: 400 }
      )
    }

    if (isPaid) {
      const policy = billingSettings.paidAppointmentCancellation

      if (policy === "disallow") {
        return NextResponse.json({ error: PAID_CANNOT_CANCEL }, { status: 400 })
      }

      if (policy === "create_refund_request") {
        return createRefundRequest()
      }

      if (policy === "auto_refund") {
        if (billingSettings.refundPolicy === "disabled") {
          return NextResponse.json({ error: HOSPITAL_NO_REFUNDS }, { status: 403 })
        }
        await appointmentRef.update({
          status: "cancelled",
          billingStatus: "cancelled",
          remainingAmount: 0,
          paymentStatus: "refunded",
          refundApproved: true,
          refundRequested: false,
          paymentRefundedAmount: refundAmount,
          paymentRefundedAt: nowIso,
          cancelledAt: nowIso,
          cancelledBy: uid,
          cancelledByRole: role,
          ...(reason ? { cancellationReason: reason } : {}),
          updatedAt: nowIso,
        })
        await releaseAppointmentSlot(firestore, appointment, appointmentId)
        logCancellation("auto_refund")
        return NextResponse.json({
          success: true,
          status: "cancelled",
          paymentStatus: "refunded",
          message: "Appointment cancelled and refund processed automatically.",
        })
      }

      // keep_payment (default): cancel appointment, leave payment as paid revenue.
      await appointmentRef.update({
        status: "cancelled",
        billingStatus: "cancelled",
        remainingAmount: 0,
        cancelledAt: nowIso,
        cancelledBy: uid,
        cancelledByRole: role,
        ...(reason ? { cancellationReason: reason } : {}),
        updatedAt: nowIso,
      })
      await releaseAppointmentSlot(firestore, appointment, appointmentId)
      logCancellation("keep_payment")
      return NextResponse.json({
        success: true,
        status: "cancelled",
        paymentStatus: paymentStatus || "paid",
        message: "Appointment cancelled. Payment was retained per hospital policy.",
      })
    }

    await appointmentRef.update({
      status: "cancelled",
      billingStatus: "cancelled",
      paymentStatus: paymentStatus || "unpaid",
      remainingAmount: 0,
      cancelledAt: nowIso,
      cancelledBy: uid,
      cancelledByRole: role,
      ...(reason ? { cancellationReason: reason } : {}),
      updatedAt: nowIso,
    })

    await releaseAppointmentSlot(firestore, appointment, appointmentId)
    logCancellation("unpaid")

    return NextResponse.json({
      success: true,
      status: "cancelled",
      message: "Appointment cancelled",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel appointment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
