import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
  getHospitalCollectionPath,
} from "@/shared/utils/firebase/serverHospitalQueries"

interface UnifiedBillingRecord {
  id: string
  type: "admission" | "appointment"
  admissionId?: string
  appointmentId?: string
  patientId: string
  patientUid?: string | null
  patientName?: string | null
  doctorId: string
  doctorName?: string | null
  roomCharges?: number
  doctorFee?: number
  consultationFee?: number
  otherServices?: Array<{ description: string; amount: number }>
  totalAmount: number
  generatedAt: string
  status: "pending" | "paid" | "void" | "cancelled"
  paymentMethod?: "card" | "upi" | "cash"
  paidAt?: string | null
  paymentReference?: string | null
  transactionId?: string | null
  paidAtFrontDesk?: boolean
  handledBy?: string | null
  settlementMode?: string | null
  paymentType?: "full" | "partial"
  remainingAmount?: number
  hospitalId?: string | null
  branchId?: string | null
}

/** Appointments list mixes Firestore snapshots and plain `{ id, ...fields }` objects. */
function readAppointmentEntry(entry: unknown): { id: string; data: Record<string, any> } {
  if (entry && typeof (entry as { data?: unknown }).data === "function") {
    const snap = entry as FirebaseFirestore.QueryDocumentSnapshot
    return { id: snap.id, data: snap.data() || {} }
  }
  const row = (entry || {}) as Record<string, any>
  const { id, ...rest } = row
  return { id: String(id || ""), data: rest }
}

