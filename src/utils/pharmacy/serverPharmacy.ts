/**
 * Server-side pharmacy helpers: auth context and Firestore refs
 */

import { admin } from '@/server/firebaseAdmin'
import { getHospitalCollectionPath } from '@/utils/firebase/serverHospitalQueries'
import type { AuthenticatedUser } from '@/utils/firebase/apiAuth'

export const PHARMACY_COLLECTIONS = {
  medicines: 'pharmacy_medicines',
  stock: 'pharmacy_stock',
  sales: 'pharmacy_sales',
  suppliers: 'pharmacy_suppliers',
  purchase_orders: 'pharmacy_purchase_orders',
  transfers: 'pharmacy_transfers',
  stock_logs: 'pharmacy_stock_logs',
  cashSessions: 'pharmacy_cash_sessions',
  expenseCategories: 'pharmacy_expense_categories',
  expenses: 'pharmacy_expenses',
  shifts: 'pharmacy_shifts',
  cashiers: 'pharmacy_cashiers',
  counters: 'pharmacy_counters',
} as const

export function getPharmacyCollectionPath(hospitalId: string, name: keyof typeof PHARMACY_COLLECTIONS): string {
  return getHospitalCollectionPath(hospitalId, PHARMACY_COLLECTIONS[name])
}

export interface PharmacyAuthContext {
  userId: string
  isSuperAdmin: boolean
  /** Hospital ID for branch admin; for super_admin may be first hospital or from query */
  hospitalId: string
  /** All hospital IDs the user can access (single for branch admin, all for super_admin) */
  hospitalIds: string[]
  /** When set, restrict to this branch (branch admin or query param) */
  branchId: string | null
}

/**
 * Resolve pharmacy auth: admins and pharmacy role can access. Super_admin can see all hospitals/branches.
 */
export async function getPharmacyAuthContext(
  user: AuthenticatedUser,
  searchParams: { hospitalId?: string | null; branchId?: string | null } = {}
): Promise<{ success: true; context: PharmacyAuthContext } | { success: false; error: string }> {
  const db = admin.firestore()

  if (user.role === 'pharmacy') {
    const pharmacistDoc = await db.collection('pharmacists').doc(user.uid).get()
    if (!pharmacistDoc.exists) {
      return { success: false, error: 'Pharmacy user record not found.' }
    }
    const data = pharmacistDoc.data()
    const hid = data?.hospitalId
    if (!hid) {
      return { success: false, error: 'Hospital not assigned for this pharmacy user.' }
    }
    const branchId = searchParams.branchId ?? data?.branchId ?? null
    return {
      success: true,
      context: {
        userId: user.uid,
        isSuperAdmin: false,
        hospitalId: hid,
        hospitalIds: [hid],
        branchId,
      },
    }
  }

  if (user.role !== 'admin') {
    return { success: false, error: 'Pharmacy access requires admin or pharmacy role.' }
  }

  const adminDoc = await db.collection('admins').doc(user.uid).get()
  if (!adminDoc.exists) {
    return { success: false, error: 'Admin record not found.' }
  }
  const data = adminDoc.data()
  const isSuperAdmin = data?.role === 'super_admin'

  let hospitalIds: string[] = []
  let defaultHospitalId: string | null = null

  if (isSuperAdmin) {
    const hospitalsSnap = await db.collection('hospitals').where('status', '==', 'active').get()
    hospitalIds = hospitalsSnap.docs.map(d => d.id)
    defaultHospitalId = hospitalIds[0] || null
  } else {
    const hid = data?.hospitalId || data?.activeHospital || (data?.hospitals && data.hospitals[0])
    if (!hid) {
      return { success: false, error: 'Hospital not assigned for this admin.' }
    }
    hospitalIds = [hid]
    defaultHospitalId = hid
  }

  const hospitalId = searchParams.hospitalId && hospitalIds.includes(searchParams.hospitalId)
    ? searchParams.hospitalId
    : defaultHospitalId
  if (!hospitalId) {
    return { success: false, error: 'Hospital ID is required.' }
  }

  const branchId = searchParams.branchId ?? null

  return {
    success: true,
    context: {
      userId: user.uid,
      isSuperAdmin,
      hospitalId,
      hospitalIds,
      branchId,
    },
  }
}

/** Generate a short unique ID for pharmacy docs (e.g. medicineId, batch id) */
export function nanoidLike(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let id = ''
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}
