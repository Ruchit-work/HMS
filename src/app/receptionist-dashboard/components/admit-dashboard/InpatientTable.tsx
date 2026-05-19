"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/Button"
import { TextField } from "@/components/ui/forms/TextField"
import { TableShell } from "@/components/ui/layout/TableShell"

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

const statusClassMap = {
  stable: "bg-emerald-50 text-emerald-700 border-emerald-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
  improving: "bg-sky-50 text-sky-700 border-sky-200",
} as const

export default function InpatientTable({ rows, loading, onView, onMore, focusTag }: InpatientTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [dateQuery, setDateQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return rows
    const compactQuery = query.replace(/[^a-z0-9]/g, "")
    return rows.filter((row) => {
      const text = `${row.ipdNo} ${row.patientName} ${row.patientMeta} ${row.roomBed} ${row.doctor}`.toLowerCase()
      const compactText = text.replace(/[^a-z0-9]/g, "")
      return text.includes(query) || compactText.includes(compactQuery)
    })
  }, [rows, searchQuery])
  const filteredByDateRows = useMemo(() => {
    if (!dateQuery) return filteredRows
    return filteredRows.filter((row) => (row.admittedDateISO || "").slice(0, 10) === dateQuery)
  }, [filteredRows, dateQuery])

  const totalPages = Math.max(1, Math.ceil(filteredByDateRows.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedRows = filteredByDateRows.slice(startIndex, startIndex + pageSize)

  if (loading && rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading admitted patients...</p>
  }
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No admitted patients right now.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
          <TextField
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search by IPD, patient, room, or doctor"
            className="sm:max-w-sm"
            aria-label="Search inpatients"
          />
          <TextField
            type="date"
            value={dateQuery}
            onChange={(e) => {
              setDateQuery(e.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter by admission date"
          />
          {dateQuery ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDateQuery("")
                setCurrentPage(1)
              }}
            >
              Clear date
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500 shrink-0">
          Showing {paginatedRows.length} of {filteredByDateRows.length} records
        </p>
      </div>
      <TableShell>
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-slate-50/90 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 sm:px-4 py-3 text-left">IPD No</th>
              <th className="px-3 sm:px-4 py-3 text-left">Patient</th>
              <th className="hidden md:table-cell px-4 py-3 text-left">Room / Bed</th>
              <th className="hidden lg:table-cell px-4 py-3 text-left">Doctor</th>
              <th className="px-3 sm:px-4 py-3 text-left">Admitted</th>
              <th className="px-3 sm:px-4 py-3 text-left">Status</th>
              <th className="px-3 sm:px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr
                key={row.id}
                className={`border-t border-slate-100 transition-colors hover:bg-[var(--color-primary)]/5 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
              >
                <td className="px-3 sm:px-4 py-3 font-mono text-xs text-slate-500">{row.ipdNo}</td>
                <td className="px-3 sm:px-4 py-3">
                  <p className="font-semibold text-slate-900">{row.patientName}</p>
                  <p className="text-xs text-slate-500">{row.patientMeta}</p>
                  <p className="mt-0.5 text-xs text-slate-500 md:hidden">{row.roomBed}</p>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-slate-700">{row.roomBed}</td>
                <td className="hidden lg:table-cell px-4 py-3 text-slate-700">{row.doctor}</td>
                <td className="px-3 sm:px-4 py-3 text-xs text-slate-500">{row.admittedOn}</td>
                <td className="px-3 sm:px-2.5 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    {focusTag ? (
                      <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700">
                        {focusTag}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex w-fit rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize leading-none ${statusClassMap[row.status]}`}
                    >
                      {row.status}
                    </span>
                    {row.dischargeRequested && (
                      <span className="inline-flex w-fit rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--color-primary-dark)]">
                        Discharge requested
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right">
                  <div className="flex flex-col items-stretch gap-1.5 sm:inline-flex sm:flex-row sm:items-center sm:justify-end sm:gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => onView(row.id)} className="w-full sm:w-auto">
                      Discharge
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMore(row.id)}
                      disabled={Boolean(row.dischargeRequested)}
                      className="w-full sm:w-auto"
                    >
                      Transfer
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      {filteredByDateRows.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-500">No matching admitted patients found.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export type { InpatientRow }
