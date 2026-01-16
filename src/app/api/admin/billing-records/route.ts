import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

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
  paymentMethod?: "card" | "upi" | "cash" | "demo"
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

    // Fetch billing records from admissions
    const billingSnapshot = await firestore
      .collection("billing_records")
      .orderBy("generatedAt", "desc")
      .limit(100)
      .get()

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

    // Fetch appointments with payments
    // Use a simpler query that doesn't require composite index
    // Fetch recent appointments and filter/sort in memory
    let appointmentsDocs: any[] = []
    const seenAppointmentIds = new Set<string>()
    try {
      // Optimized: Query appointments that have payments - use Firestore queries instead of client-side filtering
      // First, try to get paid appointments ordered by paidAt
      const paidAppointmentsQuery = firestore
        .collection("appointments")
        .where("paidAt", ">", "")
        .orderBy("paidAt", "desc")
        .limit(100)
      
      const paidSnapshot = await paidAppointmentsQuery.get()
      appointmentsDocs = paidSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      // Also get pending cash appointments (those with consultation fee but not paid)
      const pendingCashQuery = firestore
        .collection("appointments")
        .where("totalConsultationFee", ">", 0)
        .where("paymentStatus", "in", ["pending", "unpaid"])
        .orderBy("totalConsultationFee", "desc")
        .orderBy("createdAt", "desc")
        .limit(50)
      
      try {
        const pendingSnapshot = await pendingCashQuery.get()
        const pendingDocs = pendingSnapshot.docs
          .filter(doc => {
            const data = doc.data()
            return !data.paidAt && (!data.paymentMethod || data.paymentMethod === "cash")
          })
          .map(doc => ({ id: doc.id, ...doc.data() }))
        
        // Merge and deduplicate
        const allDocs = [...appointmentsDocs, ...pendingDocs]
        const uniqueDocs = new Map()
        allDocs.forEach(doc => {
          if (!uniqueDocs.has(doc.id)) {
            uniqueDocs.set(doc.id, doc)
          }
        })
        appointmentsDocs = Array.from(uniqueDocs.values())
          .sort((a: any, b: any) => {
            const aDate = a.paidAt || a.createdAt || ""
            const bDate = b.paidAt || b.createdAt || ""
            return bDate.localeCompare(aDate)
          })
          .slice(0, 100)
      } catch {
        // If composite query fails, just use paid appointments
        appointmentsDocs = appointmentsDocs.slice(0, 100)
      }

      // Track IDs we've already included so we don't duplicate when we add hospital-scoped appointments
      for (const doc of appointmentsDocs) {
        seenAppointmentIds.add(doc.id)
      }
    } catch {
      // Final fallback: fetch without orderBy (reduced limit)
      try {
        const allAppointmentsSnapshot = await firestore
          .collection("appointments")
          .limit(100) // Reduced from 500
          .get()
        appointmentsDocs = allAppointmentsSnapshot.docs
          .filter((doc) => {
            const data = doc.data()
            const paymentAmount = Number(data?.paymentAmount || 0)
            const totalConsultationFee = Number(data?.totalConsultationFee || 0)
            const isPending =
              (data?.paymentStatus && data.paymentStatus !== "paid") ||
              (!data?.paidAt && paymentAmount <= 0)
            const isCashPending =
              isPending && totalConsultationFee > 0 && (data?.paymentMethod === "cash" || !data?.paymentMethod)
            return paymentAmount > 0 || isCashPending
          })
          .sort((a, b) => {
            const aData = a.data()
            const bData = b.data()
            const aDate = aData?.paidAt || aData?.createdAt || ""
            const bDate = bData?.paidAt || bData?.createdAt || ""
            return bDate.localeCompare(aDate)
          })
          .slice(0, 100)
        for (const doc of appointmentsDocs) {
          seenAppointmentIds.add(doc.id)
        }
      } catch {
      }
    }

    // Also include hospital-scoped appointments (hospitals/{id}/appointments)
    try {
      const hospitalsSnap = await firestore.collection("hospitals").where("status", "==", "active").limit(20).get()
      for (const hospDoc of hospitalsSnap.docs) {
        const hospId = hospDoc.id
        const hospAppointmentsSnap = await firestore
          .collection(`hospitals/${hospId}/appointments`)
          .orderBy("createdAt", "desc")
          .limit(50) // Reduced from 200 to 50 for better performance
          .get()

        for (const doc of hospAppointmentsSnap.docs) {
          if (seenAppointmentIds.has(doc.id)) continue
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }
      }
    } catch {
      // Error grouping appointments by branch
    }

    for (const docSnap of appointmentsDocs) {
      const data = docSnap.data() || {}
      const paymentAmount = Number(data.paymentAmount || 0)
      const totalConsultationFee = Number(data.totalConsultationFee || 0)
      if (paymentAmount <= 0 && totalConsultationFee <= 0) {
        continue
      }

      // Skip if there's already an explicit billing record for this appointment
      if (billedAppointmentIds.has(docSnap.id)) {
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

      // Determine status
      let status: "pending" | "paid" | "void" | "cancelled" = "paid"
      if (data.status === "cancelled") {
        status = "cancelled"
      } else if (data.paymentStatus === "pending" || !data.paidAt || paymentAmount <= 0) {
        status = "pending"
      } else if (data.paymentStatus === "paid" || data.paidAt) {
        status = "paid"
      }

      const billedAmount = paymentAmount > 0 ? paymentAmount : totalConsultationFee

      records.push({
        id: docSnap.id,
        type: "appointment",
        appointmentId: docSnap.id,
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
        paidAt: data.paidAt || null,
        paymentReference: data.transactionId || null,
        transactionId: data.transactionId || null,
        hospitalId: data.hospitalId || null,
        branchId: data.branchId || null,
        paidAtFrontDesk: false,
        paymentType: data.paymentType || "full",
        remainingAmount:
          status === "pending"
            ? billedAmount - paymentAmount > 0
              ? billedAmount - paymentAmount
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
    return Response.json(
      { error: error?.message || "Failed to load billing records" },
      { status: 500 }
    )
  }
}

