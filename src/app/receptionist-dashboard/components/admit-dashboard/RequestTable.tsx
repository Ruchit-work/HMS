"use client"

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
}

const priorityClassMap = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
} as const

export default function RequestTable({ rows, loading, onAssign }: RequestTableProps) {
  if (loading && rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading admission requests...</p>
  }
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">No pending admission requests.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Patient</th>
            <th className="px-3 py-2 text-left">Doctor</th>
            <th className="px-3 py-2 text-left">Room Type</th>
            <th className="px-3 py-2 text-left">Priority</th>
            <th className="px-3 py-2 text-left">Requested At</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.id}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-xs font-semibold text-violet-700 flex items-center justify-center">
                    {row.patientName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{row.patientName}</p>
                    <p className="text-xs text-slate-500">{row.patientMeta}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium text-slate-800">{row.doctorName}</p>
                <p className="text-xs text-slate-500">{row.department}</p>
              </td>
              <td className="px-3 py-3 text-slate-700">{row.roomType}</td>
              <td className="px-3 py-3">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityClassMap[row.priority]}`}>
                  {row.priority}
                </span>
              </td>
              <td className="px-3 py-3 text-xs text-slate-500">{row.requestedAt}</td>
              <td className="px-3 py-3 text-right">
                <button
                  onClick={() => onAssign(row.id)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  Assign Room
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export type { RequestRow }
