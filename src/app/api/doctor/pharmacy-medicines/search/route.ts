import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getUserActiveHospitalId } from "@/utils/firebase/serverHospitalQueries"

export async function GET(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return Response.json({ error: "Access denied. This endpoint requires doctor role." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("doctor-pharmacy-medicine-search API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })

    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) return Response.json({ medicines: [] })

    const { searchParams } = new URL(req.url)
    const queryText = (searchParams.get("q") || "").trim().toLowerCase()
    if (queryText.length < 2) return Response.json({ medicines: [] })

    const firestore = admin.firestore()
    const path = getHospitalCollectionPath(hospitalId, "pharmacy_medicines")
    const snap = await firestore.collection(path).limit(200).get()
    const medicines = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() || {}
        return {
          id: docSnap.id,
          name: String(data.name || ""),
          genericName: String(data.genericName || ""),
          manufacturer: String(data.manufacturer || ""),
          sellingPrice: Number(data.sellingPrice || 0),
        }
      })
      .filter((med) => {
        const haystack = `${med.name} ${med.genericName} ${med.manufacturer}`.toLowerCase()
        return haystack.includes(queryText)
      })
      .slice(0, 20)

    return Response.json({ medicines })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to search medicines" }, { status: 500 })
  }
}

