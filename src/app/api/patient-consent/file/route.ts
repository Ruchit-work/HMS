import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { getStorage } from "firebase-admin/storage"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) return createAuthErrorResponse(auth)

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist", "admin"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const initResult = initFirebaseAdmin("patient-consent-file")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const hospitalId = await getUserActiveHospitalId(user.uid)
    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const db = admin.firestore()
    const consentRef = db.collection(getHospitalCollectionPath(hospitalId, "patient_consent")).doc(id)
    const snap = await consentRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: "Consent not found" }, { status: 404 })
    }

    const data = snap.data() as any
    const storagePath: string | undefined = data.storagePath
    const mimeType: string | undefined = data.mimeType || "video/webm"
    if (!storagePath) {
      return NextResponse.json({ error: "Missing storagePath for consent" }, { status: 500 })
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
    let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ""
    if (storageBucket?.startsWith("gs://")) storageBucket = storageBucket.replace("gs://", "")
    if (!storageBucket) storageBucket = `${projectId}.appspot.com`

    const bucket = getStorage().bucket(storageBucket)
    const file = bucket.file(storagePath)

    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
    }

    const [buffer] = await file.download()
    // Convert Node Buffer to Uint8Array so it matches the runtime's BodyInit types
    const body = new Uint8Array(buffer)
    const contentType = mimeType || "application/octet-stream"

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, max-age=0, no-store",
      } as Record<string, string>,
    })
  } catch (err) {
    console.error("[patient-consent-file] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch consent video" },
      { status: 500 }
    )
  }
}

