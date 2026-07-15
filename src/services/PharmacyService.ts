/**
 * PharmacyService — client API wrappers for pharmacy endpoints.
 * Server Firestore paths/auth remain in utils/pharmacy/serverPharmacy (re-exported from server module).
 */

import { auth } from "@/firebase/config"

async function authHeaders(): Promise<HeadersInit> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error("Not authenticated")
  const token = await currentUser.getIdToken()
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

export async function fetchPrescriptionQueue(params: {
  hospitalId: string
  branchId?: string | null
}): Promise<unknown> {
  const headers = await authHeaders()
  const qs = new URLSearchParams({ hospitalId: params.hospitalId })
  if (params.branchId) qs.set("branchId", params.branchId)
  const res = await fetch(`/api/pharmacy/prescription-queue?${qs.toString()}`, { headers })
  return res.json()
}

export async function dispensePrescription(body: Record<string, unknown>): Promise<unknown> {
  const headers = await authHeaders()
  const res = await fetch("/api/pharmacy/dispense", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return res.json()
}

export const PharmacyService = {
  fetchPrescriptionQueue,
  dispensePrescription,
}

export default PharmacyService
