import { NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

export async function POST(req: Request) {
  try {
    const initResult = initFirebaseAdmin("patient-wallet-topup API")
    if (!initResult.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const { patientId, amount } = await req.json()
    const amt = Number(amount)
    if (!patientId || !amt || isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid patientId or amount' }, { status: 400 })
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


