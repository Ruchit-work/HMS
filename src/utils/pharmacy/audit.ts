import { getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'

export type PharmacyAuditAction =
  | 'dispense_completed'
  | 'sales_return_completed'
  | 'transfer_completed'
  | 'purchase_order_received'
  | 'purchase_order_cancelled'
  | 'purchase_order_received_by_file'
  | 'purchase_order_received_by_file_confirmed'

export async function writePharmacyAuditEvent(params: {
  db: FirebaseFirestore.Firestore
  hospitalId: string
  action: PharmacyAuditAction
  actorUserId: string
  branchId?: string | null
  entityType: 'sale' | 'return' | 'transfer' | 'purchase_order'
  entityId: string
  summary: string
  details?: Record<string, unknown>
}): Promise<void> {
  const {
    db,
    hospitalId,
    action,
    actorUserId,
    branchId,
    entityType,
    entityId,
    summary,
    details,
  } = params
  const path = getPharmacyCollectionPath(hospitalId, 'audit_logs')
  const now = new Date().toISOString()
  const id = `${now.slice(0, 10).replace(/-/g, '')}_${nanoidLike()}`
  await db.collection(path).doc(id).set({
    id,
    hospitalId,
    branchId: branchId || null,
    action,
    actorUserId,
    entityType,
    entityId,
    summary,
    details: details || {},
    createdAt: now,
  })
}
