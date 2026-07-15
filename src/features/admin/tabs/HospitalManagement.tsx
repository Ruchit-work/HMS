"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import {
  Eye,
  Ban,
  ArrowUpRight,
  RefreshCw,
  Settings2,
  BarChart3,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { Notification } from '@/shared/components'
import { ConfirmDialog } from '@/shared/components'
import { RevealModal, useRevealModalClose } from '@/shared/components'
import { Button } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { useTablePagination } from "@/hooks/useTablePagination"
import { auth, db } from "@/firebase/config"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { Hospital } from "@/types/hospital"
import {
  HqShell,
  HqPageHeader,
  HqToolbar,
  HqMetricGrid,
  HqMetricCard,
  HqPanel,
  HqEmptyState,
  HqSkeleton,
  HqModuleChipRow,
  HqTenantCard,
  HqTenantAvatar,
  deriveTenantPlan,
  HqHealthBadge,
  type HqHealthLevel,
  type HqTenantPlan,
} from "@/features/admin/hq"

interface HospitalFormData {
  name: string
  code: string
  address: string
  phone: string
  email: string
  multipleBranchesEnabled: boolean
  enableAnalytics: boolean
  enablePharmacy: boolean
}

type TenantMetrics = {
  doctors: number
  patients: number
  branches: number
}

type TenantView = Hospital & {
  plan: HqTenantPlan
  renewalDate: Date | null
  health: HqHealthLevel
  subscriptionLabel: string
  subscriptionVariant: "success" | "warning" | "neutral" | "danger"
  activityLabel: string
  metrics: TenantMetrics
}

const EMPTY_FORM: HospitalFormData = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  multipleBranchesEnabled: false,
  enableAnalytics: true,
  enablePharmacy: false,
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = value as { toDate?: () => Date }
    if (typeof maybe.toDate === "function") return maybe.toDate()
  }
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? null : d
}

function addYears(d: Date, years: number) {
  const next = new Date(d)
  next.setFullYear(next.getFullYear() + years)
  return next
}

