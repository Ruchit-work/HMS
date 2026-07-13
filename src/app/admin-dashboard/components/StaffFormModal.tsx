"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/Button"
import { RevealModal, useRevealModalClose } from "@/components/ui/overlays/RevealModal"
import type { Branch } from "@/types/branch"

export type StaffRole = "receptionist" | "pharmacist"

export type StaffFormValues = {
  role: StaffRole
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  employeeId: string
  department: string
  branchId: string
  shift: string
  status: "active" | "inactive" | "on_leave"
  joiningDate: string
  canManageAppointments: boolean
  canAccessBilling: boolean
  canViewReports: boolean
  emergencyName: string
  emergencyPhone: string
  emergencyRelation: string
}

export const EMPTY_STAFF_FORM: StaffFormValues = {
  role: "receptionist",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  employeeId: "",
  department: "Front Desk",
  branchId: "",
  shift: "Morning",
  status: "active",
  joiningDate: new Date().toISOString().slice(0, 10),
  canManageAppointments: true,
  canAccessBilling: false,
  canViewReports: false,
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelation: "",
}

const DEPARTMENTS = [
  "Front Desk",
  "Pharmacy",
  "Nursing",
  "Administration",
  "Billing",
  "Lab",
  "Other",
]

const SHIFTS = ["Morning", "Afternoon", "Night", "Rotating"]

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5">
      <div className="mb-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h4>
        {description ? <p className="mt-0.5 text-[11px] text-slate-500">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  children,
  full,
}: {
  label: string
  required?: boolean
  children: ReactNode
  full?: boolean
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function StaffFormBody({
  mode,
  values,
  setValues,
  branches,
  branchesLoading,
  saving,
  onSubmit,
}: {
  mode: "create" | "edit"
  values: StaffFormValues
  setValues: React.Dispatch<React.SetStateAction<StaffFormValues>>
  branches: Branch[]
  branchesLoading: boolean
  saving: boolean
  onSubmit: (e: FormEvent) => void
}) {
  const requestClose = useRevealModalClose()
  const isCreate = mode === "create"

  useEffect(() => {
    if (!isCreate) return
    setValues((prev) => {
      const nextDept =
        prev.role === "pharmacist"
          ? prev.department === "Front Desk"
            ? "Pharmacy"
            : prev.department
          : prev.department === "Pharmacy"
            ? "Front Desk"
            : prev.department
      if (nextDept === prev.department) return prev
      return { ...prev, department: nextDept }
    })
  }, [values.role, isCreate, setValues])

  return (
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {isCreate ? "Add Staff Member" : "Edit Staff Member"}
            </h3>
            <p className="text-xs text-slate-500">
              {isCreate
                ? "Onboard workforce credentials for this hospital"
                : "Update employment and contact details"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <Section title="Basic Information" description="Identity used across Harmony HMS">
            {isCreate ? (
              <Field label="Role" required>
                <select
                  required
                  value={values.role}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, role: e.target.value as StaffRole }))
                  }
                  className={inputClass}
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="pharmacist">Pharmacist</option>
                </select>
              </Field>
            ) : (
              <Field label="Role">
                <div className="rounded-lg border border-slate-100 bg-slate-100/80 px-2.5 py-1.5 text-sm capitalize text-slate-700">
                  {values.role}
                </div>
              </Field>
            )}
            <Field label="Employee ID">
              <input
                type="text"
                value={values.employeeId}
                onChange={(e) => setValues((p) => ({ ...p, employeeId: e.target.value }))}
                className={inputClass}
                placeholder="Auto if blank"
              />
            </Field>
            <Field label="First Name" required>
              <input
                type="text"
                required
                value={values.firstName}
                onChange={(e) => setValues((p) => ({ ...p, firstName: e.target.value }))}
                className={inputClass}
                placeholder="First name"
              />
            </Field>
            <Field label="Last Name" required>
              <input
                type="text"
                required
                value={values.lastName}
                onChange={(e) => setValues((p) => ({ ...p, lastName: e.target.value }))}
                className={inputClass}
                placeholder="Last name"
              />
            </Field>
          </Section>

          <Section title="Employment Details">
            <Field label="Status" required>
              <select
                value={values.status}
                onChange={(e) =>
                  setValues((p) => ({
                    ...p,
                    status: e.target.value as StaffFormValues["status"],
                  }))
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </Field>
            <Field label="Shift">
              <select
                value={values.shift}
                onChange={(e) => setValues((p) => ({ ...p, shift: e.target.value }))}
                className={inputClass}
              >
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Joining Date">
              <input
                type="date"
                value={values.joiningDate}
                onChange={(e) => setValues((p) => ({ ...p, joiningDate: e.target.value }))}
                className={inputClass}
              />
            </Field>
            {isCreate ? (
              <Field label="Password" required>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={values.password}
                  onChange={(e) => setValues((p) => ({ ...p, password: e.target.value }))}
                  className={inputClass}
                  placeholder="Min 6 characters"
                />
              </Field>
            ) : (
              <Field label="Password">
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500">
                  Use Reset Password from the profile actions.
                </div>
              </Field>
            )}
          </Section>

          <Section title="Department & Branch">
            <Field label="Department">
              <select
                value={values.department}
                onChange={(e) => setValues((p) => ({ ...p, department: e.target.value }))}
                className={inputClass}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Branch${branches.length > 1 ? "" : ""}`} required={branches.length > 1}>
              {branches.length <= 1 ? (
                <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                  {branches.length === 1 ? branches[0].name : "Main"}
                  <p className="mt-0.5 text-[10px] text-slate-500">Assigned automatically</p>
                </div>
              ) : (
                <select
                  required
                  value={values.branchId}
                  onChange={(e) => setValues((p) => ({ ...p, branchId: e.target.value }))}
                  className={inputClass}
                  disabled={branchesLoading}
                >
                  <option value="">{branchesLoading ? "Loading…" : "Select branch"}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </Section>

          <Section title="Contact Information">
            <Field label="Email" required={isCreate}>
              <input
                type="email"
                required={isCreate}
                disabled={!isCreate}
                value={values.email}
                onChange={(e) => setValues((p) => ({ ...p, email: e.target.value }))}
                className={`${inputClass} ${!isCreate ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                placeholder="work@hospital.com"
              />
            </Field>
            <Field label="Phone" required={values.role === "receptionist"}>
              <input
                type="tel"
                required={values.role === "receptionist"}
                value={values.phone}
                onChange={(e) => setValues((p) => ({ ...p, phone: e.target.value }))}
                className={inputClass}
                placeholder="Mobile number"
              />
            </Field>
          </Section>

          <Section title="Permissions" description="Operational access flags (stored with staff profile)">
            {(
              [
                ["canManageAppointments", "Manage appointments"],
                ["canAccessBilling", "Access billing"],
                ["canViewReports", "View reports"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={values[key]}
                  onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                {label}
              </label>
            ))}
          </Section>

          <Section title="Emergency Contact">
            <Field label="Contact Name">
              <input
                type="text"
                value={values.emergencyName}
                onChange={(e) => setValues((p) => ({ ...p, emergencyName: e.target.value }))}
                className={inputClass}
                placeholder="Full name"
              />
            </Field>
            <Field label="Relation">
              <input
                type="text"
                value={values.emergencyRelation}
                onChange={(e) => setValues((p) => ({ ...p, emergencyRelation: e.target.value }))}
                className={inputClass}
                placeholder="Spouse, parent…"
              />
            </Field>
            <Field label="Phone" full>
              <input
                type="tel"
                value={values.emergencyPhone}
                onChange={(e) => setValues((p) => ({ ...p, emergencyPhone: e.target.value }))}
                className={inputClass}
                placeholder="Emergency phone"
              />
            </Field>
          </Section>
        </div>

        <div className="sticky bottom-0 flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving} loadingText={isCreate ? "Creating…" : "Saving…"}>
            {isCreate ? "Save Staff" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function StaffFormModal({
  open,
  mode,
  values,
  setValues,
  branches,
  branchesLoading,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: "create" | "edit"
  values: StaffFormValues
  setValues: React.Dispatch<React.SetStateAction<StaffFormValues>>
  branches: Branch[]
  branchesLoading: boolean
  saving: boolean
  onClose: () => void
  onSubmit: (e: FormEvent) => void
}) {
  if (!open) return null

  return (
    <RevealModal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      contentClassName="p-0"
      overlayClassName="bg-slate-900/55 backdrop-blur-[2px]"
      zIndex={60}
    >
      <StaffFormBody
        mode={mode}
        values={values}
        setValues={setValues}
        branches={branches}
        branchesLoading={branchesLoading}
        saving={saving}
        onSubmit={onSubmit}
      />
    </RevealModal>
  )
}

export { DEPARTMENTS, SHIFTS }
