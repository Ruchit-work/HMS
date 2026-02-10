import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { detectDocumentTypeEnhanced, validateFileType, validateFileSize } from "@/utils/documents/documentDetection"
import { BulkUploadResult, DocumentMetadata } from "@/types/document"
import { getStorage } from "firebase-admin/storage"
import { ValidationError } from "@/utils/api/validation"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist", "patient"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Access denied. Only doctors, receptionists, and patients can upload documents." },
        { status: 403 }
      )
    }

    const initResult = initFirebaseAdmin("bulk-document-upload API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
    
    // Get storage bucket - use the bucket name from environment or app config
    const adminApp = admin.app()
    
    // First, try to get bucket from environment variable
    let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    
    // Remove gs:// prefix if present
    if (storageBucket?.startsWith("gs://")) {
      storageBucket = storageBucket.replace("gs://", "")
    }
    
    // Try to get bucket from admin app config
    if (!storageBucket && adminApp.options.storageBucket) {
      storageBucket = adminApp.options.storageBucket
    }
    
    // Default to the user's specified bucket name
    if (!storageBucket) {
      storageBucket = "hospital-management-sys-eabb2.appspot.com"
    }
    const bucket = getStorage().bucket(storageBucket)
    const formData = await request.formData()

    const patientId = formData.get("patientId") as string | null
    const patientUid = formData.get("patientUid") as string | null
    const appointmentId = formData.get("appointmentId") as string | null
    const specialty = formData.get("specialty") as string | null

    if (!patientUid || typeof patientUid !== "string" || patientUid.trim().length < 3) {
      throw new ValidationError("Patient UID is required", { field: "patientUid" })
    }

    // Get hospital ID first
    let hospitalId: string | null = null
    if (user.role === "patient") {
      const patientDoc = await db.collection("patients").doc(user.uid).get()
      if (patientDoc.exists) {
        hospitalId = patientDoc.data()?.hospitalId || null
      }
    } else {
      hospitalId = await getUserActiveHospitalId(user.uid)
    }

    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    // If patientUid is provided but patientId is not, try to get patientId from patient document
    let finalPatientId = patientId
    const finalPatientUid = patientUid

    if (patientUid && !patientId) {
      try {
        // Try hospital-scoped collection first
        const hospitalPatientDoc = await db.collection(getHospitalCollectionPath(hospitalId, "patients")).doc(patientUid).get()
        if (hospitalPatientDoc.exists) {
          const patientData = hospitalPatientDoc.data()
          finalPatientId = patientData?.patientId || patientUid
        } else {
          // Fallback to legacy collection
          const patientDoc = await db.collection("patients").doc(patientUid).get()
          if (patientDoc.exists) {
            const patientData = patientDoc.data()
            finalPatientId = patientData?.patientId || patientUid
          }
        }
      } catch {
        // Use patientUid as fallback
        finalPatientId = patientUid
      }
    }

    if (!finalPatientId) {
      finalPatientId = finalPatientUid // Use UID as fallback
    }

    // Get all files
    const files: File[] = []
    let fileIndex = 0
    while (formData.get(`file_${fileIndex}`)) {
      const file = formData.get(`file_${fileIndex}`) as File
      if (file) files.push(file)
      fileIndex++
    }

    // Also check for files array
    const filesArray = formData.getAll("files")
    filesArray.forEach((item) => {
      if (item instanceof File) {
        files.push(item)
      }
    })

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const results: BulkUploadResult = {
      success: [],
      failed: [],
    }

    // Get uploader name
    let uploaderName = user.email || "Unknown"
    if (user.role === "doctor") {
      const doctorDoc = await db.collection("doctors").doc(user.uid).get()
      if (doctorDoc.exists) {
        const doctorData = doctorDoc.data()
        uploaderName = `${doctorData?.firstName || ""} ${doctorData?.lastName || ""}`.trim() || uploaderName
      }
    } else if (user.role === "receptionist") {
      const recepDoc = await db.collection("receptionists").doc(user.uid).get()
      if (recepDoc.exists) {
        const recepData = recepDoc.data()
        uploaderName = `${recepData?.firstName || ""} ${recepData?.lastName || ""}`.trim() || uploaderName
      }
    }

    // Process each file
    for (const file of files) {
      try {
        // Validate file
        const typeValidation = validateFileType(file)
        if (!typeValidation.valid) {
          results.failed.push({
            fileName: file.name,
            error: typeValidation.error || "Invalid file type",
          })
          continue
        }

        const sizeValidation = validateFileSize(file)
        if (!sizeValidation.valid) {
          results.failed.push({
            fileName: file.name,
            error: sizeValidation.error || "Invalid file size",
          })
          continue
        }

        // Convert file to buffer for enhanced detection
        const fileArrayBuffer = await file.arrayBuffer()
        const fileBuffer = Buffer.from(fileArrayBuffer)
        
        // Enhanced document type detection: tries filename first, then PDF content analysis
        let detectedResult
        if (file.type === 'application/pdf') {
          detectedResult = await detectDocumentTypeEnhanced(file.name, fileBuffer, file.type)
        } else {
          // For non-PDFs, use simple filename detection
          const { detectDocumentType, detectSpecialty } = await import("@/utils/documents/documentDetection")
          detectedResult = {
            type: detectDocumentType(file.name),
            specialty: detectSpecialty(file.name),
            source: 'filename' as const
          }
        }
        
        const detectedType = detectedResult.type
        let detectedSpecialty = specialty || detectedResult.specialty

        // If appointmentId is provided, get appointment specialty
        if (appointmentId && !detectedSpecialty) {
          try {
            const appointmentDoc = await db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(appointmentId).get()
            if (appointmentDoc.exists) {
              const appointmentData = appointmentDoc.data()
              detectedSpecialty = appointmentData?.doctorSpecialization || detectedSpecialty
            }
          } catch {
          }
        }

        // Generate safe filename and storage path with unique identifier
        // Format: {timestamp}_{patientId}_{sanitizedFileName}_{randomString}.{ext}
        // This ensures uniqueness even if multiple files with same name are uploaded
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 9) // 7 character random string
        
        // Extract file extension
        const lastDot = file.name.lastIndexOf('.')
        const nameWithoutExt = lastDot > 0 ? file.name.substring(0, lastDot) : file.name
        const extension = lastDot > 0 ? file.name.substring(lastDot) : ''
        
        // Sanitize filename (remove special chars, keep alphanumeric, dash, underscore, dot)
        const sanitized = nameWithoutExt
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
          .replace(/\s+/g, '_') // Replace spaces with underscore
          .substring(0, 100) // Limit length to prevent very long filenames
        
        // Create unique filename: timestamp_patientId_sanitizedName_randomString.ext
        const safeFileName = `${timestamp}_${finalPatientId}_${sanitized}_${randomString}${extension}`
        const storagePath = `hospitals/${hospitalId}/patients/${finalPatientId}/${safeFileName}`

        // Buffer already created above for document type detection
        const buffer = fileBuffer
        const fileRef = bucket.file(storagePath)
        await fileRef.save(buffer, {
          metadata: {
            contentType: file.type,
            metadata: {
              originalFileName: file.name,
              uploadedBy: user.uid,
              uploadedByRole: user.role,
              patientId: finalPatientId,
              hospitalId,
            },
          },
        })

        await fileRef.makePublic()
        const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`

        // Create document metadata
        const now = new Date().toISOString()
        const documentData: Omit<DocumentMetadata, "id"> = {
          patientId: finalPatientId,
          patientUid: finalPatientUid,
          hospitalId,
          fileName: safeFileName,
          originalFileName: file.name,
          fileType: detectedType,
          mimeType: file.type,
          fileSize: file.size,
          storagePath,
          downloadUrl,
          specialty: detectedSpecialty,
          appointmentId: appointmentId || undefined,
          uploadedBy: {
            uid: user.uid,
            role: user.role as "doctor" | "receptionist" | "patient",
            name: uploaderName,
          },
          uploadedAt: now,
          status: "active",
          isLinkedToAppointment: !!appointmentId,
        }

        // If linked to appointment, fetch appointment data to get doctor/appointment/patient metadata
        if (appointmentId) {
          try {
            const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(appointmentId)
            const appointmentDoc = await appointmentRef.get()
            if (appointmentDoc.exists) {
              const appointmentData = appointmentDoc.data()
              if (appointmentData?.doctorId) {
                documentData.doctorId = appointmentData.doctorId
              }
              if (appointmentData?.doctorName) {
                documentData.doctorName = appointmentData.doctorName
              }
              if (appointmentData?.appointmentDate) {
                documentData.appointmentDate = appointmentData.appointmentDate
              }
              if (appointmentData?.patientName) {
                documentData.patientName = appointmentData.patientName
              }
            }
          } catch (err) {
            console.warn("[bulk-upload] Failed to fetch appointment data:", err)
          }
        }

        // Save metadata to Firestore
        const documentsRef = db.collection(getHospitalCollectionPath(hospitalId, "documents"))
        const docRef = documentsRef.doc()
        await docRef.set(documentData)

        // Link to appointment if provided
        if (appointmentId) {
          try {
            const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(appointmentId)
            await appointmentRef.update({
              documentIds: admin.firestore.FieldValue.arrayUnion(docRef.id),
              updatedAt: now,
            })
          } catch {
          }
        }

        results.success.push({
          id: docRef.id,
          ...documentData,
        })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        results.failed.push({
          fileName: file.name,
          error: message || "Upload failed",
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: files.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
    })
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message || "Failed to upload documents" },
      { status: 500 }
    )
  }
}

