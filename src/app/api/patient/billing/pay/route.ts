import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function POST(req: Request) {
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

  try {
    const initResult = initFirebaseAdmin("patient-billing-pay API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { billingId, paymentMethod, actor, type } = await req.json().catch(() => ({}))
    const method: "card" | "upi" | "cash" | "wallet" | "demo" = paymentMethod || "card"
    const actorType: "patient" | "receptionist" | "admin" = actor || (isPatient ? "patient" : "receptionist")
    const billingType: "admission" | "appointment" | undefined = type

    if (!billingId || typeof billingId !== "string") {
      return Response.json({ error: "Missing billingId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const nowIso = new Date().toISOString()
    const paymentReference = `BILL-${Date.now()}`
    const transactionId = `TXN-${Date.now()}`

    let walletBalanceAfter: number | null = null

    await firestore.runTransaction(async (tx) => {
      // First, try to find in billing_records (admission billing)
      const billingRef = firestore.collection("billing_records").doc(billingId)
      const billingSnap = await tx.get(billingRef)
      
      let isAdmissionBilling = false
      let billingData: any = null
      
      if (billingSnap.exists) {
        isAdmissionBilling = true
        billingData = billingSnap.data() || {}
      } else {
        // If not found in billing_records, check appointments (appointment billing)
        const appointmentRef = firestore.collection("appointments").doc(billingId)
        const appointmentSnap = await tx.get(appointmentRef)
        
        if (!appointmentSnap.exists) {
          throw new Error("Billing record not found")
        }
        
        isAdmissionBilling = false
        billingData = appointmentSnap.data() || {}
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
      const totalAmount = isAdmissionBilling
        ? Number(billingData.totalAmount || 0)
        : Number(billingData.paymentAmount || billingData.totalConsultationFee || 0)

      const patientUid = billingData.patientUid ? String(billingData.patientUid) : null
      const patientId = billingData.patientId ? String(billingData.patientId) : null

      if (method === "wallet") {
        if (!patientUid) {
          throw new Error("Patient account not linked for wallet payment")
        }
        const patientRef = firestore.collection("patients").doc(patientUid)
        const patientSnap = await tx.get(patientRef)
        if (!patientSnap.exists) {
          throw new Error("Patient not found for wallet payment")
        }
        const patientData = patientSnap.data() || {}
        const currentBalance = Number(patientData.walletBalance || 0)
        if (currentBalance < totalAmount) {
          throw new Error("Insufficient wallet balance")
        }
        walletBalanceAfter = currentBalance - totalAmount

        tx.update(patientRef, {
          walletBalance: walletBalanceAfter
        })

        const walletTxnRef = firestore.collection("wallet_transactions").doc()
        tx.set(walletTxnRef, {
          id: walletTxnRef.id,
          patientUid,
          patientId,
          type: "debit",
          amount: totalAmount,
          method: "hospital_bill",
          billingId,
          createdAt: nowIso,
          balanceAfter: walletBalanceAfter
        })
      }

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
        // Appointment billing - update appointments
        const appointmentRef = firestore.collection("appointments").doc(billingId)
        tx.update(appointmentRef, {
          paymentStatus: "paid",
          paymentMethod: method,
          paidAt: nowIso,
          transactionId: transactionId,
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
      walletBalance: walletBalanceAfter
    })
  } catch (error: any) {
    console.error("billing pay error", error)
    return Response.json(
      { error: error?.message || "Failed to pay bill" },
      { status: 500 }
    )
  }
}


