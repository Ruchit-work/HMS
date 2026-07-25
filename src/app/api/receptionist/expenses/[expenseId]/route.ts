import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { getUserActiveHospitalId } from "@/shared/utils/firebase/serverHospitalQueries"

interface Params {
  expenseId: string
}

const EXPENSE_PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer"] as const

function parseExpenseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return trimmed
}

/** Admins and receptionists can edit an expense; the expense must belong to the caller's hospital. */
export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success || !auth.user) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user.role !== "admin" && auth.user.role !== "receptionist") {
    return Response.json({ error: "Access denied. Only admins and receptionists can edit expenses." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("billing-expenses API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { expenseId } = await context.params
    if (!expenseId) {
      return Response.json({ error: "Missing expenseId" }, { status: 400 })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) {
      return Response.json({ error: "Hospital context required" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const expenseRef = firestore.collection("expenses").doc(expenseId)
    const expenseSnap = await expenseRef.get()
    if (!expenseSnap.exists) {
      return Response.json({ error: "Expense not found" }, { status: 404 })
    }
    if (String(expenseSnap.data()?.hospitalId || "") !== hospitalId) {
      return Response.json({ error: "Expense does not belong to your hospital" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : ""
      if (!title) {
        return Response.json({ error: "Expense title is required" }, { status: 400 })
      }
      updates.title = title
    }
    if (body?.amount !== undefined) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return Response.json({ error: "Amount must be a positive number" }, { status: 400 })
      }
      updates.amount = Math.round(amount * 100) / 100
    }
    if (body?.category !== undefined) {
      updates.category =
        typeof body.category === "string" && body.category.trim() ? body.category.trim() : "Miscellaneous"
    }
    if (body?.paymentMethod !== undefined) {
      if (!EXPENSE_PAYMENT_METHODS.includes(body.paymentMethod)) {
        return Response.json({ error: "Invalid payment method" }, { status: 400 })
      }
      updates.paymentMethod = body.paymentMethod
    }
    if (body?.expenseDate !== undefined) {
      const expenseDate = parseExpenseDate(body.expenseDate)
      if (!expenseDate) {
        return Response.json({ error: "Invalid expense date" }, { status: 400 })
      }
      updates.expenseDate = expenseDate
    }
    if (body?.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes.trim() : ""
    }

    await expenseRef.update(updates)
    const updatedSnap = await expenseRef.get()

    return Response.json({ success: true, expense: { id: expenseId, ...(updatedSnap.data() || {}) } })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to update expense" }, { status: 500 })
  }
}

/** Deleting an expense is admin-only. */
export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req, "admin")
  if (!auth.success || !auth.user) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("billing-expenses API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { expenseId } = await context.params
    if (!expenseId) {
      return Response.json({ error: "Missing expenseId" }, { status: 400 })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) {
      return Response.json({ error: "Hospital context required" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const expenseRef = firestore.collection("expenses").doc(expenseId)
    const expenseSnap = await expenseRef.get()
    if (!expenseSnap.exists) {
      return Response.json({ error: "Expense not found" }, { status: 404 })
    }
    if (String(expenseSnap.data()?.hospitalId || "") !== hospitalId) {
      return Response.json({ error: "Expense does not belong to your hospital" }, { status: 403 })
    }

    await expenseRef.delete()

    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to delete expense" }, { status: 500 })
  }
}
