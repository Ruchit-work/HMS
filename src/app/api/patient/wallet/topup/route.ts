import { NextResponse } from 'next/server'
import admin from 'firebase-admin'

function initAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (privateKey && privateKey.startsWith("\"") && privateKey.endsWith("\"")) {
      privateKey = privateKey.slice(1, -1)
    }
    if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n")
    if (!projectId || !clientEmail || !privateKey) return false
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function POST(req: Request) {
  try {
    const ok = initAdmin()
    if (!ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

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