export async function GET(request: Request) {
  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("admin billing-records API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const firestore = admin.firestore()
    const records: UnifiedBillingRecord[] = []
    const billedAppointmentIds = new Set<string>()

    const uid = auth.user!.uid
    const superAdmin = await isPlatformSuperAdmin(uid)
    const scopedHospitalId = await getUserActiveHospitalId(uid)
    if (!superAdmin && !scopedHospitalId) {
      return Response.json({ error: "Hospital context required" }, { status: 400 })
    }

    // Fetch billing records — tenant-scoped for hospital admins
    let billingSnapshot
    try {
      if (scopedHospitalId) {
        billingSnapshot = await firestore
          .collection("billing_records")
          .where("hospitalId", "==", scopedHospitalId)
          .orderBy("generatedAt", "desc")
          .limit(100)
          .get()
      } else {
        // Super admin with no active hospital: platform view (limited)
        billingSnapshot = await firestore
          .collection("billing_records")
          .orderBy("generatedAt", "desc")
          .limit(100)
          .get()
      }
    } catch {
      // Fallback if composite index missing: filter in memory
      const snap = await firestore
        .collection("billing_records")
        .orderBy("generatedAt", "desc")
        .limit(300)
        .get()
      const filtered = scopedHospitalId
        ? snap.docs.filter((d) => String(d.data()?.hospitalId || "") === scopedHospitalId)
        : snap.docs
      billingSnapshot = { docs: filtered.slice(0, 100) } as FirebaseFirestore.QuerySnapshot
    }

    for (const docSnap of billingSnapshot.docs) {
      const data = docSnap.data() || {}
      let patientName = data.patientName || null
      let patientUid = data.patientUid || null
      const patientId = data.patientId || null

      // Enrich patient name if needed
      const needsEnrichment =
        !patientName ||
        (typeof patientName === "string" && patientName.trim().toLowerCase() === "unknown")

      if (needsEnrichment) {
        try {
          if (patientUid) {
            const patientDoc = await firestore.collection("patients").doc(String(patientUid)).get()
            if (patientDoc.exists) {
              const patient = patientDoc.data() as any
              const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
              patientName = composed || patient?.fullName || patientName
            }
          } else if (patientId) {
            const querySnap = await firestore
              .collection("patients")
              .where("patientId", "==", patientId)
              .limit(1)
              .get()
            if (!querySnap.empty) {
              const patientDoc = querySnap.docs[0]
              const patient = patientDoc.data() as any
              const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
              patientName = composed || patient?.fullName || patientName
              patientUid = patientDoc.id
            }
          }
        } catch {
        }
      }

      // Get branchId from billing record or associated appointment
      let branchId: string | null = data.branchId || null
      
      // If no branchId in billing record, try to get it from associated appointment
      if (!branchId && data.appointmentId) {
        try {
          // Try hospital-scoped appointments first
          const hospitalsSnap = await firestore.collection("hospitals").where("status", "==", "active").limit(10).get()
          for (const hospDoc of hospitalsSnap.docs) {
            const hospId = hospDoc.id
            const aptDoc = await firestore.collection(`hospitals/${hospId}/appointments`).doc(String(data.appointmentId)).get()
            if (aptDoc.exists) {
              branchId = aptDoc.data()?.branchId || null
              break
            }
          }
          
          // Fallback to root appointments collection
          if (!branchId) {
            const aptDoc = await firestore.collection("appointments").doc(String(data.appointmentId)).get()
            if (aptDoc.exists) {
              branchId = aptDoc.data()?.branchId || null
            }
          }
        } catch {
        }
      }

      records.push({
        id: docSnap.id,
        type: "admission",
        admissionId: String(data.admissionId || ""),
        appointmentId: data.appointmentId ? String(data.appointmentId) : undefined,
        patientId: String(patientId || ""),
        patientUid,
        patientName,
        doctorId: String(data.doctorId || ""),
        doctorName: data.doctorName || null,
        roomCharges: Number(data.roomCharges || 0),
        doctorFee: data.doctorFee !== undefined ? Number(data.doctorFee) : undefined,
        otherServices: Array.isArray(data.otherServices) ? data.otherServices : [],
        totalAmount: Number(data.totalAmount || 0),
        generatedAt: data.generatedAt || new Date().toISOString(),
        status: data.status || "pending",
        paymentMethod: data.paymentMethod,
        paidAt: data.paidAt || null,
        paymentReference: data.paymentReference || null,
        transactionId: data.paymentReference || null,
        paidAtFrontDesk: data?.paidAtFrontDesk ?? false,
        handledBy: data?.handledBy || null,
        settlementMode: data?.settlementMode || null,
        hospitalId: data.hospitalId || null,
        branchId: branchId,
      })

      // Track any explicit appointment billing tied to an appointmentId
      if (data.appointmentId) {
        billedAppointmentIds.add(String(data.appointmentId))
      }
    }

    // Fetch appointments with billable amounts — paid AND unpaid/pending.
    // Auto-created recheckups are saved as paymentStatus="unpaid" with remainingAmount > 0
    // and must appear as outstanding dues. Avoid composite index queries that silently fail
    // and drop those unpaid rows (same pattern as receptionist/billing-records).
    const appointmentsDocs: any[] = []
    const seenAppointmentIds = new Set<string>()

    const isBillableAppointment = (data: Record<string, any>) => {
      // Unconfirmed WhatsApp bookings are not appointments yet — no invoice exists
      // until the front desk confirms them.
      if (data?.status === "whatsapp_pending" || data?.whatsappPending === true) return false
      const paymentAmount = Number(data?.paymentAmount || 0)
      const totalConsultationFee = Number(data?.totalConsultationFee || 0)
      const remainingAmount = Number(data?.remainingAmount || 0)
      const paymentStatus = String(data?.paymentStatus || "").toLowerCase()
      const hasFee = paymentAmount > 0 || totalConsultationFee > 0 || remainingAmount > 0
      if (!hasFee) return false
      // Include unpaid / pending dues even when paymentAmount is still 0
      if (paymentStatus === "unpaid" || paymentStatus === "pending" || remainingAmount > 0) return true
      return paymentAmount > 0 || Boolean(data?.paidAt)
    }

    try {
      if (scopedHospitalId) {
        const hospSnap = await firestore
          .collection(getHospitalCollectionPath(scopedHospitalId, "appointments"))
          .orderBy("createdAt", "desc")
          .limit(150)
          .get()

        for (const doc of hospSnap.docs) {
          const data = doc.data() || {}
          if (!isBillableAppointment(data)) continue
          if (seenAppointmentIds.has(doc.id)) continue
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }
      } else if (superAdmin) {
        const hospitalsSnap = await firestore.collection("hospitals").where("status", "==", "active").limit(20).get()
        for (const hospDoc of hospitalsSnap.docs) {
          const hospSnap = await firestore
            .collection(`hospitals/${hospDoc.id}/appointments`)
            .orderBy("createdAt", "desc")
            .limit(50)
            .get()
          for (const doc of hospSnap.docs) {
            const data = doc.data() || {}
            if (!isBillableAppointment(data)) continue
            if (seenAppointmentIds.has(doc.id)) continue
            appointmentsDocs.push(doc)
            seenAppointmentIds.add(doc.id)
          }
        }
      } else {
        const rootSnap = await firestore
          .collection("appointments")
          .orderBy("createdAt", "desc")
          .limit(150)
          .get()
        for (const doc of rootSnap.docs) {
          const data = doc.data() || {}
          if (!isBillableAppointment(data)) continue
          if (seenAppointmentIds.has(doc.id)) continue
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }
      }
    } catch {
      // Final fallback: unordered sample
      try {
        const appointmentsCol = scopedHospitalId
          ? firestore.collection(getHospitalCollectionPath(scopedHospitalId, "appointments"))
          : firestore.collection("appointments")
        const allAppointmentsSnapshot = await appointmentsCol.limit(150).get()
        for (const doc of allAppointmentsSnapshot.docs) {
          const data = doc.data() || {}
          if (!isBillableAppointment(data)) continue
          if (seenAppointmentIds.has(doc.id)) continue
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }
      } catch {
        // ignore
      }
    }

    for (const docSnap of appointmentsDocs) {
      const { id: appointmentId, data } = readAppointmentEntry(docSnap)
      if (!appointmentId) continue
      const paymentAmount = Number(data.paymentAmount || 0)
      const totalConsultationFee = Number(data.totalConsultationFee || 0)
      if (paymentAmount <= 0 && totalConsultationFee <= 0) {
        continue
      }

      // Skip if there's already an explicit billing record for this appointment
      if (billedAppointmentIds.has(appointmentId)) {
        continue
      }

      let patientName = data.patientName || null
      let patientUid = data.patientUid || null
      const patientId = data.patientId || null

      // Enrich patient name if needed
      if (!patientName || (typeof patientName === "string" && patientName.trim().toLowerCase() === "unknown")) {
        try {
          if (patientUid) {
            const patientDoc = await firestore.collection("patients").doc(String(patientUid)).get()
            if (patientDoc.exists) {
              const patient = patientDoc.data() as any
              const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
              patientName = composed || patient?.fullName || patientName
            }
          } else if (patientId) {
            const querySnap = await firestore
              .collection("patients")
              .where("patientId", "==", patientId)
              .limit(1)
              .get()
            if (!querySnap.empty) {
              const patientDoc = querySnap.docs[0]
              const patient = patientDoc.data() as any
              const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
              patientName = composed || patient?.fullName || patientName
              patientUid = patientDoc.id
            }
          }
        } catch {
        }
      }

      // Determine status. Evidence of payment (paymentStatus="paid" or a paidAt
      // timestamp) must always win over pending heuristics — legacy paid rows can
      // have paymentAmount = 0 and would otherwise surface as bogus pending dues
      // that reject collection with "Appointment already paid".
      let status: "pending" | "paid" | "void" | "cancelled" = "paid"
      const paymentStatus = String(data.paymentStatus || "").toLowerCase()
      const hasPaidAt = Boolean(data.paidAt) && String(data.paidAt).trim() !== ""
      if (
        data.status === "cancelled" ||
        data.status === "doctor_cancelled" ||
        // Refunded payments are not collected revenue and are not outstanding —
        // exclude them from both paid and pending buckets.
        paymentStatus === "refunded"
      ) {
        status = "cancelled"
      } else if (paymentStatus === "paid" || hasPaidAt) {
        status = "paid"
      } else {
        // Recheckups are created as paymentStatus="unpaid" with remainingAmount set —
        // treat them as outstanding until front-desk / patient payment clears them.
        status = "pending"
      }

      const billedAmount =
        status === "pending"
          ? Number(data.remainingAmount || 0) > 0
            ? Number(data.remainingAmount)
            : paymentAmount > 0
              ? paymentAmount
              : totalConsultationFee
          : paymentAmount > 0
            ? paymentAmount
            : totalConsultationFee

      records.push({
        id: appointmentId,
        type: "appointment",
        appointmentId,
        admissionId: data.admissionId ? String(data.admissionId) : undefined,
        patientId: String(patientId || ""),
        patientUid,
        patientName,
        doctorId: String(data.doctorId || ""),
        doctorName: data.doctorName || null,
        consultationFee: totalConsultationFee || paymentAmount,
        totalAmount: billedAmount,
        generatedAt: data.paidAt || data.createdAt || new Date().toISOString(),
        status,
        paymentMethod: data.paymentMethod || undefined,
        paidAt: hasPaidAt ? data.paidAt : null,
        paymentReference: data.transactionId || null,
        transactionId: data.transactionId || null,
        hospitalId: data.hospitalId || null,
        branchId: data.branchId || null,
        paidAtFrontDesk: false,
        paymentType: data.paymentType || "full",
        remainingAmount:
          status === "pending"
            ? billedAmount - (hasPaidAt ? paymentAmount : 0) > 0
              ? billedAmount - (hasPaidAt ? paymentAmount : 0)
              : billedAmount || totalConsultationFee
            : Number(data.remainingAmount || 0),
      })
    }

    // Sort all records by generatedAt/paidAt (most recent first)
    records.sort((a, b) => {
      const dateA = new Date(a.generatedAt).getTime()
      const dateB = new Date(b.generatedAt).getTime()
      return dateB - dateA
    })

    return Response.json({ records })
  } catch (error: any) {
    console.error("[admin/billing-records] GET failed:", error)
    return Response.json(
      { error: error?.message || "Failed to load billing records" },
      { status: 500 }
    )
  }
}

