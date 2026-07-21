import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/shared/utils/firebase/serverHospitalQueries"
import {
  getAppointmentsCollectionPath,
  isAppointmentVisibleToReceptionist,
  logAppointmentQuery,
} from "@/shared/utils/appointments/appointmentSource"

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
  paymentTerms?: "standard" | "pay_later_after_discharge"
  packageSummary?: {
    packageId: string
    packageName: string
    fixedRate: number
    paymentTiming: "advance" | "after_operation"
    advancePaidAmount: number
    dueAmount: number
  } | null
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
    const initResult = initFirebaseAdmin("receptionist billing-records API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode")
    const admissionOnlyMode = mode === "admission_only"
    const enrichPatientDetails = searchParams.get("enrich") !== "0"

    const firestore = admin.firestore()

    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) {
      return Response.json({ error: "Hospital context required" }, { status: 400 })
    }
    
    // Get receptionist's branchId if user is a receptionist
    let receptionistBranchId: string | null = null
    if (auth.user && auth.user.role === "receptionist") {
      try {
        const receptionistDoc = await firestore.collection("receptionists").doc(auth.user.uid).get()
        if (receptionistDoc.exists) {
          const receptionistData = receptionistDoc.data()
          receptionistBranchId = receptionistData?.branchId || null
        }
      } catch {
      }
    }

    const records: UnifiedBillingRecord[] = []
    const billedAppointmentIds = new Set<string>()

    // Fetch billing records — hospital-scoped (never global)
    let billingDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
    try {
      const billingSnapshot = await firestore
        .collection("billing_records")
        .where("hospitalId", "==", hospitalId)
        .orderBy("generatedAt", "desc")
        .limit(100)
        .get()
      billingDocs = billingSnapshot.docs
    } catch {
      const snap = await firestore
        .collection("billing_records")
        .orderBy("generatedAt", "desc")
        .limit(300)
        .get()
      billingDocs = snap.docs
        .filter((d) => String(d.data()?.hospitalId || "") === hospitalId)
        .slice(0, 100)
    }

    for (const docSnap of billingDocs) {
      const data = docSnap.data() || {}
      
      // Filter by branch for receptionists
      if (receptionistBranchId) {
        // Check if billing record has branchId directly
        if (data.branchId && data.branchId !== receptionistBranchId) {
          continue // Skip this billing record - not for receptionist's branch
        }
        
        // If no direct branchId, check via appointmentId within this hospital only
        if (!data.branchId && data.appointmentId) {
          try {
            let appointmentData: any = null
            const aptDoc = await firestore
              .collection(getHospitalCollectionPath(hospitalId, "appointments"))
              .doc(String(data.appointmentId))
              .get()
            if (aptDoc.exists) {
              appointmentData = aptDoc.data()
            } else {
              const rootApt = await firestore.collection("appointments").doc(String(data.appointmentId)).get()
              if (rootApt.exists) {
                const rootData = rootApt.data() || {}
                if (String(rootData.hospitalId || "") === hospitalId) {
                  appointmentData = rootData
                }
              }
            }
            
            // If appointment found, check its branchId
            if (appointmentData && appointmentData.branchId && appointmentData.branchId !== receptionistBranchId) {
              continue // Skip - appointment is for different branch
            }
            
            // If no branchId found in appointment, skip for safety (can't determine branch)
            if (appointmentData && !appointmentData.branchId) {
              continue
            }
          } catch {
            // Skip if we can't verify branch
            continue
          }
        }
        
        // If no appointmentId and no branchId, skip only non-admission records.
        const isAdmissionRecord = Boolean(data.admissionId)
        if (!data.branchId && !data.appointmentId && !isAdmissionRecord) {
          continue
        }
      }
      
      let patientName = data.patientName || null
      let patientUid = data.patientUid || null
      const patientId = data.patientId || null

      // Enrich patient name if needed
      const needsEnrichment =
        !patientName ||
        (typeof patientName === "string" && patientName.trim().toLowerCase() === "unknown")

      if (enrichPatientDetails && needsEnrichment) {
        try {
          if (patientUid) {
            const patientDoc = await firestore
              .collection(getHospitalCollectionPath(hospitalId, "patients"))
              .doc(String(patientUid))
              .get()
            if (patientDoc.exists) {
              const patient = patientDoc.data() as any
              const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
              patientName = composed || patient?.fullName || patientName
            }
          } else if (patientId) {
            const querySnap = await firestore
              .collection(getHospitalCollectionPath(hospitalId, "patients"))
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
        paymentTerms:
          data.paymentTerms === "pay_later_after_discharge"
            ? "pay_later_after_discharge"
            : "standard",
        packageSummary: data.packageSummary || null,
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

      // Track any explicit appointment billing tied to an appointmentId
      if (data.appointmentId) {
        billedAppointmentIds.add(String(data.appointmentId))
      }
    }

    if (admissionOnlyMode) {
      records.sort((a, b) => {
        const dateA = new Date(a.generatedAt).getTime()
        const dateB = new Date(b.generatedAt).getTime()
        return dateB - dateA
      })
      return Response.json({ records })
    }

    // Fetch appointments with payments from the SAME hospital-scoped collection
    // that Doctor / Reception / Admin write to: hospitals/{hospitalId}/appointments
    const appointmentsDocs: any[] = []
    const seenAppointmentIds = new Set<string>()

    if (hospitalId) {
      try {
        const hospPath = getAppointmentsCollectionPath(hospitalId)
        const hospSnap = await firestore
          .collection(hospPath)
          .orderBy("createdAt", "desc")
          .limit(150)
          .get()

        const visible = hospSnap.docs.filter((doc) => {
          const data = doc.data() || {}
          return isAppointmentVisibleToReceptionist(data, receptionistBranchId)
        })

        logAppointmentQuery({
          module: "receptionist/billing-records",
          collection: hospPath,
          filters: { receptionistBranchId, hospitalId },
          count: visible.length,
          empty: visible.length === 0,
        })

        for (const doc of visible) {
          if (seenAppointmentIds.has(doc.id)) continue
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[appointments] hospital-scoped billing query failed, trying fallback", err)
        }
      }
    }

    // Legacy fallback: root `appointments` (pre-migration data only)
    if (appointmentsDocs.length === 0) {
      try {
        const paidSnapshot = await firestore
          .collection("appointments")
          .where("paidAt", ">", "")
          .orderBy("paidAt", "desc")
          .limit(50)
          .get()

        for (const doc of paidSnapshot.docs) {
          const data = doc.data() || {}
          if (!isAppointmentVisibleToReceptionist(data, receptionistBranchId)) continue
          if (seenAppointmentIds.has(doc.id)) continue
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }

        logAppointmentQuery({
          module: "receptionist/billing-records:legacy-root",
          collection: "appointments",
          filters: { receptionistBranchId },
          count: appointmentsDocs.length,
          empty: appointmentsDocs.length === 0,
        })
      } catch {
        // ignore legacy fallback errors
      }
    }

    for (const docSnap of appointmentsDocs) {
      const data = docSnap.data() || {}

      if (!isAppointmentVisibleToReceptionist(data, receptionistBranchId)) {
        continue
      }

      // Unconfirmed WhatsApp bookings are not appointments yet — no invoice exists
      // until the front desk confirms them in the WhatsApp Bookings panel.
      if (data.status === "whatsapp_pending" || data.whatsappPending === true) {
        continue
      }

      const paymentAmount = Number(data.paymentAmount || 0)
      const totalConsultationFee = Number(data.totalConsultationFee || 0)
      const remainingAmount = Number(data.remainingAmount || 0)
      if (paymentAmount <= 0 && totalConsultationFee <= 0 && remainingAmount <= 0) {
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
      if (
        enrichPatientDetails &&
        (!patientName || (typeof patientName === "string" && patientName.trim().toLowerCase() === "unknown"))
      ) {
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

      const paymentStatus = String(data.paymentStatus || "").toLowerCase()
      const hasPaidAt = Boolean(data.paidAt) && String(data.paidAt).trim() !== ""
      // Refunded money is neither revenue nor outstanding. keep_payment
      // cancellations stay paid (appointment status cancelled, payment retained).
      const isRefunded = paymentStatus === "refunded"
      const isPaid = !isRefunded && (paymentStatus === "paid" || hasPaidAt)
      const isCancelled =
        isRefunded ||
        (!isPaid &&
          (data.status === "cancelled" || data.status === "doctor_cancelled"))
      const consultationFee = totalConsultationFee || paymentAmount
      const isPaidRecord = !isCancelled && isPaid
      const collectedAmount =
        paymentAmount > 0 ? paymentAmount : isPaidRecord ? consultationFee : paymentAmount || consultationFee

      records.push({
        id: docSnap.id,
        type: "appointment",
        appointmentId: docSnap.id,
        patientId: String(patientId || ""),
        patientUid,
        patientName,
        doctorId: String(data.doctorId || ""),
        doctorName: data.doctorName || null,
        consultationFee,
        // Prefer collected amount; fall back to fee so paid WhatsApp confirms still hit revenue cards
        totalAmount: collectedAmount,
        // Collection analytics attribute by paidAt — prefer it when paid (parity with admin billing)
        generatedAt: isPaidRecord
          ? data.paidAt || data.createdAt || new Date().toISOString()
          : data.createdAt || data.paidAt || new Date().toISOString(),
        status: isCancelled ? "cancelled" : isPaid ? "paid" : "pending",
        paymentMethod: data.paymentMethod,
        paidAt: isPaid ? data.paidAt || null : null,
        paymentReference: data.transactionId || null,
        transactionId: data.transactionId || null,
        paidAtFrontDesk:
          data.paidAtFrontDesk === true ||
          data.createdBy === "receptionist" ||
          data.handledBy === "receptionist",
        handledBy: data.handledBy || data.createdBy || null,
        settlementMode: data.settlementMode || data.paymentMethod || null,
        paymentType: data.paymentType || "full",
        remainingAmount: Number(data.remainingAmount || 0) || undefined,
        hospitalId: data.hospitalId || hospitalId || null,
        branchId: data.branchId || null,
      })
    }

    records.sort((a, b) => {
      const dateA = new Date(a.generatedAt).getTime()
      const dateB = new Date(b.generatedAt).getTime()
      return dateB - dateA
    })

    if (process.env.NODE_ENV === "development" && records.length === 0) {
      console.info(
        "[appointments] receptionist/billing-records empty state — no billing or appointment payment records for this hospital/branch"
      )
    }

    return Response.json({ records })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to load billing records" },
      { status: 500 }
    )
  }
}
