"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import {
  AUDIT_ACTIONS,
  AUDIT_MODULES,
  type AuditLogRecord,
} from "@/shared/types/audit"

type Filters = {
  dateFrom: string
  dateTo: string
  module: string
  user: string
  action: string
  search: string
}

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  module: "",
  user: "",
  action: "",
  search: "",
}

const inputClass =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"

export default function AuditLogs() {
  const { activeHospitalId } = useMultiHospital()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([])
  const pageNumber = cursorHistory.length + 1

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ pageSize: "25" })
    if (activeHospitalId) params.set("hospitalId", activeHospitalId)
    if (cursor) params.set("cursor", cursor)
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim())
    })
    return params.toString()
  }, [activeHospitalId, appliedFilters, cursor])

  const loadLogs = useCallback(async () => {
    if (!activeHospitalId) {
      setLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const data = await authedFetchJson<{
        logs: AuditLogRecord[]
        nextCursor: string | null
      }>(`/api/admin/audit-logs?${queryString}`, {}, "Failed to load audit logs")
      setLogs(data.logs || [])
      setNextCursor(data.nextCursor || null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId, queryString])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const applyFilters = () => {
    setCursor(null)
    setCursorHistory([])
    setAppliedFilters(filters)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setCursor(null)
    setCursorHistory([])
  }

  const goNext = () => {
    if (!nextCursor) return
    setCursorHistory((previous) => [...previous, cursor])
    setCursor(nextCursor)
  }

  const goPrevious = () => {
    const previous = [...cursorHistory]
    const previousCursor = previous.pop() ?? null
    setCursorHistory(previous)
    setCursor(previousCursor)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Audit Logs</h2>
              <p className="mt-1 text-sm text-slate-500">
                Immutable history of critical business events for the selected hospital.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Module
            <select
              value={filters.module}
              onChange={(event) => setFilters({ ...filters, module: event.target.value })}
              className={inputClass}
            >
              <option value="">All modules</option>
              {AUDIT_MODULES.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Action
            <select
              value={filters.action}
              onChange={(event) => setFilters({ ...filters, action: event.target.value })}
              className={inputClass}
            >
              <option value="">All actions</option>
              {Object.values(AUDIT_ACTIONS).map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            User
            <input
              value={filters.user}
              onChange={(event) => setFilters({ ...filters, user: event.target.value })}
              placeholder="Name or user ID"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Search
            <span className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters()
                }}
                placeholder="Summary, ID, source"
                className={`${inputClass} w-full pl-9`}
              />
            </span>
          </label>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={clearFilters} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Clear
          </button>
          <button type="button" onClick={applyFilters} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
            Apply filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error && <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Time", "User", "Role", "Action", "Module", "Summary", "Source"].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Loading audit logs…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">No critical events match these filters.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">{log.performedByName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs capitalize text-slate-500">{log.performedByRole.replaceAll("_", " ")}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">{log.action}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{log.module}</td>
                    <td className="min-w-72 px-4 py-3 text-sm text-slate-700">{log.summary}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{log.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <span className="text-xs text-slate-500">Page {pageNumber} · {logs.length} records</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goPrevious}
              disabled={cursorHistory.length === 0 || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!nextCursor || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
