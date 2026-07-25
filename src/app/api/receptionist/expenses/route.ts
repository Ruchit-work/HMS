import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  getReceptionistDefaultBranch,
} from "@/shared/utils/firebase/serverHospitalQueries"

const EXPENSE_PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer"] as const
type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number]

/**
 * Billing operational expenses (tea, parking, courier, etc.).
 * Collection: `expenses` (root), scoped per hospital via `hospitalId` field.
 * Permissions: admin + receptionist can create/view/edit; delete is admin-only
 * (see [expenseId]/route.ts). Doctors and patients have no access.
 */
function resolveActorName(user: { email: string | null; data?: Record<string, unknown> | null }): string {
  const data = (user.data || {}) as Record<string, unknown>
  const first = typeof data.firstName === "string" ? data.firstName.trim() : ""
  const last = typeof data.lastName === "string" ? data.lastName.trim() : ""
  const combined = `${first} ${last}`.trim()
  if (combined) return combined
  if (typeof data.name === "string" && data.name.trim()) return data.name.trim()
  return user.email || "Staff"
}

function assertBillingExpenseAccess(role: string | undefined): boolean {
  return role === "admin" || role === "receptionist"
}

function parseExpenseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return trimmed
}

export async function GET(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success || !auth.user) {
    return createAuthErrorResponse(auth)
  }
  if (!assertBillingExpenseAccess(auth.user.role)) {
    return Response.json({ error: "Access denied. Only admins and receptionists can view expenses." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("billing-expenses API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) {
      return Response.json({ error: "Hospital context required" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const snap = await firestore
      .collection("expenses")
      .where("hospitalId", "==", hospitalId)
      .limit(1000)
      .get()

    const expenses = snap.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }) as Record<string, unknown> & { id: string })
      // Sort in memory (expenseDate desc, then createdAt desc) to avoid a composite index
      .sort((a, b) => {
        const dateA = String(a.expenseDate || "")
        const dateB = String(b.expenseDate || "")
        if (dateA !== dateB) return dateA < dateB ? 1 : -1
        const createdA = String(a.createdAt || "")
        const createdB = String(b.createdAt || "")
        return createdA < createdB ? 1 : -1
      })

    return Response.json({ success: true, expenses })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to load expenses" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success || !auth.user) {
    return createAuthErrorResponse(auth)
  }
  if (!assertBillingExpenseAccess(auth.user.role)) {
    return Response.json({ error: "Access denied. Only admins and receptionists can record expenses." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("billing-expenses API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) {
      return Response.json({ error: "Hospital context required" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    const title = typeof body?.title === "string" ? body.title.trim() : ""
    if (!title) {
      return Response.json({ error: "Expense title is required" }, { status: 400 })
    }

    const amount = Number(body?.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Amount must be a positive number" }, { status: 400 })
    }

    const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "Miscellaneous"

    const paymentMethod: ExpensePaymentMethod = EXPENSE_PAYMENT_METHODS.includes(body?.paymentMethod)
      ? body.paymentMethod
      : "cash"

    const expenseDate = parseExpenseDate(body?.expenseDate) || new Date().toISOString().split("T")[0]
    const notes = typeof body?.notes === "string" ? body.notes.trim() : ""

    // Branch is resolved automatically: receptionists use their assigned branch
    const { branchId, branchName } = await getReceptionistDefaultBranch(auth.user.uid, auth.user.role)

    const nowIso = new Date().toISOString()
    const expenseData = {
      hospitalId,
      branchId: branchId || null,
      branchName: branchName || null,
      title,
      category,
      amount: Math.round(amount * 100) / 100,
      paymentMethod,
      expenseDate,
      notes,
      createdBy: {
        uid: auth.user.uid,
        name: resolveActorName(auth.user),
        role: auth.user.role || "receptionist",
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    const ref = await admin.firestore().collection("expenses").add(expenseData)

    return Response.json({ success: true, expense: { id: ref.id, ...expenseData } })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to record expense" }, { status: 500 })
  }
}
