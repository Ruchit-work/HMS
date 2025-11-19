import { NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function POST(req: Request) {
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

    await db.collection('wallet_transactions').add({
      patientId: String(patientId),
      type: 'topup',
      amount: amt,
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('wallet topup error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}


