/**
 * AppointmentService — hospital-scoped appointment reads + shared status helpers.
 * Status mutations reuse existing utils/appointmentHelpers to preserve behavior.
 */

import {
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import {
  cancelAppointment,
  completeAppointment,
  markAppointmentSkipped,
  releaseAppointmentSlot,
  getHoursUntilAppointment,
  getStatusColor,
} from "@/shared/utils/appointmentHelpers"

export type AppointmentRecord = { id: string; [key: string]: any }

function mapDocs(snap: {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
}): AppointmentRecord[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** One-shot list of all appointments in a hospital (analytics pattern). */
export async function listAppointments(hospitalId: string): Promise<AppointmentRecord[]> {
  if (!hospitalId) return []
  const snap = await getDocs(getHospitalCollection(hospitalId, "appointments"))
  return mapDocs(snap)
}

export async function listAppointmentsByDoctor(
  hospitalId: string,
  doctorId: string,
  options?: { branchId?: string | null }
): Promise<AppointmentRecord[]> {
  if (!hospitalId || !doctorId) return []
  const constraints: QueryConstraint[] = [where("doctorId", "==", doctorId)]
  if (options?.branchId) {
    constraints.push(where("branchId", "==", options.branchId))
  }
  const q = query(getHospitalCollection(hospitalId, "appointments"), ...constraints)
  const snap = await getDocs(q)
  return mapDocs(snap)
}

/**
 * Union of patientUid + patientId queries (patient dashboard / documents pattern).
 */
export async function listAppointmentsByPatient(
  hospitalId: string,
  keys: { patientUid?: string | null; patientId?: string | null }
): Promise<AppointmentRecord[]> {
  if (!hospitalId) return []
  const coll = getHospitalCollection(hospitalId, "appointments")
  const byId = new Map<string, AppointmentRecord>()

  const loads: Promise<void>[] = []
  if (keys.patientUid) {
    loads.push(
      getDocs(query(coll, where("patientUid", "==", keys.patientUid))).then((snap) => {
        for (const d of snap.docs) byId.set(d.id, { id: d.id, ...d.data() })
      })
    )
  }
  if (keys.patientId) {
    loads.push(
      getDocs(query(coll, where("patientId", "==", keys.patientId))).then((snap) => {
        for (const d of snap.docs) byId.set(d.id, { id: d.id, ...d.data() })
      })
    )
  }
  await Promise.all(loads)
  return Array.from(byId.values())
}

export function subscribeDoctorAppointments(
  hospitalId: string,
  doctorId: string,
  onData: (appointments: AppointmentRecord[]) => void,
  options?: { branchId?: string | null; onError?: (error: Error) => void }
): Unsubscribe {
  const constraints: QueryConstraint[] = [where("doctorId", "==", doctorId)]
  if (options?.branchId) {
    constraints.push(where("branchId", "==", options.branchId))
  }
  const q = query(getHospitalCollection(hospitalId, "appointments"), ...constraints)
  return onSnapshot(
    q,
    (snap) => onData(mapDocs(snap)),
    (err) => options?.onError?.(err)
  )
}

export function subscribeAppointments(
  hospitalId: string,
  constraints: QueryConstraint[],
  onData: (appointments: AppointmentRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(getHospitalCollection(hospitalId, "appointments"), ...constraints)
  return onSnapshot(
    q,
    (snap) => onData(mapDocs(snap)),
    (err) => onError?.(err)
  )
}

export const AppointmentService = {
  listAppointments,
  listAppointmentsByDoctor,
  listAppointmentsByPatient,
  subscribeDoctorAppointments,
  subscribeAppointments,
  cancelAppointment,
  completeAppointment,
  markAppointmentSkipped,
  releaseAppointmentSlot,
  getHoursUntilAppointment,
  getStatusColor,
}

export default AppointmentService
