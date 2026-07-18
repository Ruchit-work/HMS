/**
 * Server AppointmentService — Admin SDK helpers shared by API routes.
 */

import { admin } from "@/server/firebaseAdmin"
import { getHospitalCollectionPath } from "@/shared/utils/firebase/serverHospitalQueries"

export type ResolvedAppointment = {
  ref: FirebaseFirestore.DocumentReference
  snap: FirebaseFirestore.DocumentSnapshot
  data: FirebaseFirestore.DocumentData
  hospitalId: string
  source: "scoped" | "root"
}

export type ResolveAppointmentResult =
  | { ok: true; appointment: ResolvedAppointment }
  | { ok: false; reason: "not_found" | "hospital_mismatch" }

/**
 * Resolve appointment by id: hospital-scoped first, then legacy root.
 * When hospitalIdHint is provided, only that hospital is checked for scoped path
 * (matches whatsapp-bookings / most mutation routes).
 */
export async function resolveAppointment(
  appointmentId: string,
  hospitalIdHint?: string | null,
  options?: { strictHospitalOnRootFallback?: boolean }
): Promise<ResolveAppointmentResult> {
  if (!appointmentId) return { ok: false, reason: "not_found" }
  const firestore = admin.firestore()
  const strictRoot = options?.strictHospitalOnRootFallback !== false

  if (hospitalIdHint) {
    const scopedRef = firestore
      .collection(getHospitalCollectionPath(hospitalIdHint, "appointments"))
      .doc(appointmentId)
    const scopedSnap = await scopedRef.get()
    if (scopedSnap.exists) {
      return {
        ok: true,
        appointment: {
          ref: scopedRef,
          snap: scopedSnap,
          data: scopedSnap.data() || {},
          hospitalId: hospitalIdHint,
          source: "scoped",
        },
      }
    }

    const rootRef = firestore.collection("appointments").doc(appointmentId)
    const rootSnap = await rootRef.get()
    if (rootSnap.exists) {
      const legacyHospitalId = String(rootSnap.data()?.hospitalId || "")
      if (strictRoot && legacyHospitalId && legacyHospitalId !== hospitalIdHint) {
        return { ok: false, reason: "hospital_mismatch" }
      }
      return {
        ok: true,
        appointment: {
          ref: rootRef,
          snap: rootSnap,
          data: rootSnap.data() || {},
          hospitalId: legacyHospitalId || hospitalIdHint,
          source: "root",
        },
      }
    }
    return { ok: false, reason: "not_found" }
  }

  const rootRef = firestore.collection("appointments").doc(appointmentId)
  const rootSnap = await rootRef.get()
  if (rootSnap.exists) {
    const hid = String(rootSnap.data()?.hospitalId || "")
    return {
      ok: true,
      appointment: {
        ref: rootRef,
        snap: rootSnap,
        data: rootSnap.data() || {},
        hospitalId: hid,
        source: "root",
      },
    }
  }

  return { ok: false, reason: "not_found" }
}

export const AppointmentServerService = {
  resolveAppointment,
}

export default AppointmentServerService
