/**
 * BillingService — client helpers for billing_records reads.
 * Server enrichment lives in services/server/BillingService.ts.
 */

import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"

export type BillingRecord = Record<string, unknown> & { id: string }

/** Root billing_records filtered by hospitalId (API / receptionist pattern). */
export async function listRootBillingRecords(hospitalId: string): Promise<BillingRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(
    query(collection(db, "billing_records"), where("hospitalId", "==", hospitalId))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Hospital-scoped billing_records (used by some patient UI paths).
 * Preserves existing path — do not mix with root without an explicit caller choice.
 */
export async function listScopedBillingRecords(hospitalId: string): Promise<BillingRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(getHospitalCollection(hospitalId, "billing_records"))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const BillingService = {
  listRootBillingRecords,
  listScopedBillingRecords,
}

export default BillingService
