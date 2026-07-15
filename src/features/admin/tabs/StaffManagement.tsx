"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Button } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { useTablePagination } from "@/hooks/useTablePagination"
import { useSearch } from "@/hooks/useSearch"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { auth, db } from "@/firebase/config"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import type { Branch } from "@/types/branch"
import { useBranches } from "@/hooks/useBranches"
import { listStaff } from "@/services/StaffService"
import { Notification } from '@/shared/components'
import {
  EnterpriseDataTable,
  StatusPill,
  type EnterpriseBulkAction,
  type EnterpriseColumn,
  type EnterpriseRowAction,
  type StatusVariant,
} from '@/shared/components'
import StaffFormModal, {
  DEPARTMENTS,
  EMPTY_STAFF_FORM,
  SHIFTS,
  type StaffFormValues,
  type StaffRole,
} from "@/features/admin/components/StaffFormModal"
import StaffDetailDrawer, {
  type StaffProfile,
} from "@/features/admin/components/StaffDetailDrawer"

type StaffStatus = "active" | "inactive" | "on_leave"

type StaffRow = StaffProfile & {
  hospitalId: string
  hospitalName?: string
}

function parseDate(value: unknown): Date {
  if (!value) return new Date(0)
  if (value instanceof Date) return value
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = value as { toDate?: () => Date }
    if (typeof maybe.toDate === "function") return maybe.toDate()
  }
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

function formatJoinDate(row: StaffRow) {
  if (row.joiningDate) {
    const d = new Date(row.joiningDate)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    }
    return row.joiningDate
  }
  const created = parseDate(row.createdAt)
  if (created.getTime() === 0) return "—"
  return created.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function empIdOf(row: StaffRow) {
  return row.employeeId || `EMP-${row.id.slice(0, 6).toUpperCase()}`
}

function defaultDept(role: StaffRole) {
  return role === "pharmacist" ? "Pharmacy" : "Front Desk"
}

function statusVariant(status?: StaffStatus): StatusVariant {
  if (status === "inactive") return "neutral"
  if (status === "on_leave") return "warning"
  return "success"
}

function statusLabel(status?: StaffStatus) {
  if (status === "inactive") return "Inactive"
  if (status === "on_leave") return "On Leave"
  return "Active"
}

function collectionFor(role: StaffRole) {
  return role === "pharmacist" ? "pharmacists" : "receptionists"
}

function profileExtras(form: StaffFormValues) {
  return {
    employeeId: form.employeeId.trim() || null,
    department: form.department,
    shift: form.shift,
    status: form.status,
    joiningDate: form.joiningDate || null,
    canManageAppointments: form.canManageAppointments,
    canAccessBilling: form.canAccessBilling,
    canViewReports: form.canViewReports,
    emergencyName: form.emergencyName.trim() || null,
    emergencyPhone: form.emergencyPhone.trim() || null,
    emergencyRelation: form.emergencyRelation.trim() || null,
    updatedAt: serverTimestamp(),
  }
}

function mapDocToRow(
  id: string,
  data: Record<string, unknown>,
  role: StaffRole,
  hospitalName: string,
): StaffRow {
  return {
    id,
    role,
    firstName: String(data.firstName || ""),
    lastName: String(data.lastName || ""),
    email: String(data.email || ""),
    phone: data.phone ? String(data.phone) : data.phoneNumber ? String(data.phoneNumber) : undefined,
    hospitalId: String(data.hospitalId || ""),
    hospitalName,
    branchId: data.branchId ? String(data.branchId) : undefined,
    branchName: data.branchName ? String(data.branchName) : undefined,
    employeeId: data.employeeId ? String(data.employeeId) : undefined,
    department: data.department ? String(data.department) : defaultDept(role),
    shift: data.shift ? String(data.shift) : "Morning",
    status: (data.status as StaffStatus) || "active",
    joiningDate: data.joiningDate ? String(data.joiningDate) : undefined,
    createdAt: data.createdAt,
    canManageAppointments: Boolean(data.canManageAppointments ?? role === "receptionist"),
    canAccessBilling: Boolean(data.canAccessBilling),
    canViewReports: Boolean(data.canViewReports),
    emergencyName: data.emergencyName ? String(data.emergencyName) : undefined,
    emergencyPhone: data.emergencyPhone ? String(data.emergencyPhone) : undefined,
    emergencyRelation: data.emergencyRelation ? String(data.emergencyRelation) : undefined,
  }
}

