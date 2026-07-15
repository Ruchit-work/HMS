"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { Notification } from '@/shared/components'
import { ConfirmDialog } from '@/shared/components'
import { RevealModal, useRevealModalClose } from '@/shared/components'
import { Button } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { useTablePagination } from "@/hooks/useTablePagination"
import { auth, db } from "@/firebase/config"
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from "firebase/firestore"
import { Hospital } from "@/types/hospital"
import {
  AvatarCell,
  EnterpriseDataTable,
  StatusPill,
  type EnterpriseColumn,
  type EnterpriseRowAction,
} from '@/shared/components'
import {
  HqShell,
  HqPageHeader,
  HqToolbar,
  HqMetricGrid,
  HqMetricCard,
  HqPanel,
  HqEmptyState,
  HqSkeleton,
} from "@/features/admin/hq"

interface Admin {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  hospitalId: string
  hospitalName?: string
  isSuperAdmin: boolean
  createdAt?: unknown
}

interface AdminFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  hospitalId: string
}

const EMPTY_FORM: AdminFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  hospitalId: "",
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

function AdminFormModal({
  isOpen,
  editing,
  formData,
  setFormData,
  hospitals,
  saving,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  editing: Admin | null
  formData: AdminFormData
  setFormData: (next: AdminFormData) => void
  hospitals: Hospital[]
  saving: boolean
  onClose: () => void
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <RevealModal isOpen={isOpen} onClose={onClose} closeOnOverlayClick contentClassName="max-w-lg w-full mx-4">
      <AdminFormBody
        editing={editing}
        formData={formData}
        setFormData={setFormData}
        hospitals={hospitals}
        saving={saving}
        onSubmit={onSubmit}
      />
    </RevealModal>
  )
}

