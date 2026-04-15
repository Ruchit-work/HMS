import { getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'

type IdempotencyAcquireResult =
  | { kind: 'acquired' }
  | { kind: 'completed'; statusCode: number; response: Record<string, unknown> }
  | { kind: 'in_progress' }

type IdempotencyScope = 'dispense' | 'sales_return' | 'purchase_order_receive'

type IdempotencyDoc = {
  key: string
  scope: IdempotencyScope
  status: 'processing' | 'completed'
  statusCode?: number
  response?: Record<string, unknown>
  userId: string
  createdAt: string
  updatedAt: string
}

function getIdempotencyDocId(scope: IdempotencyScope, key: string): string {
  return `${scope}_${key}`
}

export function sanitizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 120) return null
  return trimmed
}

export async function acquireIdempotencyKey(params: {
  db: FirebaseFirestore.Firestore
  hospitalId: string
  scope: IdempotencyScope
  key: string
  userId: string
}): Promise<IdempotencyAcquireResult> {
  const { db, hospitalId, scope, key, userId } = params
  const now = new Date().toISOString()
  const path = getPharmacyCollectionPath(hospitalId, 'idempotency')
  const ref = db.collection(path).doc(getIdempotencyDocId(scope, key))

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists) {
      const data = snap.data() as IdempotencyDoc
      if (data.status === 'completed' && data.response && typeof data.statusCode === 'number') {
        return { kind: 'completed', statusCode: data.statusCode, response: data.response } as IdempotencyAcquireResult
      }
      return { kind: 'in_progress' } as IdempotencyAcquireResult
    }

    tx.set(ref, {
      key,
      scope,
      status: 'processing',
      userId,
      createdAt: now,
      updatedAt: now,
    } satisfies IdempotencyDoc)
    return { kind: 'acquired' } as IdempotencyAcquireResult
  })
}

export async function completeIdempotencyKey(params: {
  db: FirebaseFirestore.Firestore
  hospitalId: string
  scope: IdempotencyScope
  key: string
  statusCode: number
  response: Record<string, unknown>
}): Promise<void> {
  const { db, hospitalId, scope, key, statusCode, response } = params
  const path = getPharmacyCollectionPath(hospitalId, 'idempotency')
  await db.collection(path).doc(getIdempotencyDocId(scope, key)).set(
    {
      status: 'completed',
      statusCode,
      response,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}

export async function clearIdempotencyKey(params: {
  db: FirebaseFirestore.Firestore
  hospitalId: string
  scope: IdempotencyScope
  key: string
}): Promise<void> {
  const { db, hospitalId, scope, key } = params
  const path = getPharmacyCollectionPath(hospitalId, 'idempotency')
  await db.collection(path).doc(getIdempotencyDocId(scope, key)).delete()
}
