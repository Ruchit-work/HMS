import { NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

export async function POST(req: Request) {
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

    const appointmentId = String(refund.appointmentId || '')
    if (!appointmentId) {
      return NextResponse.json({ error: 'Invalid appointmentId on refund request' }, { status: 400 })
    }

    const aptRef = firestore.collection('appointments').doc(appointmentId)
    const aptSnap = await aptRef.get()
    if (!aptSnap.exists) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    const apt = aptSnap.data() as any

    const amount = Number(refund.paymentAmount ?? apt.paymentAmount ?? apt.totalConsultationFee ?? 0)

    // Update appointment to reflect refund
    await aptRef.update({
      paymentStatus: 'refunded',
      refundApproved: true,
      refundRequested: false,
      paymentRefundedAmount: amount,
      paymentRefundedAt: new Date().toISOString(),
      status: 'doctor_cancelled',
      updatedAt: new Date().toISOString(),
    })

    // Mark refund request as approved
    await refundRef.update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: null, // can be set by auth context in future
    })

    // Credit patient's wallet (dummy refund box)
    const patientId = String(refund.patientId || apt.patientId || '')
    if (patientId) {
      const patientRef = firestore.collection('patients').doc(patientId)
      await patientRef.set({
        walletBalance: admin.firestore.FieldValue.increment(amount)
      }, { merge: true })

      // Record wallet transaction
      await firestore.collection('wallet_transactions').add({
        patientId,
        appointmentId,
        refundRequestId,
        type: 'refund',
        amount,
        createdAt: new Date().toISOString()
      })
    }

    return NextResponse.json({ ok: true, amountRefunded: amount })
  } catch (e: any) {
    console.error('approve-refund error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


