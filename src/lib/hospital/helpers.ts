/**
 * Hospital-Aware Firestore Query Helpers
 * Converts existing single-hospital queries to multi-hospital queries
 * Supports subcollection structure: hospitals/{hospitalId}/patients, etc.
 */

import { collection, query, where, Query, CollectionReference } from 'firebase/firestore'
import { db } from '@/firebase/config'

/**
 * Get collection path for hospital-scoped data
 * Format: hospitals/{hospitalId}/{collectionName}
 */
export function getHospitalCollectionPath(hospitalId: string, collectionName: string): string {
  return `hospitals/${hospitalId}/${collectionName}`
}

/**
 * Get hospital-scoped collection reference
 */
export function getHospitalCollection(hospitalId: string, collectionName: string): CollectionReference {
  return collection(db, getHospitalCollectionPath(hospitalId, collectionName))
}

/**
 * Helper to build hospital-scoped queries
 * Automatically adds hospitalId filter if provided
 */
export function buildHospitalQuery<T = any>(
  hospitalId: string,
  collectionName: string,
  filters: Array<[string, any, any?]> = []
): Query<T> {
  const collRef = getHospitalCollection(hospitalId, collectionName)
  
  // Build where clauses
  const whereClauses = filters.map(([field, op, value]) => {
    if (value !== undefined) {
      return where(field, op as any, value)
    }
    return where(field, '==', op)
  })

  // Combine collection with where clauses
  if (whereClauses.length === 0) {
    return query(collRef) as Query<T>
  }

  return query(collRef, ...whereClauses) as Query<T>
}

/**
 * Legacy collection names mapped to hospital-scoped paths
 */
export const COLLECTION_MAP = {
  patients: 'patients',
  doctors: 'doctors',
  receptionists: 'receptionists',
  appointments: 'appointments',
  prescriptions: 'prescriptions',
  billing_records: 'billing_records',
  admission_requests: 'admission_requests',
  admissions: 'admissions',
} as const

export type CollectionName = keyof typeof COLLECTION_MAP

/**
 * Convert legacy query to hospital-scoped query
 * Usage: hospitalQuery(db, hospitalId, 'patients', [['status', '==', 'active']])
 */
export function hospitalQuery(
  hospitalId: string,
  collectionName: CollectionName,
  filters: Array<[string, any, any?]> = []
): Query {
  return buildHospitalQuery(hospitalId, COLLECTION_MAP[collectionName], filters)
}

