import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { applyRateLimit } from "@/utils/shared/rateLimit"
import { getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { logApiError, createErrorResponse } from "@/utils/errors/errorLogger"

export async function POST(req: Request) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(req, "PAYMENT")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires patient, receptionist, or admin role
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  const isPatient = auth.user?.role === "patient"
  const isStaff = auth.user?.role === "receptionist" || auth.user?.role === "admin"
  if (!isPatient && !isStaff) {
    return Response.json(
      { error: "Access denied. This endpoint requires patient, receptionist, or admin role." },
      { status: 403 }
    )
  }

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(req, "PAYMENT", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
  }

  // Declare variables outside try block for catch block access
  let billingId: string | undefined
  let method: "card" | "upi" | "cash" = "card"
  let totalAmount = 0
  let body: any = {}
  let requestedType: "admission" | "appointment" | undefined

  try {
    const initResult = initFirebaseAdmin("patient-billing-pay API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    body = await req.json().catch(() => ({}))
    billingId = typeof body?.billingId === "string" ? body.billingId.trim() : body?.billingId
    requestedType = body?.type === "admission" || body?.type === "appointment" ? body.type : undefined
    const paymentMethod = typeof body?.paymentMethod === "string" ? body.paymentMethod.trim().toLowerCase() : "card"
    if (paymentMethod === "card" || paymentMethod === "upi" || paymentMethod === "cash") {
      method = paymentMethod
    }
    const actor = body?.actor
    const actorType: "patient" | "receptionist" | "admin" =
      actor === "patient" || actor === "receptionist" || actor === "admin"
        ? actor
        : (isPatient ? "patient" : "receptionist")

    if (!billingId || typeof billingId !== "string") {
      return Response.json({ error: "Missing billingId" }, { status: 400 })
    }
    if (billingId.length > 128) {
      return Response.json({ error: "Invalid billingId" }, { status: 400 })
    }

    const requestedHospitalId =
      typeof body?.hospitalId === "string" && body.hospitalId.trim().length > 0
        ? body.hospitalId.trim()
        : null
    const authHospitalId =
      typeof auth.user?.data?.hospitalId === "string" && auth.user.data.hospitalId.trim().length > 0
        ? auth.user.data.hospitalId.trim()
        : typeof auth.user?.data?.activeHospital === "string" && auth.user.data.activeHospital.trim().length > 0
          ? auth.user.data.activeHospital.trim()
          : Array.isArray(auth.user?.data?.hospitals) && typeof auth.user?.data?.hospitals?.[0] === "string"
            ? auth.user.data.hospitals[0].trim()
            : null

    const firestore = admin.firestore()
    const nowIso = new Date().toISOString()
    const paymentReference = `BILL-${Date.now()}`
    const transactionId = `TXN-${Date.now()}`

    await firestore.runTransaction(async (tx) => {
      // First, try to find in billing_records (admission billing)
      const billingRef = firestore.collection("billing_records").doc(billingId!)
      const billingSnap = await tx.get(billingRef)
      
      let isAdmissionBilling = false
      let billingData: any = null
      let appointmentRef: FirebaseFirestore.DocumentReference | null = null
      
      if (billingSnap.exists) {
        isAdmissionBilling = true
        billingData = billingSnap.data() || {}
      } else {
        if (requestedType === "admission") {
          throw new Error("Admission billing record not found")
        }
        // If not found in billing_records, check appointments (appointment billing)
        // Prefer hospital-scoped appointments when hospital context is available.
        const candidateHospitalIds = [requestedHospitalId, authHospitalId].filter(
          (value, idx, arr): value is string => Boolean(value) && arr.indexOf(value) === idx
        )

        for (const hospitalId of candidateHospitalIds) {
          const hospAppointmentRef = firestore
            .collection(getHospitalCollectionPath(hospitalId, "appointments"))
            .doc(billingId!)
          const hospAppointmentSnap = await tx.get(hospAppointmentRef)

          if (hospAppointmentSnap.exists) {
            isAdmissionBilling = false
            billingData = hospAppointmentSnap.data() || {}
            appointmentRef = hospAppointmentRef
            break
          }
        }
        
        // Fallback to legacy global appointments collection
        if (!appointmentRef) {
          const globalAppointmentRef = firestore.collection("appointments").doc(billingId!)
          const globalAppointmentSnap = await tx.get(globalAppointmentRef)
          
          if (!globalAppointmentSnap.exists) {
            throw new Error("Billing record not found")
          }
          
          isAdmissionBilling = false
          billingData = globalAppointmentSnap.data() || {}
          appointmentRef = globalAppointmentRef
        }
      }

      // Check if already paid
      if (isAdmissionBilling) {
        if (billingData.status === "paid") {
          throw new Error("Billing record already paid")
        }
      } else {
        if (billingData.paymentStatus === "paid" || billingData.paidAt) {
          throw new Error("Appointment already paid")
        }
      }

      // If patient, verify they can only pay their own bills
      if (isPatient) {
        const patientUid = billingData.patientUid ? String(billingData.patientUid) : null
        if (!patientUid || patientUid !== auth.user?.uid) {
          throw new Error("You can only pay your own bills")
        }
      }

      // Get amount based on billing type
      totalAmount = isAdmissionBilling
        ? Number(billingData.totalAmount || 0)
        : Number(billingData.paymentAmount || billingData.totalConsultationFee || 0)

      const paymentMetadata =
        actorType === "receptionist"
          ? {
              paidAtFrontDesk: true,
              handledBy: "receptionist",
              settlementMode: "walk_in"
            }
          : {
              paidAtFrontDesk: false
            }

      // Update based on billing type
      if (isAdmissionBilling) {
        // Admission billing - update billing_records
        tx.update(billingRef, {
          status: "paid",
          paymentMethod: method,
          paidAt: nowIso,
          paymentReference,
          updatedAt: nowIso,
          ...paymentMetadata
        })
      } else {
        // Appointment billing - update appointments (hospital-scoped or legacy)
        if (!appointmentRef) {
          throw new Error("Billing record not found")
        }
        tx.update(appointmentRef, {
          paymentStatus: "paid",
          paymentMethod: method,
          paidAt: nowIso,
          transactionId: transactionId,
          paymentAmount: totalAmount, // Update paymentAmount to reflect the actual amount paid
          remainingAmount: 0,
          status: "confirmed",
          updatedAt: nowIso,
        })
      }
    })


    return Response.json({
      success: true,
      paymentMethod: method,
      paidAt: nowIso,
      paymentReference,
      transactionId,
    })
  } catch (error: any) {
    if (error?.message === "Billing record already paid" || error?.message === "Appointment already paid") {
      return Response.json({ error: error.message }, { status: 409 })
    }
    if (error?.message === "Admission billing record not found") {
      return Response.json({ error: error.message }, { status: 404 })
    }

    // Extract hospitalId from billing data if available
    const hospitalId = (error as { hospitalId?: string }).hospitalId || body?.hospitalId
    
    // Log error with context (avoid logging sensitive payment details, don't await to avoid blocking response)
    logApiError(error, req, auth, {
      action: "billing-pay",
      hospitalId: hospitalId,
      appointmentId: (error as { appointmentId?: string }).appointmentId,
      patientId: auth?.user?.uid,
    }).catch((err) => {
      console.error('[Error Logger] Failed to log error:', err)
    })
    
    return await createErrorResponse(error, req, auth, {
      action: "billing-pay",
      hospitalId: hospitalId,
    }, "Failed to process payment. Please try again.")
  }
}


