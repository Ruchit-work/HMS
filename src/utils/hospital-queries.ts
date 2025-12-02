/**
 * Hospital-Aware Query Utilities
 * Wrapper functions to easily query hospital-scoped collections
 * Maintains backward compatibility where possible
 */

import {
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  Query,
  CollectionReference,
  DocumentReference,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { COLLECTION_MAP, CollectionName } from '@/lib/hospital/helpers'

/**
 * Get hospital-scoped collection reference
 */
export function getHospitalCollection(
  hospitalId: string, 
  collectionName: CollectionName
): CollectionReference {
  return collection(db, `hospitals/${hospitalId}/${COLLECTION_MAP[collectionName]}`)
}

/**
 * Get hospital-scoped document reference
 */
export function getHospitalDocument(
  hospitalId: string,
  collectionName: CollectionName,
  docId: string
): DocumentReference {
  return doc(db, `hospitals/${hospitalId}/${COLLECTION_MAP[collectionName]}`, docId)
}

/**
 * Query helper - maintains same API as existing queries but adds hospital scope
 * 
 * Example usage:
 *   // Old: collection(db, "patients")
 *   // New: getHospitalQuery(hospitalId, "patients")
 */
export function getHospitalQuery(
  hospitalId: string,
  collectionName: CollectionName,
  ...queryConstraints: QueryConstraint[]
): Query<DocumentData> {
  const collRef = getHospitalCollection(hospitalId, collectionName) as CollectionReference<DocumentData>
  return query(collRef, ...queryConstraints)
}

/**
 * Check if user has access to hospital
 */
export async function checkHospitalAccess(
  userId: string,
  hospitalId: string
): Promise<boolean> {
  try {
    // Check users collection for hospitals array
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      const hospitals = userData?.hospitals || []
      return hospitals.includes(hospitalId)
    }

    // Fallback: Check role-specific collections
    const roleCollections = ['admins', 'doctors', 'receptionists', 'patients']
    for (const roleColl of roleCollections) {
      const roleDoc = await getDoc(doc(db, roleColl, userId))
      if (roleDoc.exists()) {
        const data = roleDoc.data()
        // Check if document has hospitalId field or hospitals array
        if (data?.hospitalId === hospitalId || data?.hospitals?.includes(hospitalId)) {
          return true
        }
      }
    }

    return false
  } catch (error) {
    console.error('[checkHospitalAccess] Error:', error)
    return false
  }
}

