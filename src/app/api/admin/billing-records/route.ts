import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

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
  paymentMethod?: "card" | "upi" | "cash" | "wallet" | "demo"
  paidAt?: string | null
  paymentReference?: string | null
  transactionId?: string | null
  paidAtFrontDesk?: boolean
  handledBy?: string | null
  settlementMode?: string | null
  paymentType?: "full" | "partial"
  remainingAmount?: number
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
        } catch (err) {
          console.warn("Failed to enrich billing record patient name", err)
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
      })
    }

    // Fetch appointments with payments
    // Use a simpler query that doesn't require composite index
    // Fetch recent appointments and filter/sort in memory
    let appointmentsDocs: any[] = []
    try {
      // Fetch appointments ordered by createdAt (most recent first)
      // This doesn't require a composite index
      const appointmentsSnapshot = await firestore
        .collection("appointments")
        .orderBy("createdAt", "desc")
        .limit(500)
        .get()
      
      // Filter for appointments with payments and sort by paidAt
      appointmentsDocs = appointmentsSnapshot.docs
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
          // Sort by paidAt if available, otherwise createdAt
          const aDate = aData?.paidAt || aData?.createdAt || ""
          const bDate = bData?.paidAt || bData?.createdAt || ""
          return bDate.localeCompare(aDate)
        })
        .slice(0, 100)
    } catch (error: any) {
      // Final fallback: fetch without orderBy
      try {
        const allAppointmentsSnapshot = await firestore
          .collection("appointments")
          .limit(500)
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
      } catch (fallbackError: any) {
        console.error("Failed to fetch appointments:", fallbackError?.message)
      }
    }

    for (const docSnap of appointmentsDocs) {
      const data = docSnap.data() || {}
      const paymentAmount = Number(data.paymentAmount || 0)
      const totalConsultationFee = Number(data.totalConsultationFee || 0)
      if (paymentAmount <= 0 && totalConsultationFee <= 0) {
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
        } catch (err) {
          console.warn("Failed to enrich appointment patient name", err)
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
    console.error("admin billing records GET error", error)
    return Response.json(
      { error: error?.message || "Failed to load billing records" },
      { status: 500 }
    )
  }
}

