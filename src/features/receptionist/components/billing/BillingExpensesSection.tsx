"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, ConfirmDialog } from "@/shared/components"
import { useAuth } from "@/shared/hooks/useAuth"
import { authedFetchJson } from "@/shared/utils/authedFetch"

export interface BillingExpense {
  id: string
  hospitalId: string
  branchId?: string | null
  branchName?: string | null
  title: string
  category: string
  amount: number
  paymentMethod: "cash" | "upi" | "card" | "bank_transfer"
  expenseDate: string
  notes?: string
  createdBy?: { uid: string; name: string; role: string } | null
  createdAt: string
  updatedAt?: string
}

const EXPENSE_CATEGORIES = [
  "Tea",
  "Coffee",
  "Parking",
  "Courier",
  "Petrol",
  "Cleaning",
  "Office Supplies",
  "Emergency Purchase",
  "Miscellaneous",
] as const

const PAYMENT_METHOD_LABELS: Record<BillingExpense["paymentMethod"], string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
}

const formatCurrency = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return "—"
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

interface ExpenseFormState {
  title: string
  category: string
  amount: string
  paymentMethod: BillingExpense["paymentMethod"]
  expenseDate: string
  notes: string
}

const buildEmptyForm = (): ExpenseFormState => ({
  title: "",
  category: "Miscellaneous",
  amount: "",
  paymentMethod: "cash",
  expenseDate: new Date().toISOString().split("T")[0],
  notes: "",
})

interface BillingExpensesSectionProps {
  onNotification?: (payload: { type: "success" | "error"; message: string } | null) => void
  /** Increment this counter to open the Add Expense modal from outside (e.g. quick action button). */
  openAddSignal?: number
}

