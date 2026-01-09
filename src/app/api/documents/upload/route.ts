import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"
import { DocumentMetadata } from "@/types/document"
import { getStorage } from "firebase-admin/storage"
import { detectDocumentTypeEnhanced, validateFileSize } from "@/utils/documentDetection"

// File size validation is now handled by validateFileSize() from documentDetection.ts
// which applies different limits: PDFs (1KB-20MB), Other files (2MB-10MB)

// Simple file type validation
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf", "image/jpg"]

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
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

    // Initialize Firebase Admin
    const initResult = initFirebaseAdmin("document-upload API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
    
    // Get hospital ID first (needed for patient lookup and document storage)
    let hospitalId: string | null = null
    if (user.role === "patient") {
      // For patients, get their hospital ID
      const patientDoc = await db.collection("patients").doc(user.uid).get()
      if (patientDoc.exists) {
        hospitalId = patientDoc.data()?.hospitalId || null
      }
    } else {
      // For doctors/receptionists, get their active hospital
      hospitalId = await getUserActiveHospitalId(user.uid)
    }

    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    // Get storage bucket - try multiple approaches
    const adminApp = admin.app()
    const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
    
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
    
    // If no bucket specified, try to construct from project ID
    if (!storageBucket) {
      // Try both common formats
      storageBucket = `${projectId}.appspot.com`
    }
    
    console.log("[document-upload] Using storage bucket:", storageBucket)
    console.log("[document-upload] Project ID:", projectId)
    
    // Initialize bucket - Firebase Admin will use the bucket name as-is
    const bucket = getStorage().bucket(storageBucket)
    
    // Note: We don't verify the bucket exists here because:
    // 1. getMetadata() might fail due to permissions even if the bucket exists
    // 2. The actual upload operation will fail with a clearer error if the bucket doesn't exist
    // 3. This avoids unnecessary API calls

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const patientId = formData.get("patientId") as string | null
    const patientUid = formData.get("patientUid") as string | null
    const appointmentId = formData.get("appointmentId") as string | null
    const fileType = formData.get("fileType") as string | null
    const specialty = formData.get("specialty") as string | null
    const description = formData.get("description") as string | null
    const tags = formData.get("tags") as string | null

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    // If patientUid is provided but patientId is not, try to get patientId from patient document
    let finalPatientId = patientId
    const finalPatientUid = patientUid

    if (patientUid && !patientId) {
      try {
        // Try hospital-scoped collection first (more likely to have the patient)
        const hospitalPatientDoc = await db.collection(getHospitalCollectionPath(hospitalId, "patients")).doc(patientUid).get()
        if (hospitalPatientDoc.exists) {
          const patientData = hospitalPatientDoc.data()
          finalPatientId = patientData?.patientId || patientUid
        } else {
          // Fallback to global patients collection
          const patientDoc = await db.collection("patients").doc(patientUid).get()
          if (patientDoc.exists) {
            const patientData = patientDoc.data()
            finalPatientId = patientData?.patientId || patientUid
          }
        }
      } catch (err) {
        console.warn("[document-upload] Failed to fetch patient data:", err)
        // Use patientUid as fallback
        finalPatientId = patientUid
      }
    }

    if (!finalPatientUid) {
      return NextResponse.json({ error: "Patient UID is required" }, { status: 400 })
    }

    if (!finalPatientId) {
      finalPatientId = finalPatientUid // Use UID as fallback
    }

    // Simple file validation
    // Validate file size using the utility function (handles PDFs differently)
    const sizeValidation = validateFileSize(file)
    if (!sizeValidation.valid) {
      return NextResponse.json({ error: sizeValidation.error }, { status: 400 })
    }

    // Simple type check
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: `File type not allowed. Allowed types: JPG, PNG, PDF` 
      }, { status: 400 })
    }

    // Verify patient belongs to same hospital (for doctors/receptionists)
    if (user.role !== "patient") {
      const patientDoc = await db.collection(getHospitalCollectionPath(hospitalId, "patients")).doc(finalPatientUid).get()
      if (!patientDoc.exists) {
        return NextResponse.json({ error: "Patient not found in this hospital" }, { status: 404 })
      }
    }

    // Convert File to Buffer first (needed for both analysis and upload)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Enhanced document type detection: tries filename first, then PDF content analysis
    let detectedResult
    try {
      // Always use enhanced detection for PDFs (it will try filename first, then content)
      // For non-PDFs, use simple filename detection
      if (file.type === 'application/pdf') {
        console.log("[document-upload] PDF detected, attempting enhanced document type detection...")
        console.log("[document-upload] File name:", file.name, "File type provided:", fileType)
        detectedResult = await detectDocumentTypeEnhanced(file.name, buffer, file.type)
        console.log("[document-upload] Detection result:", JSON.stringify(detectedResult, null, 2))
      } else {
        // For non-PDFs, use simple filename detection
        const { detectDocumentType, detectSpecialty } = await import("@/utils/documentDetection")
        detectedResult = {
          type: detectDocumentType(file.name),
          specialty: detectSpecialty(file.name),
          source: 'filename' as const
        }
        console.log("[document-upload] Non-PDF file, using filename detection:", detectedResult)
      }
    } catch (detectionError: any) {
      // If detection fails, fallback to simple filename detection
      console.error("[document-upload] Enhanced detection failed, using filename detection:", detectionError.message, detectionError.stack)
      const { detectDocumentType, detectSpecialty } = await import("@/utils/documentDetection")
      detectedResult = {
        type: detectDocumentType(file.name),
        specialty: detectSpecialty(file.name),
        source: 'filename' as const
      }
    }
    
    // Use provided values or detected values
    const finalFileType = fileType || detectedResult.type
    const finalSpecialty = specialty || detectedResult.specialty

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
    const finalFileName = `${timestamp}_${finalPatientId}_${sanitized}_${randomString}${extension}`
    const storagePath = `hospitals/${hospitalId}/patients/${finalPatientId}/${finalFileName}`
    
    console.log("[document-upload] 📁 Storage path:", storagePath)
    console.log("[document-upload] 📄 File info:", {
      name: file.name,
      size: file.size,
      type: file.type,
      detectedType: finalFileType,
      detectionSource: detectedResult.source,
    })

    // Upload to Firebase Storage - SIMPLIFIED with automatic fallback
    console.log("[document-upload] 📤 Starting file upload...")
    let fileRef
    let downloadUrl
    let uploadSuccess = false
    
    // Try primary bucket first
    try {
      fileRef = bucket.file(storagePath)
      
      console.log("[document-upload] 📦 Uploading to bucket:", bucket.name)
      console.log("[document-upload] 📍 Full path:", storagePath)
      
      // Upload the file
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
      
      console.log("[document-upload] ✅ File uploaded successfully")
      
      // Make file publicly readable
      await fileRef.makePublic()
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
      
      console.log("[document-upload] 🔗 Download URL:", downloadUrl)
      uploadSuccess = true
    } catch (uploadError: any) {
      // Check if it's a bucket not found error - try alternative format
      if (uploadError.message?.includes("does not exist") || uploadError.message?.includes("not found") || uploadError.code === 404) {
        console.log("[document-upload] ℹ️ Primary bucket format not found, trying alternative (this is normal)")
        const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
        const alternativeBucketName = `${projectId}.firebasestorage.app`
        
        // Only try alternative if it's different from what we already tried
        if (alternativeBucketName !== storageBucket) {
          console.log("[document-upload] ⚠️ Bucket not found, trying alternative format:", alternativeBucketName)
          
          try {
            const alternativeBucket = getStorage().bucket(alternativeBucketName)
            fileRef = alternativeBucket.file(storagePath)
            
            console.log("[document-upload] 📦 Uploading to alternative bucket:", alternativeBucketName)
            
            // Upload the file to alternative bucket
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
            
            console.log("[document-upload] ✅ File uploaded successfully to alternative bucket")

            // Make file publicly readable
            await fileRef.makePublic()
            downloadUrl = `https://storage.googleapis.com/${alternativeBucketName}/${storagePath}`
            
            console.log("[document-upload] 🔗 Download URL:", downloadUrl)
            uploadSuccess = true
          } catch (altError: any) {
            console.error("[document-upload] ❌ Alternative bucket also failed:", altError.message)
          }
        }
      }
    }
    
    // If upload failed after trying both buckets, return error
    if (!uploadSuccess) {
      const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
      const alternativeBucket = `${projectId}.firebasestorage.app`
      
      return NextResponse.json(
        { 
          error: `Storage bucket not found.`,
          details: `Tried both "${storageBucket}" and "${alternativeBucket}" but neither exists.`,
          suggestions: [
            `1. Go to Firebase Console → Storage and enable Storage if not already enabled`,
            `2. Check the exact bucket name in Firebase Console → Storage`,
            `3. Set FIREBASE_STORAGE_BUCKET in your .env.local file with the correct bucket name`,
            `4. The bucket name should match exactly what you see in Firebase Console`,
          ],
          triedBuckets: [storageBucket, alternativeBucket],
          projectId: projectId,
          helpUrl: "https://console.firebase.google.com/project/" + projectId + "/storage",
        },
        { status: 400 }
      )
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
    } else if (user.role === "patient") {
      const patientDoc = await db.collection("patients").doc(user.uid).get()
      if (patientDoc.exists) {
        const patientData = patientDoc.data()
        uploaderName = `${patientData?.firstName || ""} ${patientData?.lastName || ""}`.trim() || uploaderName
      }
    }

    // Create document metadata - remove undefined values for Firestore
    const now = new Date().toISOString()
    const documentData: any = {
      patientId: finalPatientId,
      patientUid: finalPatientUid,
      hospitalId,
      fileName: finalFileName,
      originalFileName: file.name,
      fileType: finalFileType as any,
      mimeType: file.type,
      fileSize: file.size,
      storagePath,
      downloadUrl,
      uploadedBy: {
        uid: user.uid,
        role: user.role as "doctor" | "receptionist" | "patient",
        name: uploaderName,
      },
      uploadedAt: now,
      status: "active",
      isLinkedToAppointment: !!appointmentId,
    }

    // Only add optional fields if they have values (Firestore doesn't allow undefined)
    if (finalSpecialty) {
      documentData.specialty = finalSpecialty
    }
    if (description && description.trim()) {
      documentData.description = description.trim()
    }
    if (tags && tags.trim()) {
      documentData.tags = tags.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0)
    }
    // If linked to appointment, fetch appointment data to get doctor/appointment/patient metadata
    let doctorId: string | undefined
    let doctorName: string | undefined
    let appointmentDate: string | undefined
    if (appointmentId) {
      documentData.appointmentId = appointmentId
      try {
        const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(appointmentId)
        const appointmentDoc = await appointmentRef.get()
        if (appointmentDoc.exists) {
          const appointmentData = appointmentDoc.data()
          doctorId = appointmentData?.doctorId
          doctorName = appointmentData?.doctorName
          appointmentDate = appointmentData?.appointmentDate
          if (doctorId) {
            documentData.doctorId = doctorId
          }
          if (doctorName) {
            documentData.doctorName = doctorName
          }
          if (appointmentDate) {
            documentData.appointmentDate = appointmentDate
          }
          if (appointmentData?.patientName) {
            documentData.patientName = appointmentData.patientName
          }
        }
      } catch (err) {
        console.warn("[document-upload] Failed to fetch appointment data:", err)
      }
    }

    // Save metadata to Firestore
    const documentsRef = db.collection(getHospitalCollectionPath(hospitalId, "documents"))
    const docRef = documentsRef.doc()
    await docRef.set(documentData)

    // If linked to appointment, update appointment document
    if (appointmentId) {
      try {
        const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc(appointmentId)
        await appointmentRef.update({
          documentIds: admin.firestore.FieldValue.arrayUnion(docRef.id),
          updatedAt: now,
        })
      } catch (err) {
        console.warn("[document-upload] Failed to link document to appointment:", err)
      }
    }

    const documentMetadata: DocumentMetadata = {
      id: docRef.id,
      ...documentData,
    }

    return NextResponse.json({
      success: true,
      document: documentMetadata,
    })
  } catch (error: any) {
    console.error("[document-upload] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    )
  }
}