function rowToForm(row: StaffRow): StaffFormValues {
  return {
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone || "",
    password: "",
    employeeId: row.employeeId || empIdOf(row),
    department: row.department || defaultDept(row.role),
    branchId: row.branchId || "",
    shift: row.shift || "Morning",
    status: row.status || "active",
    joiningDate: row.joiningDate || new Date().toISOString().slice(0, 10),
    canManageAppointments: Boolean(row.canManageAppointments),
    canAccessBilling: Boolean(row.canAccessBilling),
    canViewReports: Boolean(row.canViewReports),
    emergencyName: row.emergencyName || "",
    emergencyPhone: row.emergencyPhone || "",
    emergencyRelation: row.emergencyRelation || "",
  }
}

function KpiIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
      {children}
    </span>
  )
}

export default function StaffManagement({
  selectedBranchId = "all",
  doctorCount = 0,
  initialRoleFilter = "all",
}: {
  selectedBranchId?: string
  doctorCount?: number
  initialRoleFilter?: "all" | StaffRole
} = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, isSuperAdmin, loading: hospitalLoading } = useMultiHospital()

  const [staff, setStaff] = useState<StaffRow[]>([])
  const { branches, loadingBranches: branchesLoading } = useBranches(activeHospitalId, {
    enabled: Boolean(activeHospitalId),
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processingBulk, setProcessingBulk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { searchTerm, setSearchTerm, debouncedSearchTerm } = useSearch()
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>(initialRoleFilter)
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState(selectedBranchId)
  const [statusFilter, setStatusFilter] = useState<"all" | StaffStatus>("all")

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [formValues, setFormValues] = useState<StaffFormValues>(EMPTY_STAFF_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    setBranchFilter(selectedBranchId)
  }, [selectedBranchId])

  useEffect(() => {
    setRoleFilter(initialRoleFilter)
  }, [initialRoleFilter])

  const loadStaff = useCallback(async () => {
    if (!activeHospitalId) return
    setLoading(true)
    setError(null)
    try {
      const { hospitalName, receptionists, pharmacists } = await listStaff(activeHospitalId)

      const list: StaffRow[] = [
        ...receptionists.map((d) => mapDocToRow(d.id, d as Record<string, unknown>, "receptionist", hospitalName)),
        ...pharmacists.map((d) => mapDocToRow(d.id, d as Record<string, unknown>, "pharmacist", hospitalName)),
      ]

      list.sort((a, b) => parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime())
      setStaff(list)
    } catch {
      setError("Failed to load staff. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId])

  useEffect(() => {
    if (user && activeHospitalId && !isSuperAdmin) {
      void loadStaff()
    }
  }, [user, activeHospitalId, isSuperAdmin, loadStaff])

  const toast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    if (type === "ok") {
      setSuccess(msg)
      setError(null)
      setTimeout(() => setSuccess(null), 2800)
    } else {
      setError(msg)
      setSuccess(null)
    }
  }, [])

  const openCreate = () => {
    setFormMode("create")
    setEditingId(null)
    setFormValues({
      ...EMPTY_STAFF_FORM,
      branchId: branches.length === 1 ? branches[0].id : "",
      department: "Front Desk",
    })
    setFormOpen(true)
  }

  const openEdit = useCallback((row: StaffRow) => {
    setFormMode("edit")
    setEditingId(row.id)
    setFormValues(rowToForm(row))
    setFormOpen(true)
  }, [])

  const selectedStaff = useMemo(
    () => staff.find((s) => s.id === selectedId) || null,
    [staff, selectedId],
  )

  const openDrawer = useCallback((row: StaffRow) => {
    setSelectedId(row.id)
    setDrawerOpen(true)
  }, [])

  const handleCreateOrUpdate = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in")
      const token = await currentUser.getIdToken()
      if (!token) throw new Error("Authentication token not found")

      if (branches.length > 1 && !formValues.branchId) {
        throw new Error("Please select a branch")
      }

      if (formMode === "create") {
        if (formValues.role === "receptionist") {
          const response = await fetch("/api/admin/create-receptionist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              receptionistData: {
                firstName: formValues.firstName,
                lastName: formValues.lastName,
                email: formValues.email,
                phone: formValues.phone,
                branchId: formValues.branchId,
              },
              password: formValues.password,
            }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || "Failed to create receptionist")
          if (result.receptionistId) {
            await updateDoc(doc(db, "receptionists", result.receptionistId), profileExtras(formValues))
          }
        } else {
          const res = await fetch("/api/admin/create-pharmacist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: formValues.email.trim().toLowerCase(),
              password: formValues.password,
              firstName: formValues.firstName.trim(),
              lastName: formValues.lastName.trim(),
              phone: formValues.phone.trim() || undefined,
              branchId: formValues.branchId || undefined,
            }),
          })
          const result = await res.json().catch(() => ({}))
          if (!res.ok || !result.success) throw new Error(result.error || "Failed to create pharmacist")
          const newId = result.pharmacistId || result.uid || result.id
          if (newId) {
            await updateDoc(doc(db, "pharmacists", String(newId)), profileExtras(formValues)).catch(() => undefined)
          }
        }
        toast("Staff member created successfully")
      } else if (editingId) {
        const row = staff.find((s) => s.id === editingId)
        if (!row) throw new Error("Staff member not found")
        const branch = branches.find((b) => b.id === formValues.branchId)

        if (row.role === "receptionist") {
          await updateDoc(doc(db, "receptionists", editingId), {
            firstName: formValues.firstName,
            lastName: formValues.lastName,
            phone: formValues.phone,
            branchId: formValues.branchId || row.branchId || "",
            branchName: branch?.name ?? row.branchName ?? "",
            ...profileExtras(formValues),
          })
          await setDoc(
            doc(db, "users", editingId),
            {
              firstName: formValues.firstName,
              lastName: formValues.lastName,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          )
        } else {
          const res = await fetch(`/api/admin/pharmacists/${editingId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              firstName: formValues.firstName,
              lastName: formValues.lastName,
              phone: formValues.phone,
              branchId: formValues.branchId || undefined,
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data.success) throw new Error(data.error || "Failed to update pharmacist")
          await updateDoc(doc(db, "pharmacists", editingId), profileExtras(formValues))
        }
        toast("Staff profile updated")
      }

      setFormOpen(false)
      setEditingId(null)
      await loadStaff()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save staff member"
      toast(message, "err")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async (row: StaffRow) => {
    const name = `${row.firstName} ${row.lastName}`.trim()
    if (!window.confirm(`Delete ${name || "this staff member"}? This cannot be undone.`)) return
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in")
      const token = await currentUser.getIdToken()

      if (row.role === "receptionist") {
        try {
          await fetch("/api/admin/delete-user", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uid: row.id, userType: "receptionist" }),
          })
        } catch {
          /* best-effort auth delete */
        }
        await deleteDoc(doc(db, "receptionists", row.id))
      } else {
        const res = await fetch(`/api/admin/pharmacists/${row.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete pharmacist")
      }

      if (selectedId === row.id) {
        setDrawerOpen(false)
        setSelectedId(null)
      }
      toast("Staff member deleted")
      await loadStaff()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete", "err")
    }
  }, [selectedId, toast, loadStaff])

  const patchStaffField = useCallback(async (row: StaffRow, patch: Record<string, unknown>, okMsg: string) => {
    try {
      await updateDoc(doc(db, collectionFor(row.role), row.id), {
        ...patch,
        updatedAt: serverTimestamp(),
      })
      toast(okMsg)
      await loadStaff()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Update failed", "err")
    }
  }, [toast, loadStaff])

  const toggleActive = useCallback(async (row: StaffRow) => {
    const next = row.status === "inactive" ? "active" : "inactive"
    await patchStaffField(row, { status: next }, next === "active" ? "Staff activated" : "Staff deactivated")
  }, [patchStaffField])

  const assignDepartment = useCallback(async (row: StaffRow) => {
    const next = window.prompt("Assign department", row.department || defaultDept(row.role))
    if (next == null) return
    const trimmed = next.trim()
    if (!trimmed) return
    await patchStaffField(row, { department: trimmed }, "Department updated")
  }, [patchStaffField])

  const changeShift = useCallback(async (row: StaffRow) => {
    const next = window.prompt(`Change shift (${SHIFTS.join(" / ")})`, row.shift || "Morning")
    if (next == null) return
    const trimmed = next.trim()
    if (!trimmed) return
    await patchStaffField(row, { shift: trimmed }, "Shift updated")
  }, [patchStaffField])

  const resetPassword = useCallback(() => {
    toast("Password reset stays on this page — connect admin reset when available.")
  }, [toast])

  const filteredStaff = useMemo(() => {
    let list = [...staff]
    if (branchFilter !== "all") {
      list = list.filter((s) => s.branchId === branchFilter)
    }
    if (roleFilter !== "all") {
      list = list.filter((s) => s.role === roleFilter)
    }
    if (departmentFilter !== "all") {
      list = list.filter((s) => (s.department || defaultDept(s.role)) === departmentFilter)
    }
    if (statusFilter !== "all") {
      list = list.filter((s) => (s.status || "active") === statusFilter)
    }
    const q = debouncedSearchTerm.trim().toLowerCase()
    if (q) {
      list = list.filter((s) => {
        const blob = [
          s.firstName,
          s.lastName,
          s.email,
          s.phone,
          s.department,
          s.branchName,
          empIdOf(s),
          s.role,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return blob.includes(q)
      })
    }

    if (sortField) {
      const sortValue = (row: StaffRow) => {
        if (sortField === "name") return `${row.firstName} ${row.lastName}`
        if (sortField === "employeeId") return empIdOf(row)
        if (sortField === "joiningDate") return formatJoinDate(row)
        if (sortField === "role") return row.role
        if (sortField === "department") return row.department || ""
        if (sortField === "branchName") return row.branchName || ""
        if (sortField === "status") return row.status || "active"
        return ""
      }
      list.sort((a, b) => {
        const cmp = sortValue(a).localeCompare(sortValue(b), undefined, {
          sensitivity: "base",
          numeric: true,
        })
        return sortOrder === "asc" ? cmp : -cmp
      })
    }
    return list
  }, [staff, branchFilter, roleFilter, departmentFilter, statusFilter, debouncedSearchTerm, sortField, sortOrder])

  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedItems,
    goToPage,
    setPageSize,
  } = useTablePagination(filteredStaff, { initialPageSize: 10 })

  const kpi = useMemo(() => {
    const now = Date.now()
    const thirty = 30 * 24 * 60 * 60 * 1000
    const active = staff.filter((s) => (s.status || "active") === "active").length
    const onLeave = staff.filter((s) => s.status === "on_leave").length
    const receptionists = staff.filter((s) => s.role === "receptionist").length
    const newJoiners = staff.filter((s) => now - parseDate(s.createdAt).getTime() < thirty).length
    return {
      total: staff.length,
      active,
      doctors: doctorCount,
      nurses: 0,
      receptionists,
      admin: 0,
      onLeave,
      newJoiners,
    }
  }, [staff, doctorCount])

  const exportCsv = useCallback((rows: StaffRow[]) => {
    const headers = [
      "Employee ID",
      "Name",
      "Role",
      "Department",
      "Branch",
      "Shift",
      "Contact",
      "Status",
      "Joining Date",
      "Email",
    ]
    const lines = rows.map((r) =>
      [
        empIdOf(r),
        `${r.firstName} ${r.lastName}`.trim(),
        r.role,
        r.department || "",
        r.branchName || "",
        r.shift || "",
        r.phone || "",
        r.status || "active",
        formatJoinDate(r),
        r.email,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    )
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staff-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const columns: EnterpriseColumn<StaffRow>[] = useMemo(
    () => [
    {
      key: "employeeId",
      header: "Employee ID",
      sortable: true,
      width: "w-[10%]",
      render: (r) => <span className="font-mono text-[11px] text-slate-600">{empIdOf(r)}</span>,
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      width: "w-[14%]",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {r.firstName} {r.lastName}
          </p>
          <p className="truncate text-[10px] text-slate-400">{r.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      hideBelow: "sm",
      render: (r) => (
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-700">
          {r.role}
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      sortable: true,
      hideBelow: "md",
      render: (r) => <span className="text-xs text-slate-700">{r.department || "—"}</span>,
    },
    {
      key: "branchName",
      header: "Branch",
      sortable: true,
      hideBelow: "md",
      render: (r) => <span className="text-xs text-slate-700">{r.branchName || "—"}</span>,
    },
    {
      key: "shift",
      header: "Shift",
      hideBelow: "lg",
      render: (r) => <span className="text-xs text-slate-700">{r.shift || "—"}</span>,
    },
    {
      key: "phone",
      header: "Contact",
      hideBelow: "lg",
      render: (r) => <span className="text-xs tabular-nums text-slate-700">{r.phone || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => (
        <StatusPill label={statusLabel(r.status)} variant={statusVariant(r.status)} />
      ),
    },
    {
      key: "joiningDate",
      header: "Joining Date",
      sortable: true,
      hideBelow: "lg",
      render: (r) => <span className="text-xs text-slate-600">{formatJoinDate(r)}</span>,
    },
  ],
    []
  )

  const rowActions: EnterpriseRowAction<StaffRow>[] = useMemo(
    () => [
      {
        label: "View Profile",
        onClick: (r) => openDrawer(r),
      },
      {
        label: "Edit",
        onClick: (r) => openEdit(r),
      },
      {
        label: "Assign Department",
        onClick: (r) => void assignDepartment(r),
      },
      {
        label: "Change Shift",
        onClick: (r) => void changeShift(r),
      },
      {
        label: "Reset Password",
        onClick: () => resetPassword(),
      },
      {
        label: "Activate / Deactivate",
        onClick: (r) => void toggleActive(r),
      },
      {
        label: "Delete",
        onClick: (r) => void handleDelete(r),
        variant: "danger",
      },
    ],
    [openDrawer, openEdit, assignDepartment, changeShift, resetPassword, toggleActive, handleDelete]
  )

  const bulkActions: EnterpriseBulkAction<StaffRow>[] = useMemo(
    () => [
      {
        label: "Export selected",
        onClick: (rows) => exportCsv(rows),
      },
      {
        label: "Deactivate selected",
        onClick: async (rows) => {
          setProcessingBulk(true)
          try {
            await Promise.all(
              rows.map((r) =>
                updateDoc(doc(db, collectionFor(r.role), r.id), {
                  status: "inactive",
                  updatedAt: serverTimestamp(),
                }),
              ),
            )
            toast(`Deactivated ${rows.length} staff`)
            setSelectedIds(new Set())
            await loadStaff()
          } catch {
            toast("Bulk deactivate failed", "err")
          } finally {
            setProcessingBulk(false)
          }
        },
      },
    ],
    [exportCsv, toast, loadStaff]
  )

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (paginatedItems.every((r) => selectedIds.has(r.id)) && paginatedItems.length > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        paginatedItems.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        paginatedItems.forEach((r) => next.add(r.id))
        return next
      })
    }
  }

  const departmentsInUse = useMemo(() => {
    const set = new Set(staff.map((s) => s.department || defaultDept(s.role)))
    DEPARTMENTS.forEach((d) => set.add(d))
    return Array.from(set)
  }, [staff])

  if (authLoading || hospitalLoading) {
    return <StaffCrmSkeleton />
  }

  if (isSuperAdmin) {
    return (
      <div className="camp-crm-empty rounded-xl border border-dashed border-slate-200 bg-white py-10">
        <p className="camp-crm-empty-title">Staff management unavailable</p>
        <p className="camp-crm-empty-desc">
          Super admins cannot manage hospital staff. Sign in with a hospital admin account.
        </p>
      </div>
    )
  }

  if (!activeHospitalId) {
    return (
      <div className="camp-crm-empty rounded-xl border border-dashed border-slate-200 bg-white py-10">
        <p className="camp-crm-empty-title">No hospital selected</p>
        <p className="camp-crm-empty-desc">Select a hospital to manage workforce records.</p>
      </div>
    )
  }

  const kpiCards = [
    {
      key: "total",
      label: "Total Staff",
      value: kpi.total,
      trend: "+0%",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      key: "active",
      label: "Active Staff",
      value: kpi.active,
      trend: "stable",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: "doctors",
      label: "Doctors",
      value: kpi.doctors,
      trend: "roster",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      key: "nurses",
      label: "Nurses",
      value: kpi.nurses,
      trend: "—",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      key: "rx",
      label: "Receptionists",
      value: kpi.receptionists,
      trend: "ops",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      key: "admin",
      label: "Admin Staff",
      value: kpi.admin,
      trend: "—",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      key: "leave",
      label: "Staff On Leave",
      value: kpi.onLeave,
      trend: "hr",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: "new",
      label: "New Joiners",
      value: kpi.newJoiners,
      trend: "30d",
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="camp-crm staff-crm">
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}
      {success && <Notification type="success" message={success} onClose={() => setSuccess(null)} />}

      {loading && staff.length === 0 ? (
        <StaffCrmSkeleton />
      ) : (
        <>
          <div className="camp-crm-toolbar">
            <div className="camp-crm-toolbar-meta min-w-0 flex-1">
              <div className="min-w-0">
                <p className="camp-crm-eyebrow">Workforce management</p>
                <p className="camp-crm-title truncate">
                  Staff Management · {kpi.total} records · {kpi.active} active
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-1.5 lg:w-auto">
                <div className="relative min-w-[10rem] flex-1 sm:max-w-[14rem]">
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
                    placeholder="Search staff…"
                    className="camp-crm-input h-8 w-full pl-7"
                  />
                </div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="camp-crm-input h-8 w-auto max-w-[9rem]"
                >
                  <option value="all">All departments</option>
                  {departmentsInUse.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="camp-crm-input h-8 w-auto max-w-[9rem]"
                >
                  <option value="all">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="camp-crm-input h-8 w-auto max-w-[8rem]"
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadStaff()}
                loading={loading}
                loadingText="…"
              >
                Refresh
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(filteredStaff)}>
                Export
              </Button>
              <Button type="button" size="sm" onClick={openCreate}>
                Add Staff
              </Button>
            </div>
          </div>

          <div className="staff-crm-kpi-grid">
            {kpiCards.map((card) => (
              <div key={card.key} className="camp-crm-kpi staff-crm-kpi">
                <div className="flex items-start justify-between gap-2">
                  <p className="camp-crm-kpi-label">{card.label}</p>
                  <KpiIcon>{card.icon}</KpiIcon>
                </div>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="camp-crm-kpi-value">{card.value}</p>
                  <span className="text-[10px] font-medium text-slate-400">{card.trend}</span>
                </div>
              </div>
            ))}
          </div>

          <section className="camp-crm-panel overflow-hidden">
            <EnterpriseDataTable
              data={paginatedItems}
              columns={columns}
              loading={loading}
              loadingVariant="skeleton"
              emptyTitle={
                searchTerm || roleFilter !== "all" || statusFilter !== "all" || departmentFilter !== "all"
                  ? "No staff match these filters"
                  : "No staff members yet"
              }
              emptyDescription={
                searchTerm || roleFilter !== "all" || statusFilter !== "all" || departmentFilter !== "all"
                  ? "Adjust search or filters, or clear them to see the full directory."
                  : "Add receptionists and pharmacists to build your hospital workforce directory."
              }
              emptyAction={
                searchTerm || roleFilter !== "all" || statusFilter !== "all" || departmentFilter !== "all"
                  ? undefined
                  : { label: "Add Staff", onClick: openCreate }
              }
              toolbar={
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                  <div>
                    <h3 className="camp-crm-section-title">Staff directory</h3>
                    <p className="camp-crm-section-sub">
                      {filteredStaff.length} matching · page {currentPage} of {Math.max(totalPages, 1)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <FilterChip active={roleFilter === "all"} count={staff.length} onClick={() => setRoleFilter("all")}>
                      All
                    </FilterChip>
                    <FilterChip
                      active={roleFilter === "receptionist"}
                      count={staff.filter((s) => s.role === "receptionist").length}
                      onClick={() => setRoleFilter("receptionist")}
                    >
                      Receptionists
                    </FilterChip>
                    <FilterChip
                      active={roleFilter === "pharmacist"}
                      count={staff.filter((s) => s.role === "pharmacist").length}
                      onClick={() => setRoleFilter("pharmacist")}
                    >
                      Pharmacists
                    </FilterChip>
                  </div>
                </div>
              }
              enableSearch={false}
              enableFilters={false}
              enableSorting
              enableBulkSelection
              enablePagination
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              onClearSelection={() => setSelectedIds(new Set())}
              bulkActions={bulkActions}
              processingBulk={processingBulk}
              primaryAction={{
                label: "View",
                onClick: (r) => openDrawer(r),
              }}
              rowActions={rowActions}
              onRowClick={(r) => openDrawer(r)}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredStaff.length}
              onPageChange={goToPage}
              onPageSizeChange={setPageSize}
              itemLabel="staff"
              minWidth="min-w-[1100px]"
            />
          </section>
        </>
      )}

      <StaffFormModal
        open={formOpen}
        mode={formMode}
        values={formValues}
        setValues={setFormValues}
        branches={branches}
        branchesLoading={branchesLoading}
        saving={saving}
        onClose={() => {
          setFormOpen(false)
          setEditingId(null)
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <StaffDetailDrawer
        open={drawerOpen}
        staff={selectedStaff}
        onClose={() => setDrawerOpen(false)}
        onEdit={() => {
          if (selectedStaff) openEdit(selectedStaff)
        }}
        onAssignDepartment={() => {
          if (selectedStaff) void assignDepartment(selectedStaff)
        }}
        onChangeShift={() => {
          if (selectedStaff) void changeShift(selectedStaff)
        }}
        onResetPassword={resetPassword}
        onToggleActive={() => {
          if (selectedStaff) void toggleActive(selectedStaff)
        }}
        onDelete={() => {
          if (selectedStaff) void handleDelete(selectedStaff)
        }}
      />
    </div>
  )
}

function StaffCrmSkeleton() {
  return (
    <div className="camp-crm staff-crm" aria-busy="true" aria-label="Loading staff management">
      <div className="camp-crm-toolbar">
        <div className="space-y-1.5">
          <div className="camp-crm-skel camp-crm-skel-block w-28" />
          <div className="camp-crm-skel camp-crm-skel-block h-3 w-48" />
        </div>
        <div className="flex gap-1.5">
          <div className="camp-crm-skel h-8 w-20 rounded-md" />
          <div className="camp-crm-skel h-8 w-16 rounded-md" />
          <div className="camp-crm-skel h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="staff-crm-kpi-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="camp-crm-kpi">
            <div className="camp-crm-skel camp-crm-skel-block w-16" />
            <div className="camp-crm-skel mt-2.5 h-5 w-10 rounded-md" />
          </div>
        ))}
      </div>
      <div className="camp-crm-panel p-3">
        <div className="camp-crm-skel camp-crm-skel-block mb-3 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="camp-crm-skel mb-2 h-9 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}
