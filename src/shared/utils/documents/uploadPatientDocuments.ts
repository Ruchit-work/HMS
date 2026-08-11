import { auth } from "@/firebase/config"

export interface UploadPatientDocumentsOptions {
  files: File[]
  patientUid: string
  patientId?: string
  appointmentId?: string
}

export interface UploadPatientDocumentsResult {
  successCount: number
  failedFiles: string[]
  errors: string[]
}

/**
 * Uploads patient document files to the existing document infrastructure (/api/documents/upload).
 * Links the uploaded files to patientUid / patientId (and optionally appointmentId).
 */
export async function uploadPatientDocuments({
  files,
  patientUid,
  patientId,
  appointmentId,
}: UploadPatientDocumentsOptions): Promise<UploadPatientDocumentsResult> {
  if (!files || files.length === 0) {
    return { successCount: 0, failedFiles: [], errors: [] }
  }

  const currentUser = auth.currentUser
  if (!currentUser) {
    return {
      successCount: 0,
      failedFiles: files.map((f) => f.name),
      errors: ["Authentication required for document upload"],
    }
  }

  const token = await currentUser.getIdToken()
  let successCount = 0
  const failedFiles: string[] = []
  const errors: string[] = []

  for (const file of files) {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("patientUid", patientUid)
      if (patientId) {
        formData.append("patientId", patientId)
      }
      if (appointmentId) {
        formData.append("appointmentId", appointmentId)
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        failedFiles.push(file.name)
        errors.push(`${file.name}: ${data.error || "Upload failed"}`)
      } else {
        successCount++
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      failedFiles.push(file.name)
      errors.push(`${file.name}: ${msg}`)
    }
  }

  return { successCount, failedFiles, errors }
}
