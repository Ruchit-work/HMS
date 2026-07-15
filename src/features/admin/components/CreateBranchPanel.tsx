"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { Button } from '@/shared/components'
import type { BranchTimings } from "@/types/branch"

const WEEKDAYS: (keyof BranchTimings)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]

export type CreateBranchPayload = {
  name: string
  location: string
  timings: BranchTimings
}

type CreateBranchFormState = {
  name: string
  hospitalCode: string
  city: string
  state: string
  address: string
  contactNumber: string
  email: string
  workStart: string
  workEnd: string
  timeZone: string
  status: "active" | "inactive"
  emergencyAvailable: boolean
  branchManager: string
  assignedAdmin: string
}

const INITIAL_FORM: CreateBranchFormState = {
  name: "",
  hospitalCode: "",
  city: "",
  state: "",
  address: "",
  contactNumber: "",
  email: "",
  workStart: "09:00",
  workEnd: "17:00",
  timeZone: "Asia/Kolkata",
  status: "active",
  emergencyAvailable: false,
  branchManager: "",
  assignedAdmin: "",
}

function buildTimings(start: string, end: string): BranchTimings {
  const open = { start, end }
  return {
    monday: open,
    tuesday: { ...open },
    wednesday: { ...open },
    thursday: { ...open },
    friday: { ...open },
    saturday: null,
    sunday: null,
  }
}

function buildLocation(form: CreateBranchFormState) {
  const cityState = [form.city.trim(), form.state.trim()].filter(Boolean).join(", ")
  if (form.address.trim() && cityState) return `${form.address.trim()}, ${cityState}`
  if (cityState) return cityState
  return form.address.trim()
}

