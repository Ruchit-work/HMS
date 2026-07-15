/**
 * DoctorService — hospital-scoped doctor reads (client Firestore).
 * Does not change collection paths or status semantics.
 */

import {
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"

export type DoctorRecord = { id: string; [key: string]: any }

function mapDocs(snap: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }): DoctorRecord[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** One-shot list of all doctors in a hospital (no status filter). */
export async function listDoctors(hospitalId: string): Promise<DoctorRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(getHospitalCollection(hospitalId, "doctors"))
  return mapDocs(snap)
}

/** One-shot list of doctors with status == "active". */
export async function listActiveDoctors(hospitalId: string): Promise<DoctorRecord[]> {
  if (!hospitalId) return []
  const q = query(getHospitalCollection(hospitalId, "doctors"), where("status", "==", "active"))
  const snap = await getDocs(q)
  return mapDocs(snap)
}

/** Realtime subscription to active doctors. */
export function subscribeActiveDoctors(
  hospitalId: string,
  onData: (doctors: DoctorRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(getHospitalCollection(hospitalId, "doctors"), where("status", "==", "active"))
  return onSnapshot(
    q,
    (snap) => onData(mapDocs(snap)),
    (err) => onError?.(err)
  )
}

/** Realtime subscription with optional extra constraints (e.g. status pending). */
export function subscribeDoctors(
  hospitalId: string,
  constraints: QueryConstraint[],
  onData: (doctors: DoctorRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(getHospitalCollection(hospitalId, "doctors"), ...constraints)
  return onSnapshot(
    q,
    (snap) => onData(mapDocs(snap)),
    (err) => onError?.(err)
  )
}

export const DoctorService = {
  listDoctors,
  listActiveDoctors,
  subscribeActiveDoctors,
  subscribeDoctors,
}

export default DoctorService
