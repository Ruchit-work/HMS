/**
 * Server-Side Hospital Query Helpers
 * For use in API routes where React hooks are not available
 */

import { admin } from '@/server/firebaseAdmin'

/**
 * Whether the user is a platform Super Admin (cross-tenant).
 */
export async function isPlatformSuperAdmin(userId: string): Promise<boolean> {
  try {
    const db = admin.firestore()
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists && userDoc.data()?.role === 'super_admin') {
      return true
    }
    const adminDoc = await db.collection('admins').doc(userId).get()
    if (adminDoc.exists) {
      const data = adminDoc.data()
      if (data?.isSuperAdmin === true || data?.role === 'super_admin') {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Hospital IDs the user is allowed to access (membership list).
 * Super admins are not limited by this list — use isPlatformSuperAdmin separately.
 */
export async function getUserHospitalIds(userId: string): Promise<string[]> {
  try {
    const db = admin.firestore()
    const ids = new Set<string>()

    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const userData = userDoc.data() || {}
      const hospitals = Array.isArray(userData.hospitals) ? userData.hospitals : []
      for (const h of hospitals) {
        if (typeof h === 'string' && h.trim()) ids.add(h.trim())
      }
      if (typeof userData.activeHospital === 'string' && userData.activeHospital.trim()) {
        if (ids.size === 0) ids.add(userData.activeHospital.trim())
      }
      if (typeof userData.hospitalId === 'string' && userData.hospitalId.trim()) {
        ids.add(userData.hospitalId.trim())
      }
    }

    const roleCollections = ['admins', 'doctors', 'receptionists', 'patients', 'pharmacists']
    for (const roleColl of roleCollections) {
      const roleDoc = await db.collection(roleColl).doc(userId).get()
      if (!roleDoc.exists) continue
      const data = roleDoc.data() || {}
      if (typeof data.hospitalId === 'string' && data.hospitalId.trim()) {
        ids.add(data.hospitalId.trim())
      }
      const hospitals = Array.isArray(data.hospitals) ? data.hospitals : []
      for (const h of hospitals) {
        if (typeof h === 'string' && h.trim()) ids.add(h.trim())
      }
    }

    return Array.from(ids)
  } catch {
    return []
  }
}

/**
 * True if user may access the given hospital (super admin always true).
 */
export async function assertUserHospitalAccess(userId: string, hospitalId: string): Promise<boolean> {
  if (!userId || !hospitalId) return false
  if (await isPlatformSuperAdmin(userId)) return true
  const allowed = await getUserHospitalIds(userId)
  return allowed.includes(hospitalId)
}

/**
 * Resolve a client-supplied hospitalId to an allowed hospital.
 * - Super admin: requested ID if provided, else active hospital, else null
 * - Others: requested ID only if membership allows; else active/allowed hospital
 */
export async function resolveAuthorizedHospitalId(
  userId: string,
  requestedHospitalId?: string | null
): Promise<string | null> {
  const requested =
    typeof requestedHospitalId === 'string' && requestedHospitalId.trim()
      ? requestedHospitalId.trim()
      : null

  const superAdmin = await isPlatformSuperAdmin(userId)
  if (superAdmin) {
    if (requested) return requested
    return getUserActiveHospitalId(userId)
  }

  if (requested) {
    const ok = await assertUserHospitalAccess(userId, requested)
    if (!ok) return null
    return requested
  }

  return getUserActiveHospitalId(userId)
}

/**
 * Get user's active hospital ID from users collection.
 * Never returns a hospital the user is not a member of (except platform super admin).
 *
 * Performance: loads users + all role docs in one parallel round-trip instead of
 * nested sequential helpers (was ~10–14 awaits → often multi-second latency).
 */
export async function getUserActiveHospitalId(userId: string): Promise<string | null> {
  try {
    const db = admin.firestore()

    const [userDoc, adminDoc, doctorDoc, receptionistDoc, patientDoc, pharmacistDoc] =
      await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('admins').doc(userId).get(),
        db.collection('doctors').doc(userId).get(),
        db.collection('receptionists').doc(userId).get(),
        db.collection('patients').doc(userId).get(),
        db.collection('pharmacists').doc(userId).get(),
      ])

    const userData = userDoc.exists ? userDoc.data() || {} : null
    const adminData = adminDoc.exists ? adminDoc.data() || {} : null

    const superAdmin =
      (userData?.role === 'super_admin') ||
      (adminData?.isSuperAdmin === true || adminData?.role === 'super_admin')

    const allowed = new Set<string>()
    const addHospital = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) allowed.add(value.trim())
    }
    const addFromDoc = (data: FirebaseFirestore.DocumentData | null | undefined) => {
      if (!data) return
      addHospital(data.hospitalId)
      if (Array.isArray(data.hospitals)) {
        for (const h of data.hospitals) addHospital(h)
      }
    }

    if (!superAdmin) {
      if (userData) {
        const hospitals = Array.isArray(userData.hospitals) ? userData.hospitals : []
        for (const h of hospitals) addHospital(h)
        if (typeof userData.activeHospital === "string" && userData.activeHospital.trim()) {
          if (allowed.size === 0) addHospital(userData.activeHospital)
        }
        addHospital(userData.hospitalId)
      }
      addFromDoc(adminData || undefined)
      addFromDoc(doctorDoc.exists ? doctorDoc.data() : undefined)
      addFromDoc(receptionistDoc.exists ? receptionistDoc.data() : undefined)
      addFromDoc(patientDoc.exists ? patientDoc.data() : undefined)
      addFromDoc(pharmacistDoc.exists ? pharmacistDoc.data() : undefined)
    }

    const pickIfAllowed = (hospitalId: string | null | undefined): string | null => {
      if (!hospitalId || typeof hospitalId !== "string" || !hospitalId.trim()) return null
      const id = hospitalId.trim()
      if (superAdmin) return id
      if (allowed.has(id)) return id
      return null
    }

    if (userData) {
      const fromActive = pickIfAllowed(userData.activeHospital)
      if (fromActive) return fromActive
      if (Array.isArray(userData.hospitals) && userData.hospitals.length > 0) {
        for (const h of userData.hospitals) {
          const picked = pickIfAllowed(h)
          if (picked) return picked
        }
      }
      const fromField = pickIfAllowed(userData.hospitalId)
      if (fromField) return fromField
    }

    const roleSnaps = [
      adminDoc,
      doctorDoc,
      receptionistDoc,
      patientDoc,
      pharmacistDoc,
    ]
    for (const roleDoc of roleSnaps) {
      if (!roleDoc.exists) continue
      const data = roleDoc.data() || {}
      const fromRole =
        pickIfAllowed(data.hospitalId) ||
        (Array.isArray(data.hospitals)
          ? (data.hospitals.map((h: string) => pickIfAllowed(h)).find(Boolean) as string | undefined) ||
            null
          : null) ||
        pickIfAllowed(data.activeHospital)
      if (fromRole) return fromRole
    }

    if (!superAdmin && allowed.size > 0) {
      return Array.from(allowed)[0]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Resolve hospitalId for an admission document (explicit field, or via room / patient).
 */
export async function resolveAdmissionHospitalId(
  admissionData: FirebaseFirestore.DocumentData | null | undefined
): Promise<string | null> {
  if (!admissionData) return null
  const direct =
    typeof admissionData.hospitalId === 'string' && admissionData.hospitalId.trim()
      ? admissionData.hospitalId.trim()
      : null
  if (direct) return direct

  try {
    const db = admin.firestore()
    const roomId = typeof admissionData.roomId === 'string' ? admissionData.roomId.trim() : ''
    if (roomId) {
      const roomSnap = await db.collection('rooms').doc(roomId).get()
      const roomHospital =
        typeof roomSnap.data()?.hospitalId === 'string' ? roomSnap.data()!.hospitalId.trim() : ''
      if (roomHospital) return roomHospital
    }
    const patientUid =
      typeof admissionData.patientUid === 'string' ? admissionData.patientUid.trim() : ''
    if (patientUid) {
      const patientSnap = await db.collection('patients').doc(patientUid).get()
      const patientHospital =
        typeof patientSnap.data()?.hospitalId === 'string'
          ? patientSnap.data()!.hospitalId.trim()
          : ''
      if (patientHospital) return patientHospital
    }
  } catch {
    return null
  }
  return null
}

/**
 * True if the user may access this admission's hospital.
 */
export async function assertAdmissionHospitalAccess(
  userId: string,
  admissionData: FirebaseFirestore.DocumentData | null | undefined
): Promise<boolean> {
  const hospitalId = await resolveAdmissionHospitalId(admissionData)
  if (!hospitalId) return false
  return assertUserHospitalAccess(userId, hospitalId)
}

/**
 * Get hospital-scoped collection reference (server-side)
 */
export function getHospitalCollectionPath(hospitalId: string, collectionName: string): string {
  return `hospitals/${hospitalId}/${collectionName}`
}

/**
 * Get hospital-scoped collection (for Firebase Admin SDK)
 */
export function getHospitalCollectionRef(db: FirebaseFirestore.Firestore, hospitalId: string, collectionName: string) {
  return db.collection(getHospitalCollectionPath(hospitalId, collectionName))
}

/**
 * Helper to get hospital ID from doctor
 */
export async function getDoctorHospitalId(doctorId: string): Promise<string | null> {
  try {
    const db = admin.firestore()

    const userDoc = await db.collection('users').doc(doctorId).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      if (userData?.activeHospital) return userData.activeHospital
      if (userData?.hospitals && userData.hospitals.length > 0) return userData.hospitals[0]
    }

    const doctorDoc = await db.collection('doctors').doc(doctorId).get()
    if (doctorDoc.exists) {
      const data = doctorDoc.data()
      if (data?.hospitalId) return data.hospitalId
    }

    return null
  } catch {
    return null
  }
}

