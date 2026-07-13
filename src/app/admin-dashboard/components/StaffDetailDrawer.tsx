"use client"

import { useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/Button"
import { StatusPill, type StatusVariant } from "@/components/ui/enterprise-table"
import type { StaffRole } from "@/app/admin-dashboard/components/StaffFormModal"

export type StaffProfile = {
  id: string
  role: StaffRole
  firstName: string
  lastName: string
  email: string
  phone?: string
  employeeId?: string
  department?: string
  branchId?: string
  branchName?: string
  shift?: string
  status?: "active" | "inactive" | "on_leave"
  joiningDate?: string
  createdAt?: unknown
  canManageAppointments?: boolean
  canAccessBilling?: boolean
  canViewReports?: boolean
  emergencyName?: string
  emergencyPhone?: string
  emergencyRelation?: string
}

function statusMeta(status?: StaffProfile["status"]): { label: string; variant: StatusVariant } {
  if (status === "inactive") return { label: "Inactive", variant: "neutral" }
  if (status === "on_leave") return { label: "On Leave", variant: "warning" }
  return { label: "Active", variant: "success" }
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-50 py-2 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="max-w-[60%] text-right text-sm text-slate-800">{value ?? "—"}</span>
    </div>
  )
}

export default function StaffDetailDrawer({
  open,
  staff,
  onClose,
  onEdit,
  onAssignDepartment,
  onChangeShift,
  onResetPassword,
  onToggleActive,
  onDelete,
}: {
  open: boolean
  staff: StaffProfile | null
  onClose: () => void
  onEdit: () => void
  onAssignDepartment: () => void
  onChangeShift: () => void
  onResetPassword: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !staff) return null

  const name = [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Staff"
  const status = statusMeta(staff.status)
  const empId = staff.employeeId || `EMP-${staff.id.slice(0, 6).toUpperCase()}`

  return (
    <div className="fixed inset-0 z-[55] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Staff profile</p>
            <h3 className="truncate text-lg font-bold tracking-tight text-slate-900">{name}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">{empId}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill label={status.label} variant={status.variant} />
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-600">
                {staff.role}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Employment</p>
            <Row label="Department" value={staff.department || "—"} />
            <Row label="Branch" value={staff.branchName || "—"} />
            <Row label="Shift" value={staff.shift || "—"} />
            <Row label="Joined" value={staff.joiningDate || "—"} />
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Contact</p>
            <Row label="Email" value={staff.email} />
            <Row label="Phone" value={staff.phone || "—"} />
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Permissions</p>
            <Row label="Appointments" value={staff.canManageAppointments ? "Yes" : "No"} />
            <Row label="Billing" value={staff.canAccessBilling ? "Yes" : "No"} />
            <Row label="Reports" value={staff.canViewReports ? "Yes" : "No"} />
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Emergency</p>
            <Row label="Name" value={staff.emergencyName || "—"} />
            <Row label="Relation" value={staff.emergencyRelation || "—"} />
            <Row label="Phone" value={staff.emergencyPhone || "—"} />
          </section>
        </div>

        <footer className="shrink-0 space-y-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="grid grid-cols-2 gap-1.5">
            <Button type="button" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onAssignDepartment}>
              Assign Dept
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onChangeShift}>
              Change Shift
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onResetPassword}>
              Reset Password
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onToggleActive}>
              {staff.status === "inactive" ? "Activate" : "Deactivate"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
