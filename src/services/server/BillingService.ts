/**
 * Server BillingService — root billing_records list by hospital.
 */

import { admin } from "@/server/firebaseAdmin"

export async function listBillingRecords(hospitalId: string) {
  if (!hospitalId) return []
  const snap = await admin
    .firestore()
    .collection("billing_records")
    .where("hospitalId", "==", hospitalId)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const BillingServerService = {
  listBillingRecords,
}

export default BillingServerService
