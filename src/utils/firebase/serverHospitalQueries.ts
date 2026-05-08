/**
 * Server-Side Hospital Query Helpers
 * For use in API routes where React hooks are not available
 */

import { admin } from '@/server/firebaseAdmin'

/**
 * Get user's active hospital ID from users collection
 */
export async function getUserActiveHospitalId(userId: string): Promise<string | null> {
  try {
    const db = admin.firestore()
    
    // Check users collection first
    const userDoc = await db.collection('users').doc(userId).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      if (userData?.activeHospital) {
        return userData.activeHospital
      }
      // If no activeHospital but has hospitals array, use first one
      if (userData?.hospitals && userData.hospitals.length > 0) {
        return userData.hospitals[0]
      }
    }
    
    // Fallback: Check role-specific collections
    const roleCollections = ['admins', 'doctors', 'receptionists', 'patients']
    for (const roleColl of roleCollections) {
      const roleDoc = await db.collection(roleColl).doc(userId).get()
      if (roleDoc.exists) {
        const data = roleDoc.data()
        if (data?.hospitalId) {
          return data.hospitalId
        }
        if (data?.hospitals && data.hospitals.length > 0) {
          return data.hospitals[0]
        }
        if (data?.activeHospital) {
          return data.activeHospital
        }
      }
    }
    
    return null
  } catch {
    return null
  }
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
    
    // First check users collection
    const userDoc = await db.collection('users').doc(doctorId).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      if (userData?.activeHospital) return userData.activeHospital
      if (userData?.hospitals && userData.hospitals.length > 0) return userData.hospitals[0]
    }
    
    // Check doctors collection
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
    
    // Try to find appointment in any hospital's subcollection
    // This is a fallback - normally we should know which hospital
    
    // Check if appointment has hospitalId field (if stored in legacy collection)
    const legacyAppt = await db.collection('appointments').doc(appointmentId).get()
    if (legacyAppt.exists) {
      const data = legacyAppt.data()
      if (data?.hospitalId) return data.hospitalId
    }
    
    // If not found, we need to check doctor's hospital
    if (legacyAppt.exists) {
      const data = legacyAppt.data()
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

