import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

interface Params {
  admissionId: string
}

export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return Response.json({ error: "Access denied. This endpoint requires doctor role." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("doctor-request-discharge API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })

    const { admissionId } = await context.params
    if (!admissionId) return Response.json({ error: "Missing admissionId" }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const notes = typeof body?.notes === "string" ? body.notes.trim() : ""

    const firestore = admin.firestore()
    const admissionRef = firestore.collection("admissions").doc(admissionId)
    const nowIso = new Date().toISOString()

    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(admissionRef)
      if (!snap.exists) throw new Error("Admission not found")
      const admission = snap.data() || {}
      if (admission.status !== "admitted") throw new Error("Only admitted patients can be requested for discharge")
      if (String(admission.doctorId || "") !== auth.user!.uid) {
        throw new Error("You can request discharge only for your admitted patients")
      }

      tx.update(admissionRef, {
        dischargeRequest: {
          requestedByDoctor: true,
          requestedByDoctorAt: nowIso,
          requestedByDoctorId: auth.user!.uid,
          requestedByDoctorName: admission.doctorName || null,
          notes: notes || null,
          status: "pending",
        },
        updatedAt: nowIso,
      })
    })

    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to request discharge" }, { status: 500 })
  }
}

