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
      } catch (err) {
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
          } catch (err) {
            // Skip if we can't verify branch
            continue
          }
        }
        
        // If no appointmentId and no branchId, skip (can't determine branch)
        if (!data.branchId && !data.appointmentId) {
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

      // Track IDs we've already included so we don't duplicate when we add hospital-scoped appointments
      for (const doc of appointmentsDocs) {
        seenAppointmentIds.add(doc.id)
      }
    } catch {
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
        for (const doc of appointmentsDocs) {
          seenAppointmentIds.add(doc.id)
        }
      } catch (fallbackError: any) {
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
          .limit(200)
          .get()

        for (const doc of hospAppointmentsSnap.docs) {
          if (seenAppointmentIds.has(doc.id)) continue
          
          // Filter by branch for receptionists
          if (receptionistBranchId) {
            const aptData = doc.data()
            if (aptData.branchId && aptData.branchId !== receptionistBranchId) {
              continue // Skip - not for receptionist's branch
            }
            // If no branchId, skip for safety
            if (!aptData.branchId) {
              continue
            }
          }
          
          appointmentsDocs.push(doc)
          seenAppointmentIds.add(doc.id)
        }
      }
    } catch (groupError: any) {
    }

    for (const docSnap of appointmentsDocs) {
      const data = docSnap.data() || {}
      
      // Filter by branch for receptionists (additional check for root collection appointments)
      if (receptionistBranchId) {
        if (data.branchId && data.branchId !== receptionistBranchId) {
          continue // Skip - not for receptionist's branch
        }
        // If no branchId, skip for safety
        if (!data.branchId) {
          continue
        }
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
        hospitalId: data.hospitalId || null,
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


