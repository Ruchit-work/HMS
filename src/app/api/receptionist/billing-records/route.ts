import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId } from "@/utils/firebase/serverHospitalQueries"
import {
  getAppointmentsCollectionPath,
  isAppointmentVisibleToReceptionist,
  logAppointmentQuery,
} from "@/utils/appointments/appointmentSource"

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

    // Fetch billing records from admissions
    const billingSnapshot = await firestore
      .collection("billing_records")
      .orderBy("generatedAt", "desc")
      .limit(100)
      .get()

    for (const docSnap of billingSnapshot.docs) {
      const data = docSnap.data() || {}
      
      // Filter by branch for receptionists
      if (receptionistBranchId) {
        // Check if billing record has branchId directly
        if (data.branchId && data.branchId !== receptionistBranchId) {
          continue // Skip this billing record - not for receptionist's branch
        }
        
        // If no direct branchId, check via appointmentId
        if (!data.branchId && data.appointmentId) {
          try {
            // Try to get appointment from hospital-scoped collections first
            let appointmentData: any = null
            const hospitalsSnap = await firestore.collection("hospitals").where("status", "==", "active").limit(10).get()
            for (const hospDoc of hospitalsSnap.docs) {
              const hospId = hospDoc.id
              const aptDoc = await firestore.collection(`hospitals/${hospId}/appointments`).doc(String(data.appointmentId)).get()
              if (aptDoc.exists) {
                appointmentData = aptDoc.data()
                break
              }
            }
            
            // Fallback to root appointments collection
            if (!appointmentData) {
              const aptDoc = await firestore.collection("appointments").doc(String(data.appointmentId)).get()
              if (aptDoc.exists) {
                appointmentData = aptDoc.data()
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

    const hospitalId =
      (auth.user?.uid ? await getUserActiveHospitalId(auth.user.uid) : null) || null

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

      const isPaid = data.paymentStatus === "paid" || Boolean(data.paidAt)
      const consultationFee = totalConsultationFee || paymentAmount

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
        totalAmount: paymentAmount || consultationFee,
        generatedAt: data.createdAt || data.paidAt || new Date().toISOString(),
        status: isPaid ? "paid" : "pending",
        paymentMethod: data.paymentMethod,
        paidAt: data.paidAt || null,
        paymentReference: data.transactionId || null,
        transactionId: data.transactionId || null,
        paidAtFrontDesk: data.createdBy === "receptionist",
        handledBy: data.createdBy || null,
        settlementMode: data.paymentMethod || null,
        paymentType: data.paymentType || "full",
        remainingAmount: Number(data.remainingAmount || 0) || undefined,
        hospitalId: data.hospitalId || hospitalId || null,
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
