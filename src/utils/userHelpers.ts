import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

/**
 * Get user data from the appropriate collection (doctors or patients)
 * @param uid - Firebase Auth user ID
 * @param role - User role ('doctor' or 'patient'). If not provided, checks both collections
 * @returns User data with role, or null if not found
 */
export async function getUserData(uid: string, role?: 'doctor' | 'patient') {
  if (role === 'doctor') {
    const doctorDoc = await getDoc(doc(db, "doctors", uid));
    if (doctorDoc.exists()) {
      return { ...doctorDoc.data(), role: 'doctor' };
    }
    return null;
  }

  if (role === 'patient') {
    const patientDoc = await getDoc(doc(db, "patients", uid));
    if (patientDoc.exists()) {
      return { ...patientDoc.data(), role: 'patient' };
    }
    return null;
  }

  // If no role specified, check both collections
  const doctorDoc = await getDoc(doc(db, "doctors", uid));
  if (doctorDoc.exists()) {
    return { ...doctorDoc.data(), role: 'doctor' };
  }

  const patientDoc = await getDoc(doc(db, "patients", uid));
  if (patientDoc.exists()) {
    return { ...patientDoc.data(), role: 'patient' };
  }

  return null;
}

/**
 * Get the collection name based on user role
 * @param role - User role ('doctor' or 'patient')
 * @returns Collection name ('doctors' or 'patients')
 */
export function getCollectionName(role: 'doctor' | 'patient'): string {
  return role === 'doctor' ? 'doctors' : 'patients';
}
