import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

export async function POST(req: Request) {
  try {
    const initResult = initFirebaseAdmin("patient-billing-pay API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { billingId, paymentMethod, actor } = await req.json().catch(() => ({}))
    const method: "card" | "upi" | "cash" | "wallet" | "demo" = paymentMethod || "card"
    const actorType: "patient" | "receptionist" | "admin" = actor || "patient"

    if (!billingId || typeof billingId !== "string") {
      return Response.json({ error: "Missing billingId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const billingRef = firestore.collection("billing_records").doc(billingId)
    const nowIso = new Date().toISOString()
    const paymentReference = `BILL-${Date.now()}`

    let walletBalanceAfter: number | null = null

    await firestore.runTransaction(async (tx) => {
      const billingSnap = await tx.get(billingRef)
      if (!billingSnap.exists) {
        throw new Error("Billing record not found")
      }

      const billingData = billingSnap.data() || {}
      if (billingData.status === "paid") {
        throw new Error("Billing record already paid")
      }

      const totalAmount = Number(billingData.totalAmount || 0)
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

      tx.update(billingRef, {
        status: "paid",
        paymentMethod: method,
        paidAt: nowIso,
        paymentReference,
        updatedAt: nowIso,
        ...paymentMetadata
      })
    })

    return Response.json({
      success: true,
      paymentMethod: method,
      paidAt: nowIso,
      paymentReference,
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


