import React from 'react'
import Notification from '@/components/ui/feedback/Notification'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import { QueueFiltersBar } from './components/RealWorldUiBlocks'

type QueueListItem = {
  appointmentId: string
  patientName: string
  doctorName: string
  appointmentDate: string
  branchId?: string
  branchName?: string
  medicineText: string
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  dispensed: boolean
}

type QueueInnerTab = 'walk_in' | 'prescriptions'

type PharmacyQueueSectionProps = {
  queueContainerRef: React.RefObject<HTMLDivElement | null>
  isQueueFullscreen: boolean
  error: string | null
  success: string | null
  onClearError: () => void
  onClearSuccess: () => void
  cashSessionsLoading: boolean
  hasActiveCashSession: boolean
  onGoToCashAndExpenses: () => void
  queueInnerTab: QueueInnerTab
  onQueueInnerTabChange: (tab: QueueInnerTab) => void
  renderWalkInPanel: () => React.ReactNode
  selectedQueueItem: QueueListItem | null
  renderDispensePanel: (item: QueueListItem) => React.ReactNode
  loading: boolean
  pendingQueue: QueueListItem[]
  isViewOnly: boolean
  onSelectQueueItem: (item: QueueListItem) => void
  onRefreshQueue: () => void
  onEnterFullscreen: () => void
  onExitFullscreen: () => void
}

