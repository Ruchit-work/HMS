/**
 * Server StaffService — list receptionists/pharmacists by hospital (Admin SDK).
 */

import { admin } from "@/server/firebaseAdmin"

export async function listReceptionists(hospitalId: string) {
  const snap = await admin
    .firestore()
    .collection("receptionists")
    .where("hospitalId", "==", hospitalId)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function listPharmacists(hospitalId: string) {
  const snap = await admin
    .firestore()
    .collection("pharmacists")
    .where("hospitalId", "==", hospitalId)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const StaffServerService = {
  listReceptionists,
  listPharmacists,
}

export default StaffServerService
