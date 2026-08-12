import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/shared/utils/firebase/serverHospitalQueries"
import { getStorage } from "firebase-admin/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }

    const user = auth.user!
    const { documentId } = await params

    const initResult = initFirebaseAdmin("document-download API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const db = admin.firestore()
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

    const docRef = db.collection(getHospitalCollectionPath(hospitalId, "documents")).doc(documentId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const documentData = docSnap.data()!

    // Check access permissions
    if (user.role === "patient" && documentData.patientUid !== user.uid) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Generate signed URL (valid for 1 hour)
    const adminApp = admin.app()
    const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"

    const candidateBuckets: string[] = []
    if (documentData.bucketName) {
      candidateBuckets.push(documentData.bucketName)
    }
    const envBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (envBucket) {
      candidateBuckets.push(envBucket.replace(/^gs:\/\//, ""))
    }
    if (adminApp.options.storageBucket) {
      candidateBuckets.push(adminApp.options.storageBucket)
    }
    candidateBuckets.push(`${projectId}.firebasestorage.app`)
    candidateBuckets.push(`${projectId}.appspot.com`)

    const uniqueBuckets = Array.from(new Set(candidateBuckets.filter(Boolean)))

    let targetFileRef = null
    for (const bName of uniqueBuckets) {
      try {
        const b = getStorage().bucket(bName)
        const f = b.file(documentData.storagePath)
        const [exists] = await f.exists()
        if (exists) {
          targetFileRef = f
          break
        }
      } catch {
        // Try next bucket candidate
      }
    }

    if (!targetFileRef) {
      const defaultBucketName = uniqueBuckets[0] || `${projectId}.appspot.com`
      targetFileRef = getStorage().bucket(defaultBucketName).file(documentData.storagePath)
    }

    const [url] = await targetFileRef.getSignedUrl({
      action: "read",
      expires: Date.now() + 3600 * 1000, // 1 hour
    })

    return NextResponse.json({
      success: true,
      downloadUrl: url,
      expiresIn: 3600, // seconds
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate download URL" },
      { status: 500 }
    )
  }
}

