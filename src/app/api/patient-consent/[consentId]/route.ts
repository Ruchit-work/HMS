import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { getStorage } from "firebase-admin/storage"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ consentId: string }> }
) {
  try {
    const auth = await authenticateRequest(_request)
    if (!auth.success) return createAuthErrorResponse(auth)

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist", "admin"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Only doctors, receptionists, or admins can delete consent videos." },
        { status: 403 }
      )
    }

    const initResult = initFirebaseAdmin("patient-consent-delete")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const hospitalId = await getUserActiveHospitalId(user.uid)
    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const { consentId } = await params
    if (!consentId?.trim()) {
      return NextResponse.json({ error: "consentId is required" }, { status: 400 })
    }

    const db = admin.firestore()
    const consentRef = db.collection(getHospitalCollectionPath(hospitalId, "patient_consent")).doc(consentId)
    const consentSnap = await consentRef.get()

    if (!consentSnap.exists) {
      return NextResponse.json({ error: "Consent not found" }, { status: 404 })
    }

    const data = consentSnap.data()
    const storagePath = data?.storagePath as string | undefined

    // Delete file from Storage if we have a path (best effort; doc delete still proceeds)
    if (storagePath?.trim()) {
      try {
        const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
        let bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ""
        if (bucketName?.startsWith("gs://")) bucketName = bucketName.replace("gs://", "")
        if (!bucketName) bucketName = `${projectId}.appspot.com`
        const bucket = getStorage().bucket(bucketName)
        const fileRef = bucket.file(storagePath)
        await fileRef.delete()
      } catch (storageErr) {
        console.warn("[patient-consent] Delete: could not delete storage file:", storageErr)
        // Try alternative bucket
        try {
          const projectId = process.env.FIREBASE_PROJECT_ID || "hospital-management-sys-eabb2"
          const altBucket = getStorage().bucket(`${projectId}.firebasestorage.app`)
          await altBucket.file(storagePath).delete()
        } catch {
          // Ignore; we still delete the Firestore doc
        }
      }
    }

    await consentRef.delete()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[patient-consent] Delete error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    )
  }
}
