"use client"

import { useEffect, useMemo, useState } from "react"
import { Button, ConfirmDialog } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { useTablePagination } from "@/shared/hooks/useTablePagination"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { useBranchSelection } from "@/providers/BranchProvider"
import { filterBranchesBySelection } from "@/shared/utils/branch/branchFilters"
import { auth, db } from "@/firebase/config"
import { deleteDoc, doc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore"
import type { Branch, BranchTimings } from "@/types/branch"
import { Notification } from '@/shared/components'
import CreateBranchPanel, {
  type CreateBranchPayload,
} from "@/features/admin/components/CreateBranchPanel"
import BranchDetailDrawer from "@/features/admin/components/BranchDetailDrawer"
import {
  EnterpriseDataTable,
  StatusPill,
  type EnterpriseBulkAction,
  type EnterpriseColumn,
  type EnterpriseRowAction,
  type StatusVariant,
} from '@/shared/components'

const DAY_ORDER: (keyof BranchTimings)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

type BranchRow = Branch & { id: string }

export type BranchKpiSnapshot = {
  doctors?: number
  staff?: number | null
  todayAppointments?: number
  todayRevenue?: number
}

function parseCity(location?: string) {
  if (!location?.trim()) return "—"
  return location.split(",")[0]?.trim() || location
}

function formatBranchDate(value?: Branch["updatedAt"] | Branch["createdAt"]) {
  if (!value) return "—"
  try {
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    }
    if (typeof value === "string") {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      }
    }
  } catch {
    /* ignore */
  }
  return "—"
}

