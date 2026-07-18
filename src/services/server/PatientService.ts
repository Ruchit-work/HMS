/**
 * Server PatientService — dual-path patient reads/writes (Admin SDK).
 */

import { admin } from "@/server/firebaseAdmin"
import { getHospitalCollectionPath } from "@/shared/utils/firebase/serverHospitalQueries"

export async function getPatient(
  hospitalId: string | null | undefined,
  patientUid: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData; source: "scoped" | "root" } | null> {
  if (!patientUid) return null
  const db = admin.firestore()

  if (hospitalId) {
    const scoped = await db
      .collection(getHospitalCollectionPath(hospitalId, "patients"))
      .doc(patientUid)
      .get()
    if (scoped.exists) {
      return { id: scoped.id, data: scoped.data() || {}, source: "scoped" }
    }
  }

  const root = await db.collection("patients").doc(patientUid).get()
  if (root.exists) {
    return { id: root.id, data: root.data() || {}, source: "root" }
  }
  return null
}

/** Dual-write patient to scoped + root (create-patient / signup pattern). */
export async function createPatientDualWrite(
  hospitalId: string,
  patientUid: string,
  data: FirebaseFirestore.DocumentData,
  options?: { merge?: boolean }
): Promise<void> {
  const db = admin.firestore()
  const merge = options?.merge !== false
  const scopedRef = db.collection(getHospitalCollectionPath(hospitalId, "patients")).doc(patientUid)
  const rootRef = db.collection("patients").doc(patientUid)
  await Promise.all([
    scopedRef.set(data, { merge }),
    rootRef.set(data, { merge }),
  ])
}

export const PatientServerService = {
  getPatient,
  createPatientDualWrite,
}

export default PatientServerService
