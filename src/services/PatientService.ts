/**
 * PatientService — hospital-scoped patient reads/writes (client Firestore).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore"
import { db } from "@/firebase/config"
import { getHospitalCollection, getHospitalDocument } from "@/utils/firebase/hospital-queries"

export type PatientRecord = { id: string; [key: string]: any }

function mapDocs(snap: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }): PatientRecord[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** One-shot list of all patients in a hospital. */
export async function listPatients(hospitalId: string): Promise<PatientRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(getHospitalCollection(hospitalId, "patients"))
  return mapDocs(snap)
}

/** Patients with status in ["active","inactive"] (booking UIs). */
export async function listBookablePatients(hospitalId: string): Promise<PatientRecord[]> {
  if (!hospitalId) return []
  const q = query(
    getHospitalCollection(hospitalId, "patients"),
    where("status", "in", ["active", "inactive"])
  )
  const snap = await getDocs(q)
  return mapDocs(snap)
}

export function subscribePatients(
  hospitalId: string,
  onData: (patients: PatientRecord[]) => void,
  onError?: (error: Error) => void,
  constraints: QueryConstraint[] = []
): Unsubscribe {
  const q =
    constraints.length > 0
      ? query(getHospitalCollection(hospitalId, "patients"), ...constraints)
      : query(getHospitalCollection(hospitalId, "patients"))
  return onSnapshot(
    q,
    (snap) => onData(mapDocs(snap)),
    (err) => onError?.(err)
  )
}

/** Read patient: hospital-scoped first, then legacy root. */
export async function getPatient(
  hospitalId: string | null | undefined,
  patientUid: string
): Promise<PatientRecord | null> {
  if (!patientUid) return null

  if (hospitalId) {
    const scoped = await getDoc(getHospitalDocument(hospitalId, "patients", patientUid))
    if (scoped.exists()) {
      return { id: scoped.id, ...scoped.data() }
    }
  }

  const root = await getDoc(doc(db, "patients", patientUid))
  if (root.exists()) {
    return { id: root.id, ...root.data() }
  }
  return null
}

/**
 * Dual-write patient doc to hospital-scoped + root collections.
 * Matches create-patient / signup behavior (same id, same payload).
 */
export async function createPatientDualWrite(
  hospitalId: string,
  patientUid: string,
  data: Record<string, unknown>
): Promise<void> {
  const scopedRef = getHospitalDocument(hospitalId, "patients", patientUid)
  const rootRef = doc(db, "patients", patientUid)
  await Promise.all([setDoc(scopedRef, data), setDoc(rootRef, data)])
}

/** Legacy root patients collection reference (for callers that still need it). */
export function getRootPatientsCollection() {
  return collection(db, "patients")
}

export const PatientService = {
  listPatients,
  listBookablePatients,
  subscribePatients,
  getPatient,
  createPatientDualWrite,
  getRootPatientsCollection,
}

export default PatientService
