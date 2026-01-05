import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"
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
    let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (storageBucket?.startsWith("gs://")) {
      storageBucket = storageBucket.replace("gs://", "")
    }
    if (!storageBucket && adminApp.options.storageBucket) {
      storageBucket = adminApp.options.storageBucket
    }
    const bucket = storageBucket ? getStorage().bucket(storageBucket) : getStorage().bucket()
    const fileRef = bucket.file(documentData.storagePath)
    const [url] = await fileRef.getSignedUrl({
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

