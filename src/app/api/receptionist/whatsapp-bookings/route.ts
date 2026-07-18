import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { getUserActiveHospitalId } from "@/shared/utils/firebase/serverHospitalQueries"
import { Appointment } from "@/types/patient"
import type { Query } from "firebase-admin/firestore"

const APPOINTMENT_SELECT_FIELDS = [
  "patientId",
  "patientUid",
  "patientName",
  "patientEmail",
  "patientPhone",
  "doctorId",
  "doctorName",
  "doctorSpecialization",
  "appointmentDate",
  "appointmentTime",
  "chiefComplaint",
  "medicalHistory",
  "paymentStatus",
  "paymentMethod",
  "paymentType",
  "totalConsultationFee",
  "consultationFee",
  "paymentAmount",
  "remainingAmount",
  "transactionId",
  "paidAt",
  "status",
  "whatsappPending",
  "branchId",
  "createdAt",
  "updatedAt",
] as const

async function runQuerySafe(build: () => Query): Promise<FirebaseFirestore.QuerySnapshot | null> {
  try {
    try {
      return await build().select(...APPOINTMENT_SELECT_FIELDS).get()
    } catch {
      // Some environments/indexes edge-cases: fall back to full docs (same filters).
      return await build().get()
    }
  } catch {
    return null
  }
}

function mergeSnapshot(
  appointmentMap: Map<string, Record<string, unknown>>,
  snap: FirebaseFirestore.QuerySnapshot | null
) {
  if (!snap) return
  snap.docs.forEach((doc) => {
    if (!appointmentMap.has(doc.id)) {
      appointmentMap.set(doc.id, { id: doc.id, ...doc.data() })
    }
  })
}

export async function GET(request: Request) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
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
    const initResult = initFirebaseAdmin("receptionist whatsapp-bookings API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured" }, { status: 500 })
    }

    const firestore = admin.firestore()

    // Prefer branchId already loaded by authenticateRequest (avoids a duplicate receptionist read).
    let receptionistBranchId: string | null = null
    if (auth.user && auth.user.role === "receptionist") {
      const fromAuth =
        typeof auth.user.data?.branchId === "string" && auth.user.data.branchId.trim()
          ? auth.user.data.branchId.trim()
          : null
      if (fromAuth) {
        receptionistBranchId = fromAuth
      } else {
        try {
          const receptionistDoc = await firestore.collection("receptionists").doc(auth.user.uid).get()
          if (receptionistDoc.exists) {
            const receptionistData = receptionistDoc.data()
            receptionistBranchId = receptionistData?.branchId || null
          }
        } catch {
          // ignore
        }
      }
    }

    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)

    // Fetch appointments with whatsappPending flag or status whatsapp_pending
    // Note: Can't use orderBy with where without composite index; sort in memory.
    const appointmentMap = new Map<string, Record<string, unknown>>()

    if (hospitalId) {
      const hospAppointmentsRef = firestore.collection(`hospitals/${hospitalId}/appointments`)

      const [whatsappSnap, pendingSnap] = await Promise.all([
        runQuerySafe(() => {
          let q: Query = hospAppointmentsRef.where("whatsappPending", "==", true)
          if (receptionistBranchId) {
            q = q.where("branchId", "==", receptionistBranchId)
          }
          return q.limit(100)
        }),
        runQuerySafe(() => {
          let q: Query = hospAppointmentsRef.where("status", "==", "whatsapp_pending")
          if (receptionistBranchId) {
            q = q.where("branchId", "==", receptionistBranchId)
          }
          return q.limit(100)
        }),
      ])

      mergeSnapshot(appointmentMap, whatsappSnap)
      mergeSnapshot(appointmentMap, pendingSnap)
    }

    // Fallback to root collection only when hospital-scoped data is empty (backward compatible).
    if (appointmentMap.size === 0) {
      const rootRef = firestore.collection("appointments")
      const [rootWhatsappSnap, rootPendingSnap] = await Promise.all([
        runQuerySafe(() => {
          let q: Query = rootRef.where("whatsappPending", "==", true)
          if (receptionistBranchId) {
            q = q.where("branchId", "==", receptionistBranchId)
          }
          return q.limit(100)
        }),
        runQuerySafe(() => {
          let q: Query = rootRef.where("status", "==", "whatsapp_pending")
          if (receptionistBranchId) {
            q = q.where("branchId", "==", receptionistBranchId)
          }
          return q.limit(100)
        }),
      ])

      mergeSnapshot(appointmentMap, rootWhatsappSnap)
      mergeSnapshot(appointmentMap, rootPendingSnap)
    }

    const appointments: Appointment[] = Array.from(appointmentMap.values()).map((data: any) => {
      // Map whatsapp_pending status to pending for type compatibility
      let status: "pending" | "confirmed" | "completed" | "cancelled" = "pending"
      if (data.status === "whatsapp_pending" || data.whatsappPending) {
        status = "pending"
      } else if (data.status === "confirmed") {
        status = "confirmed"
      } else if (data.status === "completed") {
        status = "completed"
      } else if (data.status === "cancelled") {
        status = "cancelled"
      }

      return {
        id: data.id,
        patientId: data.patientId || "",
        patientUid: data.patientUid || data.patientId || "",
        patientName: data.patientName || "Unknown",
        patientEmail: data.patientEmail || "",
        patientPhone: data.patientPhone || "",
        doctorId: data.doctorId || "",
        doctorName: data.doctorName || "",
        doctorSpecialization: data.doctorSpecialization || "",
        appointmentDate: data.appointmentDate || "",
        appointmentTime: data.appointmentTime || "",
        chiefComplaint: data.chiefComplaint || "General consultation",
        medicalHistory: data.medicalHistory || "",
        paymentStatus: data.paymentStatus || "pending",
        paymentMethod: data.paymentMethod || "cash",
        paymentType: (data.paymentType as "full" | "partial") || "full",
        totalConsultationFee: data.totalConsultationFee || data.consultationFee || 0,
        paymentAmount: data.paymentAmount || 0,
        remainingAmount: data.remainingAmount || data.totalConsultationFee || data.consultationFee || 0,
        transactionId: data.transactionId || data.id,
        paidAt: data.paidAt || "",
        status,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      } as Appointment
    })

    appointments.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    return Response.json({ appointments })
  } catch (error: any) {
    return Response.json(
      { error: "Failed to fetch WhatsApp bookings", details: error.message },
      { status: 500 }
    )
  }
}