export function PharmacyQueueSection({
  queueContainerRef,
  isQueueFullscreen,
  error,
  success,
  onClearError,
  onClearSuccess,
  cashSessionsLoading,
  hasActiveCashSession,
  onGoToCashAndExpenses,
  queueInnerTab,
  onQueueInnerTabChange,
  renderWalkInPanel,
  selectedQueueItem,
  renderDispensePanel,
  loading,
  pendingQueue,
  isViewOnly,
  onSelectQueueItem,
  onRefreshQueue,
  onEnterFullscreen,
  onExitFullscreen,
}: PharmacyQueueSectionProps) {
  const [queueSearch, setQueueSearch] = React.useState('')
  const [queueSort, setQueueSort] = React.useState<'oldest' | 'newest'>('oldest')
  const [showUrgentOnly, setShowUrgentOnly] = React.useState(false)
  const filteredQueue = React.useMemo(() => {
    const q = queueSearch.trim().toLowerCase()
    const withMeta = pendingQueue.map((item) => {
      const apptMs = Number.isNaN(new Date(item.appointmentDate).getTime()) ? 0 : new Date(item.appointmentDate).getTime()
      const waitingMinutes = apptMs > 0 ? Math.max(0, Math.floor((Date.now() - apptMs) / (60 * 1000))) : 0
      return { item, waitingMinutes, apptMs }
    })
    let list = withMeta.filter(({ item }) => {
      if (!q) return true
      return (
        item.patientName.toLowerCase().includes(q) ||
        item.doctorName.toLowerCase().includes(q) ||
        (item.branchName || item.branchId || '').toLowerCase().includes(q)
      )
    })
    if (showUrgentOnly) list = list.filter(({ waitingMinutes }) => waitingMinutes >= 30)
    list.sort((a, b) => (queueSort === 'oldest' ? a.apptMs - b.apptMs : b.apptMs - a.apptMs))
    return list
  }, [pendingQueue, queueSearch, showUrgentOnly, queueSort])

  return (
    <div
      ref={queueContainerRef}
      className={`flex flex-col min-h-[480px] bg-white rounded-xl overflow-hidden ${isQueueFullscreen ? 'h-screen min-h-0 overflow-y-auto' : ''}`}
      data-fullscreen={isQueueFullscreen ? '' : undefined}
    >
      {isQueueFullscreen && error && (
        <Notification type="error" message={error} onClose={onClearError} />
      )}
      {isQueueFullscreen && success && (
        <Notification type="success" message={success} onClose={onClearSuccess} />
      )}

      <div className={isQueueFullscreen ? 'flex flex-col space-y-4 p-1' : 'flex-1 min-h-0 flex flex-col space-y-4 p-1 overflow-y-auto'}>
        {!cashSessionsLoading && !hasActiveCashSession && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span className="font-medium">Start a cash session to complete sales and returns.</span>
            <span>
              Go to{' '}
              <button
                type="button"
                onClick={onGoToCashAndExpenses}
                className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
              >
                Cash & expenses
              </button>
              {' '}and click <strong>Start shift</strong>.
            </span>
          </div>
        )}

        <div className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F9FAFB] p-0.5 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onQueueInnerTabChange('walk_in')}
            className={`px-3 py-1.5 rounded-full transition ${
              queueInnerTab === 'walk_in'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Walk-in customer
          </button>
          <button
            type="button"
            onClick={() => onQueueInnerTabChange('prescriptions')}
            className={`px-3 py-1.5 rounded-full transition ${
              queueInnerTab === 'prescriptions'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Prescription queue
          </button>
        </div>

        {queueInnerTab === 'walk_in' && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden min-h-[480px] lg:min-h-[calc(100vh-12rem)] flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col px-4 py-4 lg:px-5 lg:py-5">
              {renderWalkInPanel()}
            </div>
            <p className="px-4 pb-4 text-xs text-slate-500 border-t border-[#E5E7EB] bg-[#F8FAFC]">
              Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">F2</kbd> focus search · Scan barcode or type name
            </p>
          </div>
        )}

        {queueInnerTab === 'prescriptions' && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden min-h-[320px] lg:min-h-[calc(100vh-16rem)] flex flex-col">
            {selectedQueueItem ? (
              renderDispensePanel(selectedQueueItem)
            ) : (
              <>
                <div className="shrink-0 px-4 py-3 border-b border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Prescription queue</h3>
                  <span className="text-sm text-slate-600">{pendingQueue.length} pending</span>
                </div>
                <QueueFiltersBar
                  queueSearch={queueSearch}
                  onQueueSearchChange={setQueueSearch}
                  queueSort={queueSort}
                  onQueueSortChange={setQueueSort}
                  showUrgentOnly={showUrgentOnly}
                  onShowUrgentOnlyChange={setShowUrgentOnly}
                  onClear={() => {
                    setQueueSearch('')
                    setShowUrgentOnly(false)
                    setQueueSort('oldest')
                  }}
                  showClear={Boolean(queueSearch.trim() || showUrgentOnly || queueSort !== 'oldest')}
                />
                {loading ? (
                  <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium text-slate-700">Patient Name</th>
                          <th className="text-left p-3 font-medium text-slate-700">Doctor</th>
                          <th className="text-left p-3 font-medium text-slate-700">Prescription Date</th>
                          <th className="text-left p-3 font-medium text-slate-700">Wait</th>
                          <th className="text-right p-3 font-medium text-slate-700">Medicines</th>
                          <th className="text-left p-3 font-medium text-slate-700">Branch</th>
                          <th className="text-right p-3 font-medium text-slate-700 w-28">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQueue.slice(0, 50).map(({ item, waitingMinutes }) => (
                          <tr key={item.appointmentId} className={`border-t border-[#E5E7EB] transition ${waitingMinutes >= 30 ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/80'}`}>
                            <td className="p-3 font-medium text-slate-900">{item.patientName}</td>
                            <td className="p-3 text-slate-700">{item.doctorName}</td>
                            <td className="p-3 text-slate-600">{item.appointmentDate}</td>
                            <td className="p-3 text-slate-600">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                waitingMinutes >= 30 ? 'bg-rose-100 text-rose-700' : waitingMinutes >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {waitingMinutes} min
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-700">{item.medicines.length}</td>
                            <td className="p-3 text-slate-600">{item.branchName ?? item.branchId ?? '—'}</td>
                            <td className="p-3 text-right">
                              {item.branchId ? (
                                isViewOnly ? (
                                  <span className="text-slate-400 text-xs">Select branch to dispense</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onSelectQueueItem(item)}
                                    disabled={!hasActiveCashSession}
                                    title={!hasActiveCashSession ? 'Start a cash session first (Cash & expenses → Start shift)' : ''}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d4ed8] transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Dispense
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-400 text-xs">No branch</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredQueue.length === 0 && (
                      <div className="p-8 text-center text-sm">
                        <p className="text-slate-500">
                          {pendingQueue.length === 0
                            ? 'No pending prescriptions. Completed checkups with prescribed medicine appear here.'
                            : 'No queue entries match your current filters.'}
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={onRefreshQueue}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Refresh queue
                          </button>
                          <button
                            type="button"
                            onClick={() => onQueueInnerTabChange('walk_in')}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Go to Walk-in
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-start gap-2 py-2 pl-3 pr-2 border-t border-slate-200 bg-slate-50/80">
        {!isQueueFullscreen ? (
          <button
            type="button"
            onClick={onEnterFullscreen}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Full screen
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onExitFullscreen}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit full screen
            </button>
            <span className="text-xs text-slate-500">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono">Esc</kbd> to exit</span>
          </>
        )}
      </div>
    </div>
  )
}
