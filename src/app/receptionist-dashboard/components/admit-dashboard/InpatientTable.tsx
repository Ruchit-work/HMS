"use client"

import { useMemo, useState } from "react"

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
    return rows.filter((row) => {
      const text = `${row.ipdNo} ${row.patientName} ${row.patientMeta} ${row.roomBed} ${row.doctor}`.toLowerCase()
      return text.includes(query)
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
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search by IPD, patient, room, or doctor"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
          />
          <input
            type="date"
            value={dateQuery}
            onChange={(e) => {
              setDateQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {dateQuery ? (
            <button
              type="button"
              onClick={() => {
                setDateQuery("")
                setCurrentPage(1)
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear date
            </button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Showing {paginatedRows.length} of {filteredByDateRows.length} records
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/90 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">IPD No</th>
            <th className="px-4 py-3 text-left">Patient</th>
            <th className="px-4 py-3 text-left">Room / Bed</th>
            <th className="px-4 py-3 text-left">Doctor</th>
            <th className="px-4 py-3 text-left">Admitted On</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map((row, index) => (
            <tr key={row.id} className={`border-t border-slate-100 transition-colors hover:bg-violet-50/30 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.ipdNo}</td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{row.patientName}</p>
                <p className="text-xs text-slate-500">{row.patientMeta}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{row.roomBed}</td>
              <td className="px-4 py-3 text-slate-700">{row.doctor}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{row.admittedOn}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-col gap-0.5">
                  {focusTag ? (
                    <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700">
                      {focusTag}
                    </span>
                  ) : null}
                  <span className={`inline-flex w-fit rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize leading-none ${statusClassMap[row.status]}`}>
                    {row.status}
                  </span>
                  {row.dischargeRequested && (
                    <span className="inline-flex w-fit rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-violet-700">
                      Doctor requested discharge
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    onClick={() => onView(row.id)}
                    className="min-w-[120px] rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                  >
                    Start Discharge
                  </button>
                  <button
                    onClick={() => onMore(row.id)}
                    disabled={Boolean(row.dischargeRequested)}
                    className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Room Transfer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
      {filteredByDateRows.length === 0 ? (
        <p className="py-3 text-center text-sm text-slate-500">No matching admitted patients found.</p>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export type { InpatientRow }