export default function BillingExpensesSection({ onNotification, openAddSignal }: BillingExpensesSectionProps) {
  const { user } = useAuth()
  const isAdmin = Boolean(user && (user.role === "admin" || user.role === "super_admin"))

  const [expenses, setExpenses] = useState<BillingExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<BillingExpense | null>(null)
  const [form, setForm] = useState<ExpenseFormState>(buildEmptyForm)

  const [viewExpense, setViewExpense] = useState<BillingExpense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillingExpense | null>(null)

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const data = await authedFetchJson<{ expenses?: BillingExpense[] }>(
        "/api/receptionist/expenses",
        {},
        "Failed to load expenses"
      )
      setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
    } catch (error) {
      onNotification?.({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load expenses",
      })
    } finally {
      setLoading(false)
    }
  }, [onNotification])

  useEffect(() => {
    void loadExpenses()
  }, [loadExpenses])

  const openAdd = useCallback(() => {
    setEditingExpense(null)
    setForm(buildEmptyForm())
    setFormError(null)
    setFormOpen(true)
  }, [])

  useEffect(() => {
    if (openAddSignal && openAddSignal > 0) {
      openAdd()
    }
  }, [openAddSignal, openAdd])

  const openEdit = (expense: BillingExpense) => {
    setEditingExpense(expense)
    setForm({
      title: expense.title || "",
      category: expense.category || "Miscellaneous",
      amount: String(expense.amount ?? ""),
      paymentMethod: expense.paymentMethod || "cash",
      expenseDate: expense.expenseDate || new Date().toISOString().split("T")[0],
      notes: expense.notes || "",
    })
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setEditingExpense(null)
    setFormError(null)
  }

  const handleSubmit = async () => {
    const title = form.title.trim()
    if (!title) {
      setFormError("Expense title is required")
      return
    }
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Amount must be a positive number")
      return
    }
    if (!form.expenseDate) {
      setFormError("Expense date is required")
      return
    }

    const payload = {
      title,
      category: form.category,
      amount,
      paymentMethod: form.paymentMethod,
      expenseDate: form.expenseDate,
      notes: form.notes.trim(),
    }

    try {
      setSaving(true)
      setFormError(null)
      if (editingExpense) {
        await authedFetchJson(
          `/api/receptionist/expenses/${editingExpense.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
          "Failed to update expense"
        )
        onNotification?.({ type: "success", message: "Expense updated successfully" })
      } else {
        await authedFetchJson(
          "/api/receptionist/expenses",
          { method: "POST", body: JSON.stringify(payload) },
          "Failed to record expense"
        )
        onNotification?.({ type: "success", message: "Expense recorded successfully" })
      }
      setFormOpen(false)
      setEditingExpense(null)
      await loadExpenses()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save expense")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await authedFetchJson(
        `/api/receptionist/expenses/${deleteTarget.id}`,
        { method: "DELETE" },
        "Failed to delete expense"
      )
      onNotification?.({ type: "success", message: "Expense deleted" })
      setDeleteTarget(null)
      await loadExpenses()
    } catch (error) {
      onNotification?.({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete expense",
      })
    } finally {
      setDeleting(false)
    }
  }

  const analytics = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    const monthPrefix = todayStr.slice(0, 7)
    let today = 0
    let month = 0
    let total = 0
    const byCategory = new Map<string, number>()
    for (const expense of expenses) {
      const amount = Number(expense.amount || 0)
      total += amount
      if (expense.expenseDate === todayStr) today += amount
      if ((expense.expenseDate || "").startsWith(monthPrefix)) month += amount
      const category = expense.category || "Miscellaneous"
      byCategory.set(category, (byCategory.get(category) || 0) + amount)
    }
    const categories = Array.from(byCategory.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
    return { today, month, total, categories }
  }, [expenses])

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Operational Expenses</h3>
          <p className="mt-0.5 text-xs text-slate-500">Small day-to-day expenses recorded at the front desk</p>
        </div>
        <Button type="button" size="sm" onClick={openAdd}>
          + Add Expense
        </Button>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
        {[
          { label: "Today's Expenses", value: formatCurrency(analytics.today), accent: "text-amber-700" },
          { label: "This Month", value: formatCurrency(analytics.month), accent: "text-indigo-700" },
          { label: "Total Expenses", value: formatCurrency(analytics.total), accent: "text-slate-900" },
        ].map((card) => (
          <div key={card.label} className="bg-white px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${card.accent}`}>{card.value}</p>
          </div>
        ))}
        <div className="bg-white px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expenses by Category</p>
          {analytics.categories.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">No expenses yet</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {analytics.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat.name}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                >
                  {cat.name}
                  <span className="tabular-nums text-slate-900">{formatCurrency(cat.amount)}</span>
                </span>
              ))}
              {analytics.categories.length > 3 && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  +{analytics.categories.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expense history table */}
      <div className="overflow-x-auto border-t border-slate-100">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600" />
            Loading expenses…
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-600">No expenses recorded yet</p>
            <p className="mt-1 text-xs text-slate-400">Use “+ Add Expense” to record tea, parking, courier and other small expenses.</p>
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-2.5">Date</th>
                <th className="px-4 py-2.5">Expense Title</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5">Payment Method</th>
                <th className="px-4 py-2.5">Created By</th>
                <th className="px-4 py-2.5">Notes</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="whitespace-nowrap px-5 py-3 text-xs font-medium text-slate-600">
                    {formatDisplayDate(expense.expenseDate)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{expense.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {expense.category || "Miscellaneous"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {PAYMENT_METHOD_LABELS[expense.paymentMethod] || expense.paymentMethod}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {expense.createdBy?.name || "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-500" title={expense.notes || ""}>
                    {expense.notes || "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setViewExpense(expense)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(expense)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 transition-colors"
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Expense modal */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5 sm:px-6 sm:py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExpense ? "Edit Expense" : "Add Expense"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingExpense ? "Update this operational expense" : "Record a small operational expense"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              <div className="rx-form-field">
                <label className="rx-form-label">
                  Expense Title <span className="rx-required">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="rx-form-input"
                  placeholder="e.g. Tea for staff"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rx-form-field">
                  <label className="rx-form-label">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="rx-form-select"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="rx-form-field">
                  <label className="rx-form-label">
                    Amount (₹) <span className="rx-required">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step="any"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="rx-form-input"
                    placeholder="e.g. 150"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rx-form-field">
                  <label className="rx-form-label">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paymentMethod: e.target.value as BillingExpense["paymentMethod"] }))
                    }
                    className="rx-form-select"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="rx-form-field">
                  <label className="rx-form-label">Expense Date</label>
                  <input
                    type="date"
                    value={form.expenseDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                    className="rx-form-input"
                  />
                </div>
              </div>

              <div className="rx-form-field">
                <label className="rx-form-label">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="rx-form-textarea"
                  rows={2}
                  placeholder="Optional notes about this expense"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Created by, hospital and branch are recorded automatically.
              </p>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:px-6 sm:py-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleSubmit} loading={saving} loadingText="Saving…">
                {editingExpense ? "Save Changes" : "Add Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Expense modal */}
      {viewExpense && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5 sm:px-6 sm:py-4">
              <h3 className="text-base font-bold text-slate-900">Expense Details</h3>
              <button
                type="button"
                onClick={() => setViewExpense(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Amount</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{formatCurrency(viewExpense.amount)}</p>
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Title", viewExpense.title],
                  ["Category", viewExpense.category || "Miscellaneous"],
                  ["Payment Method", PAYMENT_METHOD_LABELS[viewExpense.paymentMethod] || viewExpense.paymentMethod],
                  ["Expense Date", formatDisplayDate(viewExpense.expenseDate)],
                  ["Created By", viewExpense.createdBy?.name || "—"],
                  ["Branch", viewExpense.branchName || "—"],
                  ["Notes", viewExpense.notes || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="text-right font-medium text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex shrink-0 items-center justify-end border-t border-slate-100 px-5 py-3.5 sm:px-6">
              <Button type="button" variant="outline" onClick={() => setViewExpense(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation (admin only) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Expense"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.title}" (${formatCurrency(deleteTarget.amount)})? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null) }}
      />
    </div>
  )
}
