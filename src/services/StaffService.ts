/**
 * StaffService — root receptionists / pharmacists queries by hospitalId.
 */

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"

export type StaffRecord = Record<string, unknown> & { id: string; hospitalName?: string }

async function getHospitalName(hospitalId: string): Promise<string> {
  const hospitalDoc = await getDoc(doc(db, "hospitals", hospitalId))
  return hospitalDoc.exists() ? String(hospitalDoc.data()?.name || "Unknown") : "Unknown"
}

export async function listReceptionists(
  hospitalId: string,
  options?: { includeHospitalName?: boolean }
): Promise<StaffRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(
    query(collection(db, "receptionists"), where("hospitalId", "==", hospitalId))
  )
  const hospitalName =
    options?.includeHospitalName === false ? undefined : await getHospitalName(hospitalId)

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    ...(hospitalName !== undefined ? { hospitalName } : {}),
  }))
}

export async function listPharmacists(
  hospitalId: string,
  options?: { includeHospitalName?: boolean }
): Promise<StaffRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(
    query(collection(db, "pharmacists"), where("hospitalId", "==", hospitalId))
  )
  const hospitalName =
    options?.includeHospitalName === false ? undefined : await getHospitalName(hospitalId)

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    ...(hospitalName !== undefined ? { hospitalName } : {}),
  }))
}

/** Receptionists + pharmacists for a hospital (StaffManagement pattern). */
export async function listStaff(hospitalId: string): Promise<{
  receptionists: StaffRecord[]
  pharmacists: StaffRecord[]
  hospitalName: string
}> {
  const hospitalName = await getHospitalName(hospitalId)
  const [receptionists, pharmacists] = await Promise.all([
    listReceptionists(hospitalId, { includeHospitalName: false }),
    listPharmacists(hospitalId, { includeHospitalName: false }),
  ])
  return {
    hospitalName,
    receptionists: receptionists.map((r) => ({ ...r, hospitalName })),
    pharmacists: pharmacists.map((p) => ({ ...p, hospitalName })),
  }
}

export const StaffService = {
  listReceptionists,
  listPharmacists,
  listStaff,
}

export default StaffService
