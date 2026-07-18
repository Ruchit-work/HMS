/**
 * Server DoctorService — root + scoped doctor helpers (Admin SDK).
 */

import { admin } from "@/server/firebaseAdmin"
import {
  getDoctorHospitalId,
  getHospitalCollectionPath,
} from "@/shared/utils/firebase/serverHospitalQueries"

export async function getDoctor(doctorId: string): Promise<{
  id: string
  data: FirebaseFirestore.DocumentData
} | null> {
  if (!doctorId) return null
  const snap = await admin.firestore().collection("doctors").doc(doctorId).get()
  if (!snap.exists) return null
  return { id: snap.id, data: snap.data() || {} }
}

export async function listActiveDoctors(hospitalId: string): Promise<
  Array<{ id: string; data: FirebaseFirestore.DocumentData }>
> {
  if (!hospitalId) return []
  const snap = await admin
    .firestore()
    .collection(getHospitalCollectionPath(hospitalId, "doctors"))
    .where("status", "==", "active")
    .get()
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }))
}

/** Update root doctor + hospital-scoped copy when hospitalId is known. */
export async function updateDoctorDual(
  doctorId: string,
  hospitalId: string,
  patch: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
): Promise<void> {
  const db = admin.firestore()
  const batch = db.batch()
  batch.update(db.collection("doctors").doc(doctorId), patch)
  batch.update(
    db.collection(getHospitalCollectionPath(hospitalId, "doctors")).doc(doctorId),
    patch
  )
  await batch.commit()
}

export const DoctorServerService = {
  getDoctor,
  getDoctorHospitalId,
  listActiveDoctors,
  updateDoctorDual,
}

export default DoctorServerService
