"use client"

import { useMemo, useState } from "react"
import { DataTable, StatusPill, AvatarCell } from "@/components/ui/data/DataTable"
import type { DTColumn, DTRowAction } from "@/components/ui/data/DataTable"

interface InpatientRow {
  id: string
  ipdNo: string
  patientName: string
  patientMeta: string
  roomBed: string
  doctor: string
  dischargeRequested?: boolean
  admittedOn: string
  admittedDateISO?: string
  status: "stable" | "critical" | "improving"
}

interface InpatientTableProps {
  rows: InpatientRow[]
  loading?: boolean
  onView: (id: string) => void
  onMore: (id: string) => void
  focusTag?: string | null
}

export default function InpatientTable({
  rows,
  loading,
  onView,
  onMore,
  focusTag,
}: InpatientTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [dateQuery, setDateQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rows
    const cq = q.replace(/[^a-z0-9]/g, "")
    return rows.filter((row) => {
      const text =
        `${row.ipdNo} ${row.patientName} ${row.patientMeta} ${row.roomBed} ${row.doctor}`.toLowerCase()
      const ct = text.replace(/[^a-z0-9]/g, "")
      return text.includes(q) || ct.includes(cq)
    })
  }, [rows, searchQuery])

  const filteredByDateRows = useMemo(() => {
    if (!dateQuery) return filteredRows
    return filteredRows.filter(
      (row) => (row.admittedDateISO || "").slice(0, 10) === dateQuery
    )
  }, [filteredRows, dateQuery])

  const totalPages = Math.max(1, Math.ceil(filteredByDateRows.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedRows = filteredByDateRows.slice(startIndex, startIndex + pageSize)

  const columns: DTColumn<InpatientRow>[] = [
    {
      key: "ipdNo",
      header: "IPD No",
      width: "w-[10%]",
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{row.ipdNo}</span>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      width: "w-[20%]",
      render: (row) => (
        <div>
          <AvatarCell
            name={row.patientName}
            sub={row.patientMeta}
            color="cyan"
          />
          <p className="mt-0.5 text-[10px] text-slate-400 md:hidden">
            {row.roomBed}
          </p>
        </div>
      ),
    },
    {
      key: "roomBed",
      header: "Room / Bed",
      width: "w-[14%]",
      hideBelow: "md",
      render: (row) => (
        <span className="text-sm text-slate-700">{row.roomBed}</span>
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      width: "w-[16%]",
      hideBelow: "lg",
      render: (row) => (
        <span className="text-sm text-slate-700">{row.doctor}</span>
      ),
    },
    {
      key: "admitted",
      header: "Admitted",
      width: "w-[12%]",
      render: (row) => (
        <span className="text-xs text-slate-500">{row.admittedOn}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[16%]",
      render: (row) => (
        <div className="flex flex-col gap-1">
          {focusTag && (
            <StatusPill label={focusTag} variant="warning" />
          )}
          <StatusPill
            label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            variant={
              row.status === "critical"
                ? "danger"
                : row.status === "improving"
                ? "blue"
                : "success"
            }
          />
          {row.dischargeRequested && (
            <StatusPill label="Discharge requested" variant="cyan" />
          )}
        </div>
      ),
    },
  ]

  const rowActions: DTRowAction<InpatientRow>[] = [
    {
      label: "Transfer patient",
      variant: "default",
      icon: (
        <svg
          className="h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      ),
      hidden: (row) => Boolean(row.dischargeRequested),
      onClick: (row) => onMore(row.id),
    },
  ]

  // Toolbar: search + date filter
  const toolbar = (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
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
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search IPD, patient, room, doctor…"
            aria-label="Search inpatients"
            className="w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 sm:w-64"
          />
        </div>
        {/* Date filter */}
        <div className="relative">
          <input
            type="date"
            value={dateQuery}
            onChange={(e) => {
              setDateQuery(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter by admission date"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>
        {dateQuery && (
          <button
            type="button"
            onClick={() => {
              setDateQuery("")
              setCurrentPage(1)
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear date
          </button>
        )}
      </div>
      <p className="shrink-0 text-xs text-slate-400">
        {filteredByDateRows.length} admitted patient
        {filteredByDateRows.length === 1 ? "" : "s"}
      </p>
    </div>
  )

  return (
    <DataTable<InpatientRow>
      data={paginatedRows}
      columns={columns}
      loading={loading && rows.length === 0}
      loadingMessage="Loading admitted patients…"
      emptyTitle={
        searchQuery || dateQuery
          ? "No matching patients found"
          : "No admitted patients right now"
      }
      emptyDescription={
        searchQuery || dateQuery
          ? "Try adjusting your search or date filter."
          : "Admitted patients will appear here once checked in."
      }
      emptyIcon={
        <svg
          className="h-7 w-7 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      }
      toolbar={toolbar}
      primaryAction={{
        label: "Discharge",
        icon: (
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        ),
        onClick: (row) => onView(row.id),
      }}
      rowActions={rowActions}
      currentPage={safePage}
      totalPages={totalPages}
      pageSize={pageSize}
      totalItems={filteredByDateRows.length}
      onPageChange={setCurrentPage}
      itemLabel="patients"
      showPageSize={false}
      minWidth="min-w-[640px]"
      variant="flat"
    />
  )
}

export type { InpatientRow }