/**
 * Helper to get hospital ID from appointment
 */
export async function getAppointmentHospitalId(appointmentId: string): Promise<string | null> {
  try {
    const db = admin.firestore()

    const legacyAppt = await db.collection('appointments').doc(appointmentId).get()
    if (legacyAppt.exists) {
      const data = legacyAppt.data()
      if (data?.hospitalId) return data.hospitalId
      if (data?.doctorId) {
        return await getDoctorHospitalId(data.doctorId)
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Default branch for patients created by a receptionist (matches create-patient API).
 */
export async function getReceptionistDefaultBranch(
  userId: string,
  role: string | undefined
): Promise<{ branchId: string | null; branchName: string | null }> {
  if (role !== "receptionist") {
    return { branchId: null, branchName: null }
  }
  try {
    const db = admin.firestore()
    const snap = await db.collection("receptionists").doc(userId).get()
    if (!snap.exists) {
      return { branchId: null, branchName: null }
    }
    const d = snap.data() || {}
    const branchId = typeof d.branchId === "string" && d.branchId.trim() ? d.branchId.trim() : null
    const branchName = typeof d.branchName === "string" && d.branchName.trim() ? d.branchName.trim() : null
    return { branchId, branchName }
  } catch {
    return { branchId: null, branchName: null }
  }
}

/** First active branch for a hospital (stable: alphabetical by name). */
export async function getFirstActiveBranchForHospital(hospitalId: string): Promise<{ id: string; name: string } | null> {
  try {
    const db = admin.firestore()
    const snap = await db.collection("branches").where("hospitalId", "==", hospitalId).where("status", "==", "active").get()
    if (snap.empty) return null
    const rows = snap.docs.map((d) => ({
      id: d.id,
      name: String((d.data() as { name?: string }).name || "Branch"),
    }))
    rows.sort((a, b) => a.name.localeCompare(b.name))
    return rows[0] || null
  } catch {
    return null
  }
}

/** Returns branch id+name if branch exists, is active, and belongs to hospital. */
export async function getBranchIfBelongsToHospital(
  branchId: string,
  hospitalId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const id = branchId.trim()
    if (!id) return null
    const db = admin.firestore()
    const snap = await db.collection("branches").doc(id).get()
    if (!snap.exists) return null
    const d = snap.data() || {}
    if (String(d.hospitalId || "") !== hospitalId) return null
    if (d.status && d.status !== "active") return null
    return { id: snap.id, name: String(d.name || "Branch") }
  } catch {
    return null
  }
}

/** Get all active hospitals */
export async function getAllActiveHospitals(): Promise<Array<{ id: string; name: string }>> {
  try {
    const db = admin.firestore()
    const hospitalsSnapshot = await db.collection('hospitals')
      .where('status', '==', 'active')
      .get()

    return hospitalsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Unknown Hospital',
      ...doc.data()
    }))
  } catch {
    return []
  }
}
