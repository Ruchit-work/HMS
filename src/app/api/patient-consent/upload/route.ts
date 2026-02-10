import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { getStorage } from "firebase-admin/storage"
import { PatientConsentMetadata } from "@/types/consent"

const MAX_VIDEO_SIZE_MB = 100
const ALLOWED_VIDEO_TYPES = ["video/webm", "video/mp4", "video/quicktime"]

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) return createAuthErrorResponse(auth)

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Only doctors and receptionists can upload consent videos." },
        { status: 403 }
      )
    }

    const initResult = initFirebaseAdmin("patient-consent-upload")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const hospitalId = await getUserActiveHospitalId(user.uid)
    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const formData = await request.formData()
    const videoFile = formData.get("video") as File | null
    const patientId = (formData.get("patientId") as string) || ""
    const patientUid = (formData.get("patientUid") as string) || patientId
    const patientName = (formData.get("patientName") as string) || ""
    const appointmentId = (formData.get("appointmentId") as string) || undefined
    const source = ((formData.get("source") as string) || "uploaded") as "recorded" | "uploaded"

    if (!videoFile || !patientId?.trim()) {
      return NextResponse.json(
        { error: "Missing video file or patientId" },
        { status: 400 }
      )
    }

    if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
      return NextResponse.json(
        { error: "Invalid video type. Allowed: webm, mp4, mov" },
        { status: 400 }
      )
    }

    const sizeMB = videoFile.size / (1024 * 1024)
    if (sizeMB > MAX_VIDEO_SIZE_MB) {
      return NextResponse.json(
        { error: `Video size must be under ${MAX_VIDEO_SIZE_MB}MB` },
        { status: 400 }
      )
    }

    const db = admin.firestore()
    const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
    let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ""
    if (storageBucket?.startsWith("gs://")) storageBucket = storageBucket.replace("gs://", "")
    if (!storageBucket) storageBucket = `${projectId}.appspot.com`

    const timestamp = Date.now()
    const ext = videoFile.name.includes(".") ? videoFile.name.slice(videoFile.name.lastIndexOf(".")) : ".webm"
    const consentId = `consent_${timestamp}_${Math.random().toString(36).slice(2, 10)}`
    const storagePath = `hospitals/${hospitalId}/patient-consent/${patientUid}/${consentId}${ext}`

    const arrayBuffer = await videoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let downloadUrl = ""
    let uploadSuccess = false

    // Try primary bucket first
    try {
      const bucket = getStorage().bucket(storageBucket)
      const fileRef = bucket.file(storagePath)
      await fileRef.save(buffer, {
        metadata: {
          contentType: videoFile.type,
          metadata: {
            patientId,
            patientUid,
            hospitalId,
            uploadedBy: user.uid,
            source,
          },
        },
      })
      await fileRef.makePublic()
      downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
      uploadSuccess = true
    } catch (storageErr: unknown) {
      const err = storageErr as { message?: string; code?: number }
      const isNotFound = err.message?.includes("does not exist") || err.message?.includes("not found") || err.code === 404
      if (isNotFound) {
        const alternativeBucketName = `${projectId}.firebasestorage.app`
        if (alternativeBucketName !== storageBucket) {
          try {
            const alternativeBucket = getStorage().bucket(alternativeBucketName)
            const fileRef = alternativeBucket.file(storagePath)
            await fileRef.save(buffer, {
              metadata: {
                contentType: videoFile.type,
                metadata: {
                  patientId,
                  patientUid,
                  hospitalId,
                  uploadedBy: user.uid,
                  source,
                },
              },
            })
            await fileRef.makePublic()
            downloadUrl = `https://storage.googleapis.com/${alternativeBucketName}/${storagePath}`
            uploadSuccess = true
          } catch (altErr) {
            console.error("[patient-consent] Alternative bucket also failed:", altErr)
          }
        }
      }
      if (!uploadSuccess) {
        console.error("[patient-consent] Storage error:", storageErr)
        return NextResponse.json(
          { error: "Failed to upload video to storage. Check Firebase Storage is enabled and bucket name in .env (FIREBASE_STORAGE_BUCKET)." },
          { status: 500 }
        )
      }
    }

    let uploaderName = user.email || "Unknown"
    if (user.role === "doctor") {
      const doctorDoc = await db.collection("doctors").doc(user.uid).get()
      if (doctorDoc.exists) {
        const d = doctorDoc.data()
        uploaderName = [d?.firstName, d?.lastName].filter(Boolean).join(" ") || uploaderName
      }
    } else {
      const recDoc = await db.collection("receptionists").doc(user.uid).get()
      if (recDoc.exists) {
        const r = recDoc.data()
        uploaderName = [r?.firstName, r?.lastName].filter(Boolean).join(" ") || uploaderName
      }
    }

    const now = new Date().toISOString()
    const consentRef = db.collection(getHospitalCollectionPath(hospitalId, "patient_consent")).doc()
    const docData: Record<string, unknown> = {
      patientId,
      patientUid,
      hospitalId,
      storagePath,
      downloadUrl,
      fileName: videoFile.name,
      mimeType: videoFile.type,
      fileSize: videoFile.size,
      source,
      uploadedBy: {
        uid: user.uid,
        role: user.role as "doctor" | "receptionist",
        name: uploaderName,
      },
      uploadedAt: now,
    }
    if (patientName?.trim()) docData.patientName = patientName.trim()
    if (appointmentId?.trim()) docData.appointmentId = appointmentId.trim()
    await consentRef.set(docData)

    const out: PatientConsentMetadata = {
      id: consentRef.id,
      patientId,
      patientUid,
      patientName: patientName?.trim() || undefined,
      appointmentId: appointmentId?.trim() || undefined,
      hospitalId,
      storagePath,
      downloadUrl,
      fileName: videoFile.name,
      mimeType: videoFile.type,
      fileSize: videoFile.size,
      source,
      uploadedBy: {
        uid: user.uid,
        role: user.role as "doctor" | "receptionist",
        name: uploaderName,
      },
      uploadedAt: now,
    }
    return NextResponse.json({ success: true, consent: out })
  } catch (err) {
    console.error("[patient-consent] Upload error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    )
  }
}
