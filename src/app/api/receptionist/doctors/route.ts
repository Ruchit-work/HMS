import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getUserActiveHospitalId } from "@/utils/firebase/serverHospitalQueries"

export async function GET(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-doctors API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) {
      return Response.json({ doctors: [] })
    }

    const firestore = admin.firestore()
    const doctors: Array<{ uid: string; fullName: string; specialization: string }> = []

    // Prefer hospital-scoped doctors to enforce strict data isolation.
    const scopedSnap = await firestore
      .collection(getHospitalCollectionPath(hospitalId, "doctors"))
      .limit(200)
      .get()

    if (!scopedSnap.empty) {
      scopedSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() || {}
        const firstName = String(data.firstName || "").trim()
        const lastName = String(data.lastName || "").trim()
        doctors.push({
          uid: docSnap.id,
          fullName: `${firstName} ${lastName}`.trim() || "Unknown Doctor",
          specialization: String(data.specialization || "General"),
        })
      })
      return Response.json({ doctors })
    }

    // Fallback for legacy data model where doctors are in root with hospitalId.
    const legacySnap = await firestore
      .collection("doctors")
      .where("hospitalId", "==", hospitalId)
      .limit(200)
      .get()

    legacySnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const firstName = String(data.firstName || "").trim()
      const lastName = String(data.lastName || "").trim()
      doctors.push({
        uid: docSnap.id,
        fullName: `${firstName} ${lastName}`.trim() || "Unknown Doctor",
        specialization: String(data.specialization || "General"),
      })
    })

    return Response.json({ doctors })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to fetch doctors" },
      { status: 500 }
    )
  }
}
