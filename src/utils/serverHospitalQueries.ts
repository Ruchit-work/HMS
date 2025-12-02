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
  } catch (error) {
    console.error('[getUserActiveHospitalId] Error:', error)
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
  } catch (error) {
    console.error('[getDoctorHospitalId] Error:', error)
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
  } catch (error) {
    console.error('[getAppointmentHospitalId] Error:', error)
    return null
  }
}

/**
 * Get all active hospitals
 */
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
  } catch (error) {
    console.error('[getAllActiveHospitals] Error:', error)
    return []
  }
}