function AdminFormBody({
  editing,
  formData,
  setFormData,
  hospitals,
  saving,
  onSubmit,
}: {
  editing: Admin | null
  formData: AdminFormData
  setFormData: (next: AdminFormData) => void
  hospitals: Hospital[]
  saving: boolean
  onSubmit: (e: FormEvent) => void
}) {
  const requestClose = useRevealModalClose()

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="hq-ds-eyebrow">Platform · Tenant Admins</p>
        <h3 className="text-sm font-semibold text-slate-900">
          {editing ? "Update tenant admin" : "Provision tenant admin"}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Customer administrators own day-to-day operations inside a single hospital tenant.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto px-4 py-3 sm:px-5 space-y-3">
        <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Identity</h4>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="First name" required>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={inputClass}
                placeholder="First name"
              />
            </Field>
            <Field label="Last name" required>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className={inputClass}
                placeholder="Last name"
              />
            </Field>
            <Field label="Email" required full>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
                placeholder="admin@hospital.com"
              />
            </Field>
            <Field label="Phone" full>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputClass}
                placeholder="Optional phone"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Tenant assignment</h4>
          <Field label="Hospital tenant" required full>
            <select
              required
              value={formData.hospitalId}
              onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
              className={inputClass}
            >
              <option value="">Select a tenant…</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </Field>

          {!editing ? (
            <Field
              label="Temporary password"
              required
              full
              hint="Minimum 6 characters. Share securely with the customer admin."
            >
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={inputClass}
                placeholder="••••••••"
              />
            </Field>
          ) : (
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/80 px-3 py-2.5">
              <p className="text-[11px] text-cyan-900">
                Password cannot be changed here. The admin can update it from their account settings.
              </p>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 pb-1">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={saving}
            loadingText={editing ? "Updating…" : "Creating…"}
          >
            {editing ? "Save admin" : "Create admin"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function AdminAssignment() {
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin } = useMultiHospital()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<AdminFormData>(EMPTY_FORM)
  const [searchTerm, setSearchTerm] = useState("")
  const [hospitalFilter, setHospitalFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "super">("all")

  useEffect(() => {
    if (user && isSuperAdmin) {
      void loadData()
    }
  }, [user, isSuperAdmin])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const hospitalsRef = collection(db, "hospitals")
      const hospitalsQuery = query(hospitalsRef, orderBy("name", "asc"))
      const hospitalsSnapshot = await getDocs(hospitalsQuery)
      const hospitalsList = hospitalsSnapshot.docs
        .filter((d) => d.data().status === "active")
        .map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            }) as Hospital,
        )
      setHospitals(hospitalsList)

      const adminsRef = collection(db, "admins")
      const adminsQuery = query(adminsRef, orderBy("createdAt", "desc"))
      const adminsSnapshot = await getDocs(adminsQuery)

      const adminsList: Admin[] = []
      for (const adminDoc of adminsSnapshot.docs) {
        const adminData = adminDoc.data()
        let hospitalName = "Unassigned"

        if (adminData.hospitalId) {
          const hospitalDoc = await getDoc(doc(db, "hospitals", adminData.hospitalId))
          if (hospitalDoc.exists()) {
            hospitalName = hospitalDoc.data().name
          }
        }

        adminsList.push({
          id: adminDoc.id,
          email: adminData.email,
          firstName: adminData.firstName || "",
          lastName: adminData.lastName || "",
          phone: adminData.phone,
          hospitalId: adminData.hospitalId || "",
          hospitalName,
          isSuperAdmin: adminData.isSuperAdmin || false,
          createdAt: adminData.createdAt,
        })
      }

      setAdmins(adminsList)
    } catch {
      setError("Failed to load tenant administrators. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingAdmin(null)
    setFormData(EMPTY_FORM)
    setError(null)
    setSuccess(null)
    setShowModal(true)
  }

  const handleCancel = () => {
    setShowModal(false)
    setEditingAdmin(null)
    setFormData(EMPTY_FORM)
    setError(null)
    setSuccess(null)
  }

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin)
    setFormData({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone || "",
      password: "",
      hospitalId: admin.hospitalId,
    })
    setShowModal(true)
  }

  const handleDeleteClick = (admin: Admin) => {
    if (admin.isSuperAdmin) {
      setError("Cannot delete a platform super admin account.")
      return
    }
    setDeletingAdmin(admin)
    setShowDeleteDialog(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to create admins")

      const token = await currentUser.getIdToken()
      if (!token) throw new Error("Authentication token not found")

      const response = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adminData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || null,
          },
          password: formData.password,
          hospitalId: formData.hospitalId,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to create admin")

      setSuccess("Tenant admin provisioned and assigned successfully.")
      handleCancel()
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create admin. Please try again."
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingAdmin) return

    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to update admins")

      const token = await currentUser.getIdToken()
      if (!token) throw new Error("Authentication token not found")

      const response = await fetch("/api/admin/update-admin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adminId: editingAdmin.id,
          adminData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || null,
          },
          hospitalId: formData.hospitalId,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to update admin")

      setSuccess("Tenant admin updated successfully.")
      handleCancel()
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update admin. Please try again."
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingAdmin) return

    setDeleting(true)
    setError(null)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to delete admins")

      const token = await currentUser.getIdToken()
      if (!token) throw new Error("Authentication token not found")

      const authDeleteResponse = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: deletingAdmin.id, userType: "admin" }),
      })

      if (!authDeleteResponse.ok) {
        await authDeleteResponse.json().catch(() => ({}))
      }

      await deleteDoc(doc(db, "admins", deletingAdmin.id))
      await deleteDoc(doc(db, "users", deletingAdmin.id)).catch(() => undefined)

      setSuccess("Tenant admin removed from the platform.")
      setShowDeleteDialog(false)
      setDeletingAdmin(null)
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete admin. Please try again."
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return admins.filter((a) => {
      if (roleFilter === "admin" && a.isSuperAdmin) return false
      if (roleFilter === "super" && !a.isSuperAdmin) return false
      if (hospitalFilter !== "all" && a.hospitalId !== hospitalFilter) return false
      if (!q) return true
      const name = `${a.firstName} ${a.lastName}`.toLowerCase()
      return (
        name.includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.hospitalName?.toLowerCase().includes(q)
      )
    })
  }, [admins, searchTerm, hospitalFilter, roleFilter])

  const { paginatedItems, currentPage, totalPages, goToPage, pageSize, setPageSize } =
    useTablePagination(filtered, { initialPageSize: 10 })

  const kpi = useMemo(() => {
    const tenantAdmins = admins.filter((a) => !a.isSuperAdmin)
    const platform = admins.filter((a) => a.isSuperAdmin)
    const assignedTenants = new Set(tenantAdmins.map((a) => a.hospitalId).filter(Boolean)).size
    const unassigned = tenantAdmins.filter((a) => !a.hospitalId).length
    return {
      total: admins.length,
      tenantAdmins: tenantAdmins.length,
      platform: platform.length,
      assignedTenants,
      unassigned,
    }
  }, [admins])

  const columns: EnterpriseColumn<Admin>[] = [
    {
      key: "name",
      header: "Administrator",
      sortable: true,
      render: (a) => (
        <AvatarCell
          name={`${a.firstName} ${a.lastName}`.trim() || a.email}
          sub={a.email}
        />
      ),
    },
    {
      key: "hospital",
      header: "Tenant",
      sortable: true,
      render: (a) => (
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-800 truncate">
            {a.isSuperAdmin ? "All tenants" : a.hospitalName || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Contact",
      hideBelow: "lg",
      render: (a) => <span className="text-xs tabular-nums text-slate-700">{a.phone || "—"}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (a) => (
        <StatusPill
          label={a.isSuperAdmin ? "Platform" : "Tenant admin"}
          variant={a.isSuperAdmin ? "cyan" : "success"}
        />
      ),
    },
  ]

  const rowActions: EnterpriseRowAction<Admin>[] = [
    {
      label: "Edit",
      onClick: (a) => handleEdit(a),
      hidden: (a) => a.isSuperAdmin,
    },
    {
      label: "Remove",
      onClick: (a) => handleDeleteClick(a),
      variant: "danger",
      hidden: (a) => a.isSuperAdmin,
    },
  ]

  if (authLoading || (loading && admins.length === 0)) {
    return <HqSkeleton />
  }

  if (!isSuperAdmin) {
    return (
      <HqEmptyState
        title="Platform access required"
        description="Only platform super admins can provision and assign tenant administrators."
      />
    )
  }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}
      {success && <Notification type="success" message={success} onClose={() => setSuccess(null)} />}

      <HqPageHeader
        variant="hero"
        eyebrow="Customer management · Operators"
        title="Tenant administrators"
        description={`${kpi.tenantAdmins} customer admins · ${kpi.assignedTenants} tenants covered · platform operators`}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} loading={loading} loadingText="…">
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              Provision admin
            </Button>
          </>
        }
      />

      <HqToolbar
        leading={
          <>
            <div className="relative">
              <svg className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search admins…"
                className="hq-ds-input hq-ds-input--search"
              />
            </div>
            <select
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="hq-ds-input w-auto max-w-[11rem]"
            >
              <option value="all">All tenants</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="hq-ds-input w-auto max-w-[9rem]"
            >
              <option value="all">All roles</option>
              <option value="admin">Tenant admins</option>
              <option value="super">Platform SA</option>
            </select>
          </>
        }
      />

      <HqMetricGrid columns={4}>
        <HqMetricCard label="All admins" value={kpi.total} hint="directory" />
        <HqMetricCard label="Tenant admins" value={kpi.tenantAdmins} hint="customers" />
        <HqMetricCard label="Covered tenants" value={kpi.assignedTenants} hint="assigned" />
        <HqMetricCard label="Platform SA" value={kpi.platform} hint="hq" />
      </HqMetricGrid>

      <HqPanel>
        <EnterpriseDataTable
          data={paginatedItems}
          columns={columns}
          loading={loading}
          loadingVariant="skeleton"
          emptyTitle={
            searchTerm || hospitalFilter !== "all" || roleFilter !== "all"
              ? "No admins match these filters"
              : "No tenant administrators yet"
          }
          emptyDescription={
            searchTerm || hospitalFilter !== "all" || roleFilter !== "all"
              ? "Adjust search or filters to see more operators."
              : "Provision a customer admin and assign them to a hospital tenant."
          }
          emptyAction={
            searchTerm || hospitalFilter !== "all" || roleFilter !== "all"
              ? undefined
              : { label: "Provision admin", onClick: openCreate }
          }
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <div>
                <h3 className="hq-ds-panel-title">Admin directory</h3>
                <p className="hq-ds-panel-sub">
                  {filtered.length} matching · page {currentPage} of {Math.max(totalPages, 1)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <FilterChip
                  active={roleFilter === "admin"}
                  onClick={() => setRoleFilter((r) => (r === "admin" ? "all" : "admin"))}
                >
                  Tenant admins
                </FilterChip>
                <FilterChip
                  active={roleFilter === "super"}
                  onClick={() => setRoleFilter((r) => (r === "super" ? "all" : "super"))}
                >
                  Platform
                </FilterChip>
              </div>
            </div>
          }
          rowActions={rowActions}
          onRowClick={(a) => {
            if (!a.isSuperAdmin) handleEdit(a)
          }}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
          itemLabel="admins"
          minWidth="min-w-[900px]"
        />
      </HqPanel>

      <AdminFormModal
        isOpen={showModal}
        editing={editingAdmin}
        formData={formData}
        setFormData={setFormData}
        hospitals={hospitals}
        saving={saving}
        onClose={handleCancel}
        onSubmit={editingAdmin ? handleUpdate : handleSubmit}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Remove tenant admin"
        message={
          deletingAdmin
            ? `Remove ${deletingAdmin.firstName} ${deletingAdmin.lastName} from the platform? This cannot be undone.`
            : ""
        }
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          setShowDeleteDialog(false)
          setDeletingAdmin(null)
        }}
        confirmLoading={deleting}
      />
    </HqShell>
  )
}