function formatDate(d: Date | null) {
  if (!d) return "—"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function formatRelative(d: Date | null) {
  if (!d) return "No recent activity"
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return mins <= 1 ? "Updated just now" : `Updated ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Updated ${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `Updated ${days}d ago`
  return `Updated ${formatDate(d)}`
}

function statusLabel(status?: string) {
  if (status === "inactive") return "Inactive"
  if (status === "suspended") return "Suspended"
  return "Active"
}

function statusVariant(status?: string): "success" | "neutral" | "warning" | "danger" {
  if (status === "suspended") return "danger"
  if (status === "inactive") return "neutral"
  return "success"
}

function deriveHealth(h: Hospital): HqHealthLevel {
  if (h.status !== "active") return "offline"
  const plan = deriveTenantPlan(h)
  if (plan === "Starter") return "warning"
  return "healthy"
}

function deriveSubscription(h: Hospital): {
  label: string
  variant: "success" | "warning" | "neutral" | "danger"
} {
  if (h.status === "suspended") return { label: "Suspended", variant: "danger" }
  if (h.status === "inactive") return { label: "Cancelled", variant: "neutral" }
  const plan = deriveTenantPlan(h)
  if (plan === "Starter") return { label: "Needs upgrade", variant: "warning" }
  return { label: "In good standing", variant: "success" }
}

async function loadTenantMetrics(hospitalId: string): Promise<TenantMetrics> {
  const countCol = async (name: "doctors" | "patients") => {
    try {
      const snap = await getCountFromServer(getHospitalCollection(hospitalId, name))
      return snap.data().count
    } catch {
      return 0
    }
  }
  let branches = 0
  try {
    const snap = await getCountFromServer(
      query(collection(db, "branches"), where("hospitalId", "==", hospitalId)),
    )
    branches = snap.data().count
  } catch {
    branches = 0
  }
  const [doctors, patients] = await Promise.all([countCol("doctors"), countCol("patients")])
  return { doctors, patients, branches }
}

function Field({
  label,
  required,
  children,
  hint,
  full,
}: {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string
  full?: boolean
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {hint ? <p className="mt-1 text-[10px] text-slate-400">{hint}</p> : null}
    </label>
  )
}

const inputClass =
  "hq-ds-input hq-ds-input--lg w-full max-w-none"

function TenantFormModal({
  isOpen,
  editing,
  formData,
  setFormData,
  saving,
  onClose,
  onSubmit,
  intent = "configure",
}: {
  isOpen: boolean
  editing: Hospital | null
  formData: HospitalFormData
  setFormData: (next: HospitalFormData) => void
  saving: boolean
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  intent?: "configure" | "upgrade" | "renew" | "create"
}) {
  return (
    <RevealModal isOpen={isOpen} onClose={onClose} closeOnOverlayClick contentClassName="max-w-xl w-full mx-4">
      <TenantFormBody
        editing={editing}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        onSubmit={onSubmit}
        intent={intent}
      />
    </RevealModal>
  )
}

function TenantFormBody({
  editing,
  formData,
  setFormData,
  saving,
  onSubmit,
  intent,
}: {
  editing: Hospital | null
  formData: HospitalFormData
  setFormData: (next: HospitalFormData) => void
  saving: boolean
  onSubmit: (e: FormEvent) => void
  intent: "configure" | "upgrade" | "renew" | "create"
}) {
  const requestClose = useRevealModalClose()
  const title =
    intent === "create"
      ? "Onboard new tenant"
      : intent === "upgrade"
        ? "Upgrade subscription modules"
        : intent === "renew"
          ? "Renew / refresh entitlements"
          : "Configure tenant"

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="hq-ds-eyebrow">Platform · Customer tenants</p>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Treat each hospital as a SaaS customer. Module entitlements map to plan tiers.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto px-4 py-3 sm:px-5 space-y-3">
        <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Tenant identity</h4>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Tenant name" required full>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
                placeholder="e.g. City Care Hospital"
              />
            </Field>
            <Field
              label="Tenant code"
              required
              hint={editing ? "Code is immutable after onboarding" : "Short unique code, e.g. HMS001"}
            >
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className={inputClass}
                placeholder="HMS001"
                disabled={!!editing}
              />
            </Field>
            <Field label="Address" required full>
              <textarea
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={inputClass}
                placeholder="Registered address"
                rows={2}
              />
            </Field>
            <Field label="Phone" required>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputClass}
                placeholder="Contact number"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
                placeholder="ops@hospital.com"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2.5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Subscription modules
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Starter → Growth → Enterprise is derived from Branches + Analytics + Pharmacy.
            </p>
          </div>

          {(
            [
              {
                key: "multipleBranchesEnabled" as const,
                title: "Multi-branch",
                desc: "Allow this tenant to operate multiple locations.",
              },
              {
                key: "enableAnalytics" as const,
                title: "Analytics Hub",
                desc: "Unlock advanced analytics and performance insights.",
              },
              {
                key: "enablePharmacy" as const,
                title: "Pharmacy module",
                desc: "Enable pharmacy portal and pharmacist accounts.",
              },
            ] as const
          ).map((mod) => (
            <div
              key={mod.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{mod.title}</p>
                <p className="text-[11px] text-slate-500">{mod.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formData[mod.key]}
                  onChange={(e) => setFormData({ ...formData, [mod.key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]" />
              </label>
            </div>
          ))}
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 pb-1">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving} loadingText="Saving…">
            {editing ? "Save customer" : "Create tenant"}
          </Button>
        </div>
      </form>
    </div>
  )
}

function TenantDetailDrawer({
  tenant,
  onClose,
  onConfigure,
  onUpgrade,
  onRenew,
  onSuspend,
  onAnalytics,
}: {
  tenant: TenantView | null
  onClose: () => void
  onConfigure: () => void
  onUpgrade: () => void
  onRenew: () => void
  onSuspend: () => void
  onAnalytics: () => void
}) {
  if (!tenant) return null

  return (
    <div className="hq-ds-tenant-drawer" role="dialog" aria-modal="true" aria-label="Tenant details">
      <button type="button" className="hq-ds-tenant-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <div className="hq-ds-tenant-drawer-panel">
        <div className="hq-ds-tenant-drawer-header">
          <div className="flex min-w-0 items-start gap-3">
            <HqTenantAvatar name={tenant.name} code={tenant.code} size="lg" />
            <div className="min-w-0">
              <p className="hq-ds-eyebrow">Customer tenant</p>
              <h3 className="truncate text-base font-semibold text-slate-900">{tenant.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {tenant.code} · {tenant.email || "No email"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`hq-ds-plan-pill hq-ds-plan-pill--${tenant.plan.toLowerCase()}`}>
                  {tenant.plan}
                </span>
                <span className={`hq-ds-mini-pill hq-ds-mini-pill--${statusVariant(tenant.status)}`}>
                  {statusLabel(tenant.status)}
                </span>
                <HqHealthBadge status={tenant.health} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="hq-ds-tenant-drawer-body space-y-4">
          <section>
            <p className="hq-ds-section-label mb-2">Subscription</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Plan</p>
                <p className="hq-ds-tenant-metric-value">{tenant.plan}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Status</p>
                <p className="hq-ds-tenant-metric-value">{tenant.subscriptionLabel}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Renewal</p>
                <p className="hq-ds-tenant-metric-value">{formatDate(tenant.renewalDate)}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Health</p>
                <div className="mt-1">
                  <HqHealthBadge status={tenant.health} />
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className="hq-ds-section-label mb-2">Usage</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Branches</p>
                <p className="hq-ds-tenant-metric-value">{tenant.metrics.branches}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Doctors</p>
                <p className="hq-ds-tenant-metric-value">{tenant.metrics.doctors}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Patients</p>
                <p className="hq-ds-tenant-metric-value">{tenant.metrics.patients}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <p className="hq-ds-tenant-metric-label">Storage</p>
                <p className="hq-ds-tenant-metric-value">—</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 col-span-2">
                <p className="hq-ds-tenant-metric-label">API usage</p>
                <p className="hq-ds-tenant-metric-value">Not instrumented</p>
              </div>
            </div>
          </section>

          <section>
            <p className="hq-ds-section-label mb-2">Modules</p>
            <HqModuleChipRow
              branches={tenant.multipleBranchesEnabled}
              analytics={tenant.enableAnalytics}
              pharmacy={tenant.enablePharmacy}
            />
          </section>

          <section>
            <p className="hq-ds-section-label mb-2">Recent activity</p>
            <p className="text-xs text-slate-600">{tenant.activityLabel}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {tenant.phone || "No phone"} · {tenant.address || "No address on file"}
            </p>
          </section>
        </div>

        <div className="hq-ds-tenant-drawer-footer">
          <Button type="button" size="sm" variant="outline" onClick={onConfigure}>
            Configure
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onUpgrade}>
            Upgrade
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRenew}>
            Renew
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAnalytics}>
            Analytics
          </Button>
          {tenant.status === "active" && (
            <Button type="button" size="sm" variant="danger" onClick={onSuspend}>
              Suspend
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HospitalManagement() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin, refreshHospitals: refreshContextHospitals, setActiveHospital } =
    useMultiHospital()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [metricsById, setMetricsById] = useState<Record<string, TenantMetrics>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalIntent, setModalIntent] = useState<"configure" | "upgrade" | "renew" | "create">("create")
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<HospitalFormData>(EMPTY_FORM)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [moduleFilter, setModuleFilter] = useState<"all" | "branches" | "analytics" | "pharmacy">("all")
  const [planFilter, setPlanFilter] = useState<"all" | HqTenantPlan>("all")
  const [deactivateTarget, setDeactivateTarget] = useState<Hospital | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [viewTenantId, setViewTenantId] = useState<string | null>(null)

  useEffect(() => {
    if (user && isSuperAdmin) {
      void loadHospitals()
    }
  }, [user, isSuperAdmin])

  const loadHospitals = async () => {
    setLoading(true)
    setError(null)
    try {
      const hospitalsRef = collection(db, "hospitals")
      const q = query(hospitalsRef, orderBy("createdAt", "desc"))
      const snapshot = await getDocs(q)
      const hospitalsList = snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          }) as Hospital,
      )
      setHospitals(hospitalsList)

      const metricEntries = await Promise.all(
        hospitalsList.slice(0, 40).map(async (h) => [h.id, await loadTenantMetrics(h.id)] as const),
      )
      setMetricsById(Object.fromEntries(metricEntries))
    } catch {
      setError("Failed to load tenants. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingHospital(null)
    let next = EMPTY_FORM
    try {
      const raw = sessionStorage.getItem("hq-subscription-plan-preset")
      if (raw) {
        const preset = JSON.parse(raw) as {
          multipleBranchesEnabled?: boolean
          enableAnalytics?: boolean
          enablePharmacy?: boolean
        }
        next = {
          ...EMPTY_FORM,
          multipleBranchesEnabled: preset.multipleBranchesEnabled === true,
          enableAnalytics: preset.enableAnalytics !== false,
          enablePharmacy: preset.enablePharmacy === true,
        }
        sessionStorage.removeItem("hq-subscription-plan-preset")
      }
    } catch {
      /* ignore */
    }
    setFormData(next)
    setModalIntent("create")
    setShowModal(true)
  }

  useEffect(() => {
    if (!user || !isSuperAdmin || showModal) return
    try {
      if (sessionStorage.getItem("hq-subscription-plan-preset")) {
        openCreate()
      }
    } catch {
      /* ignore */
    }
    // open once when landing with a plan preset from Subscription Center
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isSuperAdmin])

  const openEdit = (
    hospital: Hospital,
    intent: "configure" | "upgrade" | "renew" = "configure",
  ) => {
    setEditingHospital(hospital)
    setFormData({
      name: hospital.name,
      code: hospital.code,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email || "",
      multipleBranchesEnabled: hospital.multipleBranchesEnabled === true,
      enableAnalytics: hospital.enableAnalytics !== false,
      enablePharmacy: hospital.enablePharmacy === true,
    })
    setModalIntent(intent)
    setShowModal(true)
  }

  const handleCancel = () => {
    setShowModal(false)
    setEditingHospital(null)
    setFormData(EMPTY_FORM)
    setModalIntent("create")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage tenants")

      const token = await currentUser.getIdToken()
      const url = editingHospital ? `/api/hospitals/${editingHospital.id}` : "/api/hospitals"
      const method = editingHospital ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          multipleBranchesEnabled: formData.multipleBranchesEnabled,
          enableAnalytics: formData.enableAnalytics,
          enablePharmacy: formData.enablePharmacy,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to save tenant")

      setSuccess(
        editingHospital
          ? modalIntent === "upgrade"
            ? "Subscription modules upgraded."
            : modalIntent === "renew"
              ? "Entitlements renewed."
              : "Tenant updated successfully."
          : "Tenant onboarded successfully.",
      )
      handleCancel()
      await loadHospitals()
      await refreshContextHospitals()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save tenant. Please try again."
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    setDeactivating(true)
    setError(null)
    setSuccess(null)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage tenants")

      const token = await currentUser.getIdToken()
      const response = await fetch(`/api/hospitals/${deactivateTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to deactivate tenant")

      setSuccess("Tenant suspended successfully.")
      setDeactivateTarget(null)
      setViewTenantId(null)
      await loadHospitals()
      await refreshContextHospitals()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to suspend tenant. Please try again."
      setError(message)
    } finally {
      setDeactivating(false)
    }
  }

  const tenantViews: TenantView[] = useMemo(() => {
    return hospitals.map((h) => {
      const created = parseDate(h.createdAt)
      const updated = parseDate(h.updatedAt) || created
      const sub = deriveSubscription(h)
      return {
        ...h,
        plan: deriveTenantPlan(h),
        renewalDate: created ? addYears(created, 1) : null,
        health: deriveHealth(h),
        subscriptionLabel: sub.label,
        subscriptionVariant: sub.variant,
        activityLabel: formatRelative(updated),
        metrics: metricsById[h.id] || { doctors: 0, patients: 0, branches: 0 },
      }
    })
  }, [hospitals, metricsById])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return tenantViews.filter((h) => {
      if (statusFilter !== "all" && h.status !== statusFilter) return false
      if (moduleFilter === "branches" && h.multipleBranchesEnabled !== true) return false
      if (moduleFilter === "analytics" && h.enableAnalytics === false) return false
      if (moduleFilter === "pharmacy" && h.enablePharmacy !== true) return false
      if (planFilter !== "all" && h.plan !== planFilter) return false
      if (!q) return true
      return (
        h.name?.toLowerCase().includes(q) ||
        h.code?.toLowerCase().includes(q) ||
        h.email?.toLowerCase().includes(q) ||
        h.phone?.toLowerCase().includes(q) ||
        h.address?.toLowerCase().includes(q) ||
        h.plan.toLowerCase().includes(q)
      )
    })
  }, [tenantViews, searchTerm, statusFilter, moduleFilter, planFilter])

  const { paginatedItems, currentPage, totalPages, goToPage, pageSize, setPageSize } =
    useTablePagination(filtered, { initialPageSize: 8 })

  const kpi = useMemo(() => {
    const active = hospitals.filter((h) => h.status === "active").length
    const inactive = hospitals.filter((h) => h.status !== "active").length
    const enterprise = tenantViews.filter((h) => h.plan === "Enterprise").length
    const needsUpgrade = tenantViews.filter((h) => h.subscriptionVariant === "warning").length
    return { total: hospitals.length, active, inactive, enterprise, needsUpgrade }
  }, [hospitals, tenantViews])

  const viewedTenant = useMemo(
    () => tenantViews.find((t) => t.id === viewTenantId) || null,
    [tenantViews, viewTenantId],
  )

  const openAnalytics = async (tenant: Hospital) => {
    try {
      await setActiveHospital(tenant.id)
      router.push("/admin-dashboard?tab=analytics")
    } catch {
      setError("Could not open analytics for this tenant.")
    }
  }

  if (authLoading || (loading && hospitals.length === 0)) {
    return <HqSkeleton metrics={5} split={false} />
  }

  if (!isSuperAdmin) {
    return (
      <HqEmptyState
        title="Platform access required"
        description="Only platform super admins can manage tenants across the Harmony HMS ecosystem."
      />
    )
  }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}
      {success && <Notification type="success" message={success} onClose={() => setSuccess(null)} />}

      <HqPageHeader
        variant="hero"
        eyebrow="Customer management · Tenants"
        title="Tenant management"
        description={`${kpi.total} customers · ${kpi.active} live · manage plans, health, and lifecycle like a SaaS control plane`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadHospitals()}
              loading={loading}
              loadingText="…"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              Add tenant
            </Button>
          </>
        }
      />

      <HqToolbar
        leading={
          <>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers…"
                className="hq-ds-input hq-ds-input--search"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="hq-ds-input w-auto max-w-[8rem]"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
              className="hq-ds-input w-auto max-w-[9rem]"
            >
              <option value="all">All plans</option>
              <option value="Starter">Starter</option>
              <option value="Growth">Growth</option>
              <option value="Enterprise">Enterprise</option>
            </select>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value as typeof moduleFilter)}
              className="hq-ds-input w-auto max-w-[9rem]"
            >
              <option value="all">All modules</option>
              <option value="branches">Multi-branch</option>
              <option value="analytics">Analytics</option>
              <option value="pharmacy">Pharmacy</option>
            </select>
          </>
        }
      />

      <HqMetricGrid columns={5}>
        <HqMetricCard label="Customers" value={kpi.total} hint="tenants" />
        <HqMetricCard label="Live" value={kpi.active} hint="active" />
        <HqMetricCard label="Inactive" value={kpi.inactive} hint="paused" />
        <HqMetricCard label="Enterprise" value={kpi.enterprise} hint="full stack" />
        <HqMetricCard label="Needs upgrade" value={kpi.needsUpgrade} hint="starter stacks" />
      </HqMetricGrid>

      <HqPanel
        title="Customer directory"
        subtitle={`${filtered.length} matching · page ${currentPage} of ${Math.max(totalPages, 1)}`}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <FilterChip
              active={statusFilter === "active"}
              onClick={() => setStatusFilter((s) => (s === "active" ? "all" : "active"))}
            >
              Live
            </FilterChip>
            <FilterChip
              active={planFilter === "Enterprise"}
              onClick={() => setPlanFilter((p) => (p === "Enterprise" ? "all" : "Enterprise"))}
            >
              Enterprise
            </FilterChip>
            <FilterChip
              active={planFilter === "Starter"}
              onClick={() => setPlanFilter((p) => (p === "Starter" ? "all" : "Starter"))}
            >
              Needs upgrade
            </FilterChip>
          </div>
        }
      >
        {paginatedItems.length === 0 ? (
          <HqEmptyState
            title={
              searchTerm || statusFilter !== "all" || moduleFilter !== "all" || planFilter !== "all"
                ? "No customers match these filters"
                : "No tenants onboarded yet"
            }
            description={
              searchTerm || statusFilter !== "all" || moduleFilter !== "all" || planFilter !== "all"
                ? "Adjust search or filters to see more customers."
                : "Onboard a hospital tenant to grow the Harmony HMS platform."
            }
            actionLabel={
              searchTerm || statusFilter !== "all" || moduleFilter !== "all" || planFilter !== "all"
                ? undefined
                : "Add tenant"
            }
            onAction={
              searchTerm || statusFilter !== "all" || moduleFilter !== "all" || planFilter !== "all"
                ? undefined
                : openCreate
            }
          />
        ) : (
          <div className="hq-ds-tenant-grid p-3">
            {paginatedItems.map((tenant) => (
              <HqTenantCard
                key={tenant.id}
                name={tenant.name}
                code={tenant.code}
                email={tenant.email}
                plan={tenant.plan}
                statusLabel={statusLabel(tenant.status)}
                statusVariant={statusVariant(tenant.status)}
                subscriptionLabel={tenant.subscriptionLabel}
                subscriptionVariant={tenant.subscriptionVariant}
                renewalLabel={formatDate(tenant.renewalDate)}
                health={tenant.health}
                doctors={tenant.metrics.doctors.toLocaleString("en-IN")}
                patients={tenant.metrics.patients.toLocaleString("en-IN")}
                branches={tenant.metrics.branches.toLocaleString("en-IN")}
                storageLabel="—"
                apiLabel="—"
                activityLabel={tenant.activityLabel}
                modules={{
                  branches: tenant.multipleBranchesEnabled,
                  analytics: tenant.enableAnalytics,
                  pharmacy: tenant.enablePharmacy,
                }}
                selected={viewTenantId === tenant.id}
                onClick={() => setViewTenantId(tenant.id)}
                actions={
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setViewTenantId(tenant.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    {tenant.status === "active" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDeactivateTarget(tenant)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Suspend
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(tenant, "upgrade")}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Upgrade
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(tenant, "renew")}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Renew
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(tenant, "configure")}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Configure
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void openAnalytics(tenant)}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      Analytics
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}

        {filtered.length > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              Page {currentPage} of {Math.max(totalPages, 1)} · {filtered.length} customers
            </p>
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="hq-ds-input h-8 w-auto"
              >
                {[8, 12, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </HqPanel>

      <TenantFormModal
        isOpen={showModal}
        editing={editingHospital}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        onClose={handleCancel}
        onSubmit={handleSubmit}
        intent={modalIntent}
      />

      <TenantDetailDrawer
        tenant={viewedTenant}
        onClose={() => setViewTenantId(null)}
        onConfigure={() => {
          if (viewedTenant) openEdit(viewedTenant, "configure")
        }}
        onUpgrade={() => {
          if (viewedTenant) openEdit(viewedTenant, "upgrade")
        }}
        onRenew={() => {
          if (viewedTenant) openEdit(viewedTenant, "renew")
        }}
        onSuspend={() => {
          if (viewedTenant) setDeactivateTarget(viewedTenant)
        }}
        onAnalytics={() => {
          if (viewedTenant) void openAnalytics(viewedTenant)
        }}
      />

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        title="Suspend tenant"
        message={
          deactivateTarget
            ? `Suspend ${deactivateTarget.name}? The customer will be set inactive. Existing clinical data is retained.`
            : ""
        }
        confirmText="Suspend"
        cancelText="Cancel"
        onConfirm={() => void handleDeactivateConfirm()}
        onCancel={() => setDeactivateTarget(null)}
        confirmLoading={deactivating}
      />
    </HqShell>
  )
}
