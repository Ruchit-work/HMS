import { ref, uploadBytes, getDownloadURL, deleteObject, type StorageReference } from "firebase/storage"
import { storage } from "@/firebase/config"
import { generateSafeFileName } from "./documentDetection"
import { DocumentMetadata, DocumentType } from "@/types/document"

/**
 * Upload file to Firebase Storage
 * Uses flat structure: hospitals/{hospitalId}/patients/{patientId}/{fileName}
 */
export async function uploadDocumentToStorage(
  file: File,
  patientId: string,
  hospitalId: string,
  fileType: DocumentType
): Promise<{ storagePath: string; downloadUrl: string }> {
  // Generate safe filename
  const safeFileName = generateSafeFileName(file.name, patientId)
  
  // Create storage reference with flat structure
  const storagePath = `hospitals/${hospitalId}/patients/${patientId}/${safeFileName}`
  const storageRef = ref(storage, storagePath)
  
  // Upload file
  await uploadBytes(storageRef, file)
  
  // Get download URL (valid for 1 hour by default, can be extended)
  const downloadUrl = await getDownloadURL(storageRef)
  
  return { storagePath, downloadUrl }
}

/**
 * Delete file from Firebase Storage
 */
export async function deleteDocumentFromStorage(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath)
  await deleteObject(storageRef)
}

/**
 * Get download URL for a document (generates new signed URL)
 */
export async function getDocumentDownloadUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath)
  return await getDownloadURL(storageRef)
}

/**
 * Generate storage path for a document
 */
export function generateStoragePath(
  fileName: string,
  patientId: string,
  hospitalId: string
): string {
  const safeFileName = generateSafeFileName(fileName, patientId)
  return `hospitals/${hospitalId}/patients/${patientId}/${safeFileName}`
}

