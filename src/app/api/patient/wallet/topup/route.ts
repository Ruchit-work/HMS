import { NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { applyRateLimit } from "@/utils/rateLimit"
import { logPaymentEvent } from "@/utils/auditLog"

export async function POST(req: Request) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(req, "PAYMENT")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires patient, receptionist, or admin role
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  const isPatient = auth.user?.role === "patient"
  const isStaff = auth.user?.role === "receptionist" || auth.user?.role === "admin"
  if (!isPatient && !isStaff) {
    return NextResponse.json(
      { error: "Access denied. This endpoint requires patient, receptionist, or admin role." },
      { status: 403 }
    )
  }

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(req, "PAYMENT", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
  }

  try {
    const initResult = initFirebaseAdmin("patient-wallet-topup API")
    if (!initResult.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const { patientId, amount } = await req.json()
    const amt = Number(amount)
    if (!patientId || !amt || isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid patientId or amount' }, { status: 400 })
    }

    // If patient, verify they can only top up their own wallet
    if (isPatient && patientId !== auth.user?.uid) {
      return NextResponse.json({ error: "You can only top up your own wallet" }, { status: 403 })
    }

    const db = admin.firestore()
    await db.collection('patients').doc(String(patientId)).set({
      walletBalance: admin.firestore.FieldValue.increment(amt)
    }, { merge: true })

    const transactionRef = await db.collection('wallet_transactions').add({
      patientId: String(patientId),
      type: 'topup',
      amount: amt,
      createdAt: new Date().toISOString()
    })

    // Log successful wallet topup
    await logPaymentEvent(
      "wallet_topup",
      req,
      auth.user?.uid,
      auth.user?.email ?? undefined,
      auth.user?.role,
      amt,
      undefined,
      transactionRef.id,
      patientId
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('wallet topup error', e)
    
    // Log failed wallet topup
    if (auth.success && auth.user) {
      await logPaymentEvent(
        "wallet_topup_failed",
        req,
        auth.user.uid,
        auth.user.email ?? undefined,
        auth.user.role,
        undefined,
        undefined,
        undefined,
        undefined,
        e?.message || 'Internal error'
      )
    }

    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


