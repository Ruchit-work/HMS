"use client"

type ReportFilter = "daily" | "weekly" | "monthly" | "yearly" | "custom" | "all"
type ReportFormat = "pdf" | "excel"

interface ReportModalProps {
  isOpen: boolean
  filter: ReportFilter
  format: ReportFormat
  customStartDate: string
  customEndDate: string
  generating: boolean
  errorMessage?: string
  onClose: () => void
  onFilterChange: (value: ReportFilter) => void
  onFormatChange: (value: ReportFormat) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onGenerate: () => void
}

export function ReportModal({
  isOpen,
  filter,
  format,
  customStartDate,
  customEndDate,
  generating,
  errorMessage,
  onClose,
  onFilterChange,
  onFormatChange,
  onStartDateChange,
  onEndDateChange,
  onGenerate,
}: ReportModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Generate Patient Report</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Date Range</label>
            <select
              value={filter}
              onChange={(e) => onFilterChange(e.target.value as ReportFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="daily">Daily (Today)</option>
              <option value="weekly">Weekly (Last 7 days)</option>
              <option value="monthly">Monthly (Current month)</option>
              <option value="yearly">Yearly (Current year)</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Patients</option>
            </select>
          </div>

          {filter === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Report Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="pdf"
                  checked={format === "pdf"}
                  onChange={(e) => onFormatChange(e.target.value as ReportFormat)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-slate-700">PDF</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="excel"
                  checked={format === "excel"}
                  onChange={(e) => onFormatChange(e.target.value as ReportFormat)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-slate-700">Excel (.xlsx)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={generating}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


