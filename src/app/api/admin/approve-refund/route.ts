import { NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import {
  assertUserHospitalAccess,
  getHospitalCollectionPath,
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"

export async function POST(req: Request) {
  const rateLimitResult = await applyRateLimit(req, "ADMIN")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult
  }

  const auth = await authenticateRequest(req, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (!auth.user) {
    return NextResponse.json({ error: "Authenticated user context missing" }, { status: 403 })
  }
  const adminUser = auth.user

  const rateLimitWithUser = await applyRateLimit(req, "ADMIN", adminUser.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser
  }

  try {
    const initResult = initFirebaseAdmin("approve-refund API")
    if (!initResult.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    const { refundRequestId } = await req.json()
    if (!refundRequestId) {
      return NextResponse.json({ error: 'refundRequestId is required' }, { status: 400 })
    }

    const firestore = admin.firestore()
    const refundRef = firestore.collection('refund_requests').doc(refundRequestId)
    const refundSnap = await refundRef.get()
    if (!refundSnap.exists) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 })
    }
    const refund = refundSnap.data() as any
    if (refund.status !== 'pending') {
      return NextResponse.json({ error: 'Refund request is not pending' }, { status: 400 })
    }

    const superAdmin = await isPlatformSuperAdmin(adminUser.uid)
    const adminHospitalId = await getUserActiveHospitalId(adminUser.uid)
    const refundHospitalId =
      typeof refund?.hospitalId === 'string' && refund.hospitalId.trim()
        ? refund.hospitalId.trim()
        : null

    if (!superAdmin) {
      if (!adminHospitalId) {
        return NextResponse.json({ error: 'Hospital context required' }, { status: 403 })
      }
      if (refundHospitalId && refundHospitalId !== adminHospitalId) {
        return NextResponse.json({ error: 'Refund belongs to another hospital' }, { status: 403 })
      }
    }

    const appointmentId = String(refund?.appointmentId || '')
    if (!appointmentId) {
      return NextResponse.json({ error: 'Invalid appointmentId on refund request' }, { status: 400 })
    }

    const hospitalForApt = refundHospitalId || adminHospitalId
    let aptRef = hospitalForApt
      ? firestore.collection(getHospitalCollectionPath(hospitalForApt, 'appointments')).doc(appointmentId)
      : firestore.collection('appointments').doc(appointmentId)
    let aptSnap = await aptRef.get()

    if (!aptSnap.exists && hospitalForApt) {
      aptRef = firestore.collection('appointments').doc(appointmentId)
      aptSnap = await aptRef.get()
    }

    if (!aptSnap.exists) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    const apt = aptSnap.data() as any
    const aptHospitalId =
      typeof apt?.hospitalId === 'string' && apt.hospitalId.trim()
        ? apt.hospitalId.trim()
        : hospitalForApt

    if (!superAdmin && aptHospitalId) {
      const ok = await assertUserHospitalAccess(adminUser.uid, aptHospitalId)
      if (!ok) {
        return NextResponse.json({ error: 'Appointment belongs to another hospital' }, { status: 403 })
      }
    }

    const { getHospitalBillingSettings } = await import('@/server/hospitalBillingSettings')
    const billingSettings = await getHospitalBillingSettings(aptHospitalId || hospitalForApt)
    if (billingSettings.refundPolicy === 'disabled') {
      return NextResponse.json(
        { error: 'This hospital does not provide refunds.' },
        { status: 403 }
      )
    }

    const amount = Number(refund?.paymentAmount ?? apt?.paymentAmount ?? apt?.totalConsultationFee ?? 0)
    const patientId = String(refund?.patientId || apt?.patientId || "")

    if (!patientId) {
      return NextResponse.json({ error: "Patient ID missing on refund request" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    await aptRef.update({
      paymentStatus: 'refunded',
      refundApproved: true,
      refundRequested: false,
      paymentRefundedAmount: amount,
      paymentRefundedAt: nowIso,
      status: 'cancelled',
      billingStatus: 'cancelled',
      remainingAmount: 0,
      cancelledAt: nowIso,
      cancelledBy: adminUser.uid,
      cancelledByRole: 'admin_refund',
      updatedAt: nowIso,
    })

    await refundRef.update({
      status: 'approved',
      approvedAt: nowIso,
      approvedBy: adminUser.uid,
    })

    // Release the doctor's booked slot so the time becomes available again.
    try {
      const doctorId = String(apt?.doctorId || '')
      const date = String(apt?.appointmentDate || '')
      const rawTime = String(apt?.appointmentTime || '')
      if (doctorId && date && rawTime) {
        const { normalizeTime } = await import('@/shared/utils/timeSlots')
        const slotIds = new Set<string>()
        for (const time of [rawTime, normalizeTime(rawTime)]) {
          if (time) slotIds.add(`${doctorId}_${date}_${time.replace(/[:\s]/g, '-')}`)
        }
        for (const slotId of slotIds) {
          const slotRef = firestore.collection('appointmentSlots').doc(slotId)
          const slotSnap = await slotRef.get()
          if (!slotSnap.exists) continue
          const slotAppointmentId = slotSnap.data()?.appointmentId
          if (!slotAppointmentId || String(slotAppointmentId) === appointmentId) {
            await slotRef.delete()
          }
        }
      }
    } catch {
      // Slot cleanup is best-effort; the refund itself already succeeded.
    }

    const auditHospitalId = aptHospitalId || hospitalForApt
    if (auditHospitalId) {
      void auditLogger.logForUser(adminUser, {
        hospitalId: auditHospitalId,
        branchId: typeof apt?.branchId === "string" ? apt.branchId : null,
        module: "Billing",
        entityType: "refund_request",
        entityId: String(refundRequestId),
        action: AUDIT_ACTIONS.REFUND_APPROVED,
        summary: `Refund of ₹${amount.toLocaleString("en-IN")} approved.`,
        metadata: { appointmentId, patientId, amount },
      })
    }

    return NextResponse.json({ ok: true, amountRefunded: amount })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 })
  }
}
