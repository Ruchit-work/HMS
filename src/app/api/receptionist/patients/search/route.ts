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
    const initResult = initFirebaseAdmin("receptionist-patient-search API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const query = (searchParams.get("q") || "").trim().toLowerCase()
    if (!query || query.length < 2) {
      return Response.json({ patients: [] })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    const firestore = admin.firestore()
    const patientsCollection = hospitalId
      ? firestore.collection(getHospitalCollectionPath(hospitalId, "patients"))
      : firestore.collection("patients")

    const snap = await patientsCollection.orderBy("createdAt", "desc").limit(120).get()
    const patients = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() || {}
        const firstName = String(data.firstName || "").trim()
        const lastName = String(data.lastName || "").trim()
        const fullName = `${firstName} ${lastName}`.trim()
        return {
          uid: docSnap.id,
          patientId: String(data.patientId || ""),
          fullName,
          phone: String(data.phone || ""),
          gender: String(data.gender || ""),
          dateOfBirth: String(data.dateOfBirth || ""),
          address: String(data.address || ""),
        }
      })
      .filter((patient) => {
        const searchable = [
          patient.patientId.toLowerCase(),
          patient.fullName.toLowerCase(),
          patient.phone.toLowerCase(),
        ]
        return searchable.some((value) => value.includes(query))
      })
      .slice(0, 10)

    return Response.json({ patients })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to search patients" },
      { status: 500 }
    )
  }
}
