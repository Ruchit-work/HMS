import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";


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


export function getCollectionName(role: 'doctor' | 'patient'): string {
  return role === 'doctor' ? 'doctors' : 'patients';
}