export default function CreateBranchPanel({
  saving = false,
  onSave,
  onCancel,
}: {
  saving?: boolean
  onSave: (payload: CreateBranchPayload) => void | Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState<CreateBranchFormState>(INITIAL_FORM)
  const [openSection, setOpenSection] = useState<"basic" | "ops" | "admin">("basic")

  const patch = <K extends keyof CreateBranchFormState>(key: K, value: CreateBranchFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setForm(INITIAL_FORM)
    setOpenSection("basic")
  }

  const handleCancel = () => {
    resetForm()
    onCancel?.()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const location = buildLocation(form)
    if (!form.name.trim() || !location) return

    try {
      await onSave({
        name: form.name.trim(),
        location,
        timings: buildTimings(form.workStart, form.workEnd),
      })
      resetForm()
    } catch {
      /* parent surfaces error */
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
        <div>
          <p className="text-[11px] font-semibold tracking-tight text-slate-900">Create branch</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            Complete sections below. Name and city are required.
          </p>
        </div>

        <Section
          id="basic"
          title="Basic Information"
          subtitle="Identity & contact"
          open={openSection === "basic"}
          onToggle={() => setOpenSection(openSection === "basic" ? "ops" : "basic")}
        >
          <Field label="Branch Name *" htmlFor="br-name">
            <input
              id="br-name"
              required
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
              className="camp-crm-input h-8 w-full"
              placeholder="City Light Branch"
            />
          </Field>
          <Field label="Hospital Code" htmlFor="br-code">
            <input
              id="br-code"
              value={form.hospitalCode}
              onChange={(e) => patch("hospitalCode", e.target.value)}
              className="camp-crm-input h-8 w-full"
              placeholder="HMS-SUR-01"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City *" htmlFor="br-city">
              <input
                id="br-city"
                required
                value={form.city}
                onChange={(e) => patch("city", e.target.value)}
                className="camp-crm-input h-8 w-full"
                placeholder="Surat"
              />
            </Field>
            <Field label="State" htmlFor="br-state">
              <input
                id="br-state"
                value={form.state}
                onChange={(e) => patch("state", e.target.value)}
                className="camp-crm-input h-8 w-full"
                placeholder="Gujarat"
              />
            </Field>
          </div>
          <Field label="Address" htmlFor="br-address">
            <textarea
              id="br-address"
              value={form.address}
              onChange={(e) => patch("address", e.target.value)}
              className="camp-crm-input min-h-[4rem] w-full resize-y py-1.5"
              placeholder="Street, landmark"
              rows={2}
            />
          </Field>
          <Field label="Contact Number" htmlFor="br-phone">
            <input
              id="br-phone"
              type="tel"
              value={form.contactNumber}
              onChange={(e) => patch("contactNumber", e.target.value)}
              className="camp-crm-input h-8 w-full"
              placeholder="+91 …"
            />
          </Field>
          <Field label="Email" htmlFor="br-email">
            <input
              id="br-email"
              type="email"
              value={form.email}
              onChange={(e) => patch("email", e.target.value)}
              className="camp-crm-input h-8 w-full"
              placeholder="branch@hospital.com"
            />
          </Field>
          <button
            type="button"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => setOpenSection("ops")}
          >
            Continue to Operational Details →
          </button>
        </Section>

        <Section
          id="ops"
          title="Operational Details"
          subtitle="Hours & availability"
          open={openSection === "ops"}
          onToggle={() => setOpenSection(openSection === "ops" ? "admin" : "ops")}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Working Hours (start)" htmlFor="br-start">
              <input
                id="br-start"
                type="time"
                value={form.workStart}
                onChange={(e) => patch("workStart", e.target.value)}
                className="camp-crm-input h-8 w-full"
              />
            </Field>
            <Field label="Working Hours (end)" htmlFor="br-end">
              <input
                id="br-end"
                type="time"
                value={form.workEnd}
                onChange={(e) => patch("workEnd", e.target.value)}
                className="camp-crm-input h-8 w-full"
              />
            </Field>
          </div>
          <p className="text-[10px] text-slate-400">
            Applies to {WEEKDAYS.map((d) => d.slice(0, 3)).join(", ")}. Weekends closed by default.
          </p>
          <Field label="Time Zone" htmlFor="br-tz">
            <select
              id="br-tz"
              value={form.timeZone}
              onChange={(e) => patch("timeZone", e.target.value)}
              className="camp-crm-input h-8 w-full"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <Field label="Status" htmlFor="br-status">
            <select
              id="br-status"
              value={form.status}
              onChange={(e) => patch("status", e.target.value as "active" | "inactive")}
              className="camp-crm-input h-8 w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <span>
              <span className="block text-[11px] font-semibold text-slate-800">Emergency Available</span>
              <span className="text-[10px] text-slate-500">24×7 emergency intake at this branch</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.emergencyAvailable}
              onClick={() => patch("emergencyAvailable", !form.emergencyAvailable)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                form.emergencyAvailable ? "bg-cyan-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  form.emergencyAvailable ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <button
            type="button"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => setOpenSection("admin")}
          >
            Continue to Administrator →
          </button>
        </Section>

        <Section
          id="admin"
          title="Administrator"
          subtitle="Ownership & access"
          open={openSection === "admin"}
          onToggle={() => setOpenSection(openSection === "admin" ? "basic" : "admin")}
        >
          <Field label="Branch Manager" htmlFor="br-manager">
            <input
              id="br-manager"
              value={form.branchManager}
              onChange={(e) => patch("branchManager", e.target.value)}
              className="camp-crm-input h-8 w-full"
              placeholder="Full name"
            />
          </Field>
          <Field label="Assigned Admin" htmlFor="br-admin">
            <input
              id="br-admin"
              value={form.assignedAdmin}
              onChange={(e) => patch("assignedAdmin", e.target.value)}
              className="camp-crm-input h-8 w-full"
              placeholder="Admin name or email"
            />
          </Field>
        </Section>
      </div>

      <div className="sticky bottom-0 flex shrink-0 items-center gap-1.5 border-t border-slate-100 bg-white px-2.5 py-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="flex-1"
          loading={saving}
          loadingText="Saving…"
          disabled={!form.name.trim() || !form.city.trim()}
        >
          Save
        </Button>
      </div>
    </form>
  )
}

function Section({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section
      id={`create-branch-${id}`}
      className={`overflow-hidden rounded-lg border transition-colors ${
        open ? "border-cyan-200 bg-cyan-50/30" : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
      >
        <span>
          <span className="block text-[11px] font-semibold text-slate-800">{title}</span>
          <span className="text-[10px] text-slate-500">{subtitle}</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {open ? "Open" : "Closed"}
        </span>
      </button>
      {open && <div className="space-y-2 border-t border-slate-100/80 bg-white px-2.5 py-2.5">{children}</div>}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}
