"use client"

import { DataTable, StatusPill, AvatarCell } from '@/shared/components'
import type { DTColumn } from '@/shared/components'
import { Button } from '@/shared/components'

interface RequestRow {
  id: string
  patientName: string
  patientMeta: string
  doctorName: string
  department: string
  roomType: string
  priority: "high" | "medium" | "low"
  requestedAt: string
}

interface RequestTableProps {
  rows: RequestRow[]
  loading?: boolean
  onAssign: (id: string) => void
  assignDisabled?: boolean
}

export default function RequestTable({
  rows,
  loading,
  onAssign,
  assignDisabled = false,
}: RequestTableProps) {
  const columns: DTColumn<RequestRow>[] = [
    {
      key: "id",
      header: "ID",
      width: "w-[10%]",
      render: (row) => (
        <span className="font-mono text-[10px] text-slate-500">
          {row.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      width: "w-[22%]",
      render: (row) => (
        <AvatarCell name={row.patientName} sub={row.patientMeta} color="cyan" />
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      width: "w-[18%]",
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.doctorName}</p>
          <p className="text-xs text-slate-500">{row.department}</p>
        </div>
      ),
    },
    {
      key: "roomType",
      header: "Room Type",
      width: "w-[14%]",
      hideBelow: "md",
      render: (row) => (
        <span className="text-sm text-slate-700">{row.roomType}</span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: "w-[10%]",
      render: (row) => (
        <StatusPill
          label={row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
          variant={
            row.priority === "high"
              ? "danger"
              : row.priority === "medium"
              ? "warning"
              : "success"
          }
        />
      ),
    },
    {
      key: "requestedAt",
      header: "Requested",
      width: "w-[14%]",
      hideBelow: "md",
      render: (row) => (
        <span className="text-xs text-slate-500">{row.requestedAt}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      width: "w-[12%]",
      align: "right",
      render: (row) => (
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => onAssign(row.id)}
          disabled={assignDisabled}
        >
          Assign Room
        </Button>
      ),
    },
  ]

  return (
    <DataTable<RequestRow>
      data={rows}
      columns={columns}
      loading={loading && rows.length === 0}
      loadingMessage="Loading admission requests…"
      emptyTitle="No pending admission requests"
      emptyDescription="All admission requests have been processed."
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      }
      minWidth="min-w-[560px]"
      variant="flat"
    />
  )
}

export type { RequestRow }