export default function BranchManagement({
  kpi,
}: {
  kpi?: BranchKpiSnapshot
} = {}) {
  const { activeHospitalId } = useMultiHospital()
  const {
    selectedBranchId,
    setSelectedBranchId,
    branches: contextBranches,
    loadingBranches,
    refreshBranches,
  } = useBranchSelection()
  const branches = contextBranches as BranchRow[]
  const loading = loadingBranches
  const [saving, setSaving] = useState(false)
  const [processingBulk, setProcessingBulk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [panelMode, setPanelMode] = useState<"create" | "details">("create")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [pendingConfirm, setPendingConfirm] = useState<
    | { type: "deactivate"; branch: BranchRow }
    | { type: "delete"; branch: BranchRow }
    | { type: "bulk-deactivate"; rows: BranchRow[] }
    | { type: "bulk-delete"; rows: BranchRow[] }
    | null
  >(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const loadBranches = async () => {
    if (!activeHospitalId) return
    setError(null)
    try {
      await refreshBranches()
    } catch (err: any) {
      setError(err.message || "Failed to load branches")
    }
  }

  useEffect(() => {
    void loadBranches()
     
  }, [activeHospitalId])

  const handleCreateBranch = async (payload: CreateBranchPayload) => {
    setError(null)
    setSuccess(null)

    if (!activeHospitalId) {
      setError("No hospital selected")
      throw new Error("No hospital selected")
    }

    try {
      setSaving(true)

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: payload.name,
          location: payload.location,
          hospitalId: activeHospitalId,
          timings: payload.timings,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create branch")
      }

      setSuccess("Branch created successfully")
      await loadBranches()
    } catch (err: any) {
      setError(err.message || "Failed to create branch")
      throw err
    } finally {
      setSaving(false)
    }
  }

  const filteredBranches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    let list = filterBranchesBySelection(branches, selectedBranchId).filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false
      if (!q) return true
      const city = parseCity(b.location).toLowerCase()
      return (
        b.name.toLowerCase().includes(q) ||
        (b.location || "").toLowerCase().includes(q) ||
        city.includes(q) ||
        b.status.toLowerCase().includes(q)
      )
    })

    if (sortField) {
      const dir = sortOrder === "asc" ? 1 : -1
      list = [...list].sort((a, b) => {
        const av =
          sortField === "name"
            ? a.name
            : sortField === "city"
              ? parseCity(a.location)
              : sortField === "status"
                ? a.status
                : sortField === "updatedAt"
                  ? formatBranchDate(a.updatedAt)
                  : a.name
        const bv =
          sortField === "name"
            ? b.name
            : sortField === "city"
              ? parseCity(b.location)
              : sortField === "status"
                ? b.status
                : sortField === "updatedAt"
                  ? formatBranchDate(b.updatedAt)
                  : b.name
        return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" }) * dir
      })
    }

    return list
  }, [branches, searchTerm, statusFilter, selectedBranchId, sortField, sortOrder])

  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedItems: paginatedBranches,
    goToPage,
    setPageSize,
  } = useTablePagination(filteredBranches, { initialPageSize: 10 })

  const selectedBranch = useMemo(
    () => (selectedId ? branches.find((b) => b.id === selectedId) ?? null : null),
    [branches, selectedId]
  )

  const activeCount = useMemo(
    () => branches.filter((b) => b.status === "active").length,
    [branches]
  )

  const openCreate = () => {
    setPanelMode("create")
    setSelectedId(null)
    setDrawerOpen(false)
    setCreateKey((k) => k + 1)
  }

  const openDetails = (branch: BranchRow) => {
    setSelectedId(branch.id)
    setPanelMode("details")
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPage = () => {
    const pageIds = paginatedBranches.map((b) => b.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const exportBranchesCsv = (rows: BranchRow[] = filteredBranches) => {
    const csvRows = [
      ["Branch", "City", "Status", "Location", "Last Updated", "Hospital ID"],
      ...rows.map((b) => [
        b.name,
        parseCity(b.location),
        b.status,
        b.location || "",
        formatBranchDate(b.updatedAt),
        b.hospitalId || "",
      ]),
    ]
    const csv = csvRows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `branches-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeactivate = async (branch: BranchRow) => {
    if (branch.status !== "active") return
    try {
      setConfirmLoading(true)
      await updateDoc(doc(db, "branches", branch.id), {
        status: "inactive",
        updatedAt: serverTimestamp(),
      })
      setSuccess(`“${branch.name}” deactivated`)
      setTimeout(() => setSuccess(null), 2500)
      if (selectedId === branch.id) {
        setSelectedId(null)
        setPanelMode("create")
      }
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(branch.id)
        return next
      })
      setPendingConfirm(null)
      await loadBranches()
    } catch (err: any) {
      setError(err?.message || "Failed to deactivate branch")
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleDelete = async (branch: BranchRow) => {
    try {
      setConfirmLoading(true)
      await deleteDoc(doc(db, "branches", branch.id))
      setSuccess(`“${branch.name}” deleted`)
      setTimeout(() => setSuccess(null), 2500)
      if (selectedId === branch.id) {
        setSelectedId(null)
        setPanelMode("create")
      }
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(branch.id)
        return next
      })
      setPendingConfirm(null)
      await loadBranches()
    } catch (err: any) {
      setError(err?.message || "Failed to delete branch")
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleBulkDeactivate = async (rows: BranchRow[]) => {
    const active = rows.filter((r) => r.status === "active")
    if (!active.length) return
    setProcessingBulk(true)
    setConfirmLoading(true)
    try {
      await Promise.all(
        active.map((b) =>
          updateDoc(doc(db, "branches", b.id), {
            status: "inactive",
            updatedAt: serverTimestamp(),
          })
        )
      )
      setSuccess(`Deactivated ${active.length} branch${active.length === 1 ? "" : "es"}`)
      setTimeout(() => setSuccess(null), 2500)
      setSelectedIds(new Set())
      setPendingConfirm(null)
      await loadBranches()
    } catch (err: any) {
      setError(err?.message || "Bulk deactivate failed")
    } finally {
      setProcessingBulk(false)
      setConfirmLoading(false)
    }
  }

  const handleBulkDelete = async (rows: BranchRow[]) => {
    setProcessingBulk(true)
    setConfirmLoading(true)
    try {
      await Promise.all(rows.map((b) => deleteDoc(doc(db, "branches", b.id))))
      setSuccess(`Deleted ${rows.length} branch${rows.length === 1 ? "" : "es"}`)
      setTimeout(() => setSuccess(null), 2500)
      setSelectedIds(new Set())
      setPendingConfirm(null)
      await loadBranches()
    } catch (err: any) {
      setError(err?.message || "Bulk delete failed")
    } finally {
      setProcessingBulk(false)
      setConfirmLoading(false)
    }
  }

  const statusVariant = (status: Branch["status"]): StatusVariant =>
    status === "active" ? "success" : "neutral"

  const branchColumns: EnterpriseColumn<BranchRow>[] = [
    {
      key: "name",
      header: "Branch",
      width: "w-[16%]",
      sortable: true,
      render: (b) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{b.name}</p>
          <p className="truncate font-mono text-[10px] text-slate-400">{b.id.slice(0, 10)}…</p>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      hideBelow: "sm",
      sortable: true,
      render: (b) => <span className="text-xs text-slate-700">{parseCity(b.location)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (b) => (
        <StatusPill
          label={b.status === "active" ? "Active" : "Inactive"}
          variant={statusVariant(b.status)}
        />
      ),
    },
    {
      key: "doctors",
      header: "Doctors",
      hideBelow: "md",
      align: "right",
      render: () => <span className="text-xs tabular-nums text-slate-400">—</span>,
    },
    {
      key: "staff",
      header: "Staff",
      hideBelow: "md",
      align: "right",
      render: () => <span className="text-xs tabular-nums text-slate-400">—</span>,
    },
    {
      key: "beds",
      header: "Beds",
      hideBelow: "lg",
      align: "right",
      render: () => <span className="text-xs tabular-nums text-slate-400">—</span>,
    },
    {
      key: "todayPatients",
      header: "Today's Patients",
      hideBelow: "lg",
      align: "right",
      render: () => <span className="text-xs tabular-nums text-slate-400">—</span>,
    },
    {
      key: "revenueToday",
      header: "Revenue Today",
      hideBelow: "lg",
      align: "right",
      render: () => <span className="text-xs tabular-nums text-slate-400">—</span>,
    },
    {
      key: "manager",
      header: "Manager",
      hideBelow: "lg",
      render: () => <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: "updatedAt",
      header: "Last Updated",
      hideBelow: "md",
      sortable: true,
      render: (b) => (
        <span className="text-xs text-slate-600">{formatBranchDate(b.updatedAt || b.createdAt)}</span>
      ),
    },
  ]

  const branchRowActions: EnterpriseRowAction<BranchRow>[] = [
    {
      label: "View",
      onClick: (b) => openDetails(b),
    },
    {
      label: "Edit",
      onClick: (b) => {
        openDetails(b)
      },
    },
    {
      label: "Deactivate",
      variant: "warning",
      hidden: (b) => b.status !== "active",
      onClick: (b) => setPendingConfirm({ type: "deactivate", branch: b }),
    },
    {
      label: "Delete",
      variant: "danger",
      onClick: (b) => setPendingConfirm({ type: "delete", branch: b }),
    },
  ]

  const branchBulkActions: EnterpriseBulkAction<BranchRow>[] = [
    {
      label: "Export selected",
      onClick: (rows) => {
        exportBranchesCsv(rows)
        setSuccess(`Exported ${rows.length} branch${rows.length === 1 ? "" : "es"}`)
        setTimeout(() => setSuccess(null), 2200)
      },
    },
    {
      label: "Deactivate",
      onClick: (rows) => {
        const active = rows.filter((r) => r.status === "active")
        if (!active.length) return
        setPendingConfirm({ type: "bulk-deactivate", rows })
      },
    },
    {
      label: "Delete",
      variant: "danger",
      onClick: (rows) => setPendingConfirm({ type: "bulk-delete", rows }),
    },
  ]

  const formatRevenue = (n?: number) => {
    if (n == null || Number.isNaN(n)) return "—"
    return `₹${Math.round(n).toLocaleString("en-IN")}`
  }

  const formatCount = (n?: number | null) => {
    if (n == null || Number.isNaN(n)) return "—"
    return String(n)
  }

  if (!activeHospitalId) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-6">
        <p className="text-sm font-medium text-rose-700">
          No hospital selected. Choose a hospital from the header to manage branches.
        </p>
      </div>
    )
  }

  const kpiCards = [
    { key: "total", label: "Total Branches", value: String(branches.length), hint: "Configured" },
    { key: "active", label: "Active Branches", value: String(activeCount), hint: "Operational" },
    { key: "doctors", label: "Doctors", value: formatCount(kpi?.doctors), hint: "Hospital roster" },
    { key: "staff", label: "Staff", value: formatCount(kpi?.staff ?? null), hint: "Reception · Pharmacy" },
    {
      key: "apts",
      label: "Today's Appointments",
      value: formatCount(kpi?.todayAppointments),
      hint: selectedBranchId === "all" ? "All branches" : "Filtered branch",
    },
    {
      key: "revenue",
      label: "Today's Revenue",
      value: formatRevenue(kpi?.todayRevenue),
      hint: "Completed visits",
    },
  ]

  return (
    <div className="camp-crm branch-crm">
      {error && (
        <Notification type="error" message={error} onClose={() => setError(null)} />
      )}
      {success && (
        <Notification type="success" message={success} onClose={() => setSuccess(null)} />
      )}

      {loading && branches.length === 0 ? (
        <BranchCrmSkeleton />
      ) : (
        <>
      <div className="camp-crm-toolbar">
        <div className="camp-crm-toolbar-meta min-w-0">
          <div>
            <p className="camp-crm-eyebrow">Operations control</p>
            <p className="camp-crm-title truncate">
              {branches.length} sites · {activeCount} active
              {selectedBranchId !== "all" ? " · filtered" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadBranches()}
            loading={loading}
            loadingText="…"
          >
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exportBranchesCsv()}>
            Export
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            Add Branch
          </Button>
        </div>
      </div>

      <div className="camp-crm-kpi-grid">
        {kpiCards.map((card) => (
          <div key={card.key} className="camp-crm-kpi">
            <p className="camp-crm-kpi-label">{card.label}</p>
            <p className="camp-crm-kpi-value">{card.value}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="branch-crm-workspace">
        <aside className="camp-crm-panel">
          <div className="branch-crm-seg">
            <button
              type="button"
              onClick={openCreate}
              className={`branch-crm-seg-btn ${panelMode === "create" ? "branch-crm-seg-btn--active" : ""}`}
            >
              Create Branch
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedBranch) {
                  setPanelMode("details")
                  return
                }
                const first = filteredBranches[0]
                if (first) {
                  setSelectedId(first.id)
                  setPanelMode("details")
                  setDrawerOpen(false)
                }
              }}
              className={`branch-crm-seg-btn ${panelMode === "details" ? "branch-crm-seg-btn--active" : ""}`}
            >
              Branch Details
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {panelMode === "create" ? (
              <CreateBranchPanel
                key={createKey}
                saving={saving}
                onSave={handleCreateBranch}
                onCancel={() => {
                  setCreateKey((k) => k + 1)
                  if (selectedBranch) setPanelMode("details")
                }}
              />
            ) : selectedBranch ? (
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill
                    label={selectedBranch.status === "active" ? "Active" : "Inactive"}
                    variant={statusVariant(selectedBranch.status)}
                  />
                  <span className="text-[10px] font-medium text-slate-400">
                    Updated {formatBranchDate(selectedBranch.updatedAt || selectedBranch.createdAt)}
                  </span>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">
                    {selectedBranch.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {selectedBranch.location || "No location on file"}
                  </p>
                </div>
                <dl className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">City</dt>
                    <dd className="font-semibold text-slate-800">{parseCity(selectedBranch.location)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Branch ID</dt>
                    <dd className="truncate font-mono text-[10px] text-slate-600">{selectedBranch.id}</dd>
                  </div>
                </dl>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Operating hours
                  </p>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-100 bg-white p-1.5">
                    {DAY_ORDER.map((day) => {
                      const slot = selectedBranch.timings?.[day]
                      return (
                        <li
                          key={day}
                          className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <span className="capitalize text-slate-500">{day.slice(0, 3)}</span>
                          <span className="font-medium tabular-nums text-slate-800">
                            {slot ? `${slot.start}–${slot.end}` : "Closed"}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <Button type="button" size="sm" className="w-full" onClick={() => setDrawerOpen(true)}>
                    Open overview drawer
                  </Button>
                  {selectedBranch.status === "active" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => void handleDeactivate(selectedBranch)}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="camp-crm-empty py-8">
                <div className="camp-crm-empty-icon">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <p className="camp-crm-empty-title">No branch selected</p>
                <p className="camp-crm-empty-desc">
                  Select a row to inspect hours and status, or create a new site.
                </p>
                <Button type="button" size="sm" onClick={openCreate}>
                  Create branch
                </Button>
              </div>
            )}
          </div>
        </aside>

        <section className="camp-crm-panel overflow-hidden">
          <EnterpriseDataTable
            data={paginatedBranches}
            columns={branchColumns}
            loading={loading && branches.length > 0}
            loadingVariant="skeleton"
            emptyTitle={
              searchTerm || statusFilter !== "all" || selectedBranchId !== "all"
                ? "No matching branches"
                : "No branches configured"
            }
            emptyDescription={
              searchTerm || statusFilter !== "all" || selectedBranchId !== "all"
                ? "Adjust search or status filters to widen results."
                : "Add your first site to unlock multi-location operations across pharmacy, reception, and reporting."
            }
            emptyAction={
              searchTerm || statusFilter !== "all" || selectedBranchId !== "all"
                ? {
                    label: "Clear filters",
                    onClick: () => {
                      setSearchTerm("")
                      setStatusFilter("all")
                      setSelectedBranchId("all")
                    },
                  }
                : { label: "Add Branch", onClick: openCreate }
            }
            toolbar={
              <div className="space-y-1.5 border-b border-slate-100 bg-white px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="camp-crm-section-title">Branch directory</h3>
                    <p className="camp-crm-section-sub">
                      {filteredBranches.length} of {branches.length} sites
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative min-w-[11rem]">
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
                        placeholder="Search sites…"
                        className="camp-crm-input h-8 w-full pl-7"
                      />
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => exportBranchesCsv()}>
                      Export
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <FilterChip
                    active={statusFilter === "all"}
                    count={branches.length}
                    onClick={() => setStatusFilter("all")}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    active={statusFilter === "active"}
                    count={activeCount}
                    onClick={() => setStatusFilter("active")}
                  >
                    Active
                  </FilterChip>
                  <FilterChip
                    active={statusFilter === "inactive"}
                    count={branches.filter((b) => b.status === "inactive").length}
                    onClick={() => setStatusFilter("inactive")}
                  >
                    Inactive
                  </FilterChip>
                </div>
              </div>
            }
            enableSearch={false}
            enableFilters={false}
            selectable
            selectedIds={selectedIds}
            onToggleRow={toggleSelect}
            onToggleAll={toggleSelectAllPage}
            onClearSelection={() => setSelectedIds(new Set())}
            bulkActions={branchBulkActions}
            processingBulk={processingBulk}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(b) => openDetails(b)}
            getRowClassName={(b) => (selectedId === b.id ? "bg-cyan-50/60" : undefined)}
            primaryAction={{
              label: "View",
              onClick: (b) => openDetails(b),
            }}
            rowActions={branchRowActions}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredBranches.length}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 15, 20]}
            showPageSize
            itemLabel="branches"
            minWidth="min-w-[1100px]"
            variant="flat"
            className="border-0 shadow-none rounded-none"
          />
        </section>
      </div>
        </>
      )}

      <BranchDetailDrawer
        open={drawerOpen}
        branch={selectedBranch}
        metrics={{
          doctors: kpi?.doctors ?? null,
          staff: kpi?.staff ?? null,
          todayPatients: kpi?.todayAppointments ?? null,
          revenue: kpi?.todayRevenue ?? null,
          bedOccupancyPct: null,
        }}
        onClose={closeDrawer}
        onEdit={() => {
          if (!selectedBranch) return
          setPanelMode("details")
          setSuccess("Edit stays on this page — use Branch Details on the left to review, or Add Branch to create another.")
          setTimeout(() => setSuccess(null), 3200)
        }}
        onAssignStaff={() => {
          setSuccess("Assign Staff stays on this page — staff assignment opens here when staffing tools are connected.")
          setTimeout(() => setSuccess(null), 3200)
        }}
        onAssignDoctors={() => {
          setSuccess("Assign Doctors stays on this page — doctor assignment opens here when roster tools are connected.")
          setTimeout(() => setSuccess(null), 3200)
        }}
        onViewReports={() => {
          setSuccess("View Reports stays on this page — branch reports open in-panel when analytics are connected.")
          setTimeout(() => setSuccess(null), 3200)
        }}
        onDeactivate={
          selectedBranch?.status === "active"
            ? () => setPendingConfirm({ type: "deactivate", branch: selectedBranch })
            : undefined
        }
      />

      <ConfirmDialog
        isOpen={!!pendingConfirm}
        title={
          pendingConfirm?.type === "deactivate" || pendingConfirm?.type === "bulk-deactivate"
            ? "Deactivate branch"
            : "Delete branch"
        }
        message={
          pendingConfirm?.type === "deactivate"
            ? `Deactivate “${pendingConfirm.branch.name}”? It will no longer appear in active branch lists.`
            : pendingConfirm?.type === "delete"
              ? `Delete “${pendingConfirm.branch.name}” permanently? This cannot be undone.`
              : pendingConfirm?.type === "bulk-deactivate"
                ? (() => {
                    const active = pendingConfirm.rows.filter((r) => r.status === "active")
                    return `Deactivate ${active.length} branch${active.length === 1 ? "" : "es"}?`
                  })()
                : pendingConfirm?.type === "bulk-delete"
                  ? `Permanently delete ${pendingConfirm.rows.length} branch${pendingConfirm.rows.length === 1 ? "" : "es"}?`
                  : ""
        }
        confirmText={
          pendingConfirm?.type === "deactivate" || pendingConfirm?.type === "bulk-deactivate"
            ? "Deactivate"
            : "Delete"
        }
        cancelText="Cancel"
        confirmLoading={confirmLoading || processingBulk}
        confirmVariant={
          pendingConfirm?.type === "delete" || pendingConfirm?.type === "bulk-delete"
            ? "danger"
            : "primary"
        }
        onCancel={() => {
          if (confirmLoading || processingBulk) return
          setPendingConfirm(null)
        }}
        onConfirm={async () => {
          if (!pendingConfirm) return
          if (pendingConfirm.type === "deactivate") {
            await handleDeactivate(pendingConfirm.branch)
            setDrawerOpen(false)
          } else if (pendingConfirm.type === "delete") {
            await handleDelete(pendingConfirm.branch)
          } else if (pendingConfirm.type === "bulk-deactivate") {
            await handleBulkDeactivate(pendingConfirm.rows)
          } else if (pendingConfirm.type === "bulk-delete") {
            await handleBulkDelete(pendingConfirm.rows)
          }
        }}
      />
    </div>
  )
}

function BranchCrmSkeleton() {
  return (
    <div className="camp-crm branch-crm" aria-busy="true" aria-label="Loading branch control center">
      <div className="camp-crm-toolbar">
        <div className="space-y-1.5">
          <div className="camp-crm-skel camp-crm-skel-block w-24" />
          <div className="camp-crm-skel camp-crm-skel-block h-3 w-40" />
        </div>
        <div className="flex gap-1.5">
          <div className="camp-crm-skel h-8 w-20 rounded-md" />
          <div className="camp-crm-skel h-8 w-16 rounded-md" />
          <div className="camp-crm-skel h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="camp-crm-kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="camp-crm-kpi">
            <div className="camp-crm-skel camp-crm-skel-block w-16" />
            <div className="camp-crm-skel mt-2.5 h-5 w-12 rounded-md" />
          </div>
        ))}
      </div>
      <div className="branch-crm-workspace">
        <div className="camp-crm-panel p-2.5">
          <div className="camp-crm-skel mb-2 h-8 w-full rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="camp-crm-skel h-8 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="camp-crm-panel p-2.5">
          <div className="camp-crm-skel camp-crm-skel-block mb-3 w-36" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="camp-crm-skel h-9 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
