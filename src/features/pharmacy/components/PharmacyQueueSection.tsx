import React from 'react'
import { Button, ConfirmDialog, Notification } from '@/shared/components'
import { TabSkeleton } from '@/shared/components'
import { QueueFiltersBar } from '@/features/pharmacy/components/RealWorldUiBlocks'
import type { QueueItem } from '@/features/pharmacy/queueTypes'

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
  selectedQueueItem: QueueItem | null
  renderDispensePanel: (item: QueueItem) => React.ReactNode
  loading: boolean
  pendingQueue: QueueItem[]
  isViewOnly: boolean
  onSelectQueueItem: (item: QueueItem) => void
  onRemoveFromQueue: (item: QueueItem) => Promise<void> | void
  removingAppointmentId?: string | null
  onRefreshQueue: () => void
  onEnterFullscreen: () => void
  onExitFullscreen: () => void
}

function formatPrescriptionTime(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  onRemoveFromQueue,
  removingAppointmentId = null,
  onRefreshQueue,
  onEnterFullscreen,
  onExitFullscreen,
}: PharmacyQueueSectionProps) {
  const [queueSearch, setQueueSearch] = React.useState('')
  const [queueSort, setQueueSort] = React.useState<'oldest' | 'newest'>('oldest')
  const [showUrgentOnly, setShowUrgentOnly] = React.useState(false)
  const [viewItem, setViewItem] = React.useState<QueueItem | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<QueueItem | null>(null)

  const filteredQueue = React.useMemo(() => {
    const q = queueSearch.trim().toLowerCase()
    const withMeta = pendingQueue.map((item) => {
      const timeSource = item.prescriptionTime || item.appointmentDate
      const apptMs = Number.isNaN(new Date(timeSource).getTime()) ? 0 : new Date(timeSource).getTime()
      const waitingMinutes = apptMs > 0 ? Math.max(0, Math.floor((Date.now() - apptMs) / (60 * 1000))) : 0
      return { item, waitingMinutes, apptMs }
    })
    let list = withMeta.filter(({ item }) => {
      if (!q) return true
      return (
        item.patientName.toLowerCase().includes(q) ||
        item.doctorName.toLowerCase().includes(q) ||
        (item.patientId || '').toLowerCase().includes(q) ||
        item.appointmentId.toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.branchName || item.branchId || '').toLowerCase().includes(q)
      )
    })
    if (showUrgentOnly) list = list.filter(({ waitingMinutes }) => waitingMinutes >= 30)
    list.sort((a, b) => (queueSort === 'oldest' ? a.apptMs - b.apptMs : b.apptMs - a.apptMs))
    return list
  }, [pendingQueue, queueSearch, showUrgentOnly, queueSort])

  const confirmRemove = async () => {
    if (!removeTarget) return
    await onRemoveFromQueue(removeTarget)
    setRemoveTarget(null)
  }

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

        <div className="inline-flex rounded-full border border-[var(--color-neutral-200)] bg-[#F9FAFB] p-0.5 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onQueueInnerTabChange('walk_in')}
            className={`px-3 py-1.5 rounded-full transition ${
              queueInnerTab === 'walk_in'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
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
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Prescription queue
          </button>
        </div>

        {queueInnerTab === 'walk_in' && (
          <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white shadow-sm overflow-hidden min-h-[480px] lg:min-h-[calc(100vh-12rem)] flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col px-4 py-4 lg:px-5 lg:py-5">
              {renderWalkInPanel()}
            </div>
            <p className="px-4 pb-4 text-xs text-slate-500 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">F2</kbd> focus search · Scan barcode or type name
            </p>
          </div>
        )}

        {queueInnerTab === 'prescriptions' && (
          <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white shadow-sm overflow-hidden min-h-[320px] lg:min-h-[calc(100vh-16rem)] flex flex-col">
            {selectedQueueItem ? (
              renderDispensePanel(selectedQueueItem)
            ) : (
              <>
                <div className="shrink-0 px-4 py-3 border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">Prescription queue</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pending only · auto-expires after 24 hours · prescription history is never deleted
                    </p>
                  </div>
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
                  <TabSkeleton variant="table" />
                ) : (
                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm min-w-[980px]">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium text-slate-700">Patient Name</th>
                          <th className="text-left p-3 font-medium text-slate-700">Patient ID</th>
                          <th className="text-left p-3 font-medium text-slate-700">Appointment ID</th>
                          <th className="text-left p-3 font-medium text-slate-700">Doctor</th>
                          <th className="text-left p-3 font-medium text-slate-700">Department</th>
                          <th className="text-left p-3 font-medium text-slate-700">Prescription Time</th>
                          <th className="text-right p-3 font-medium text-slate-700">Medicine Count</th>
                          <th className="text-left p-3 font-medium text-slate-700">Status</th>
                          <th className="text-right p-3 font-medium text-slate-700 w-52">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQueue.slice(0, 50).map(({ item, waitingMinutes }) => (
                          <tr
                            key={item.appointmentId}
                            className={`border-t border-[var(--color-neutral-200)] transition ${
                              waitingMinutes >= 30 ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="p-3 font-medium text-slate-900">{item.patientName}</td>
                            <td className="p-3 font-mono text-xs text-slate-600">{item.patientId || '—'}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-500" title={item.appointmentId}>
                              {item.appointmentId.slice(0, 10)}…
                            </td>
                            <td className="p-3 text-slate-700">{item.doctorName}</td>
                            <td className="p-3 text-slate-600">{item.department || '—'}</td>
                            <td className="p-3 text-slate-600 whitespace-nowrap">
                              {formatPrescriptionTime(item.prescriptionTime || item.appointmentDate)}
                            </td>
                            <td className="p-3 text-right text-slate-700 tabular-nums">
                              {item.medicineCount ?? item.medicines.length}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                Pending
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setViewItem(item)}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  View
                                </button>
                                {item.branchId ? (
                                  isViewOnly ? (
                                    <span className="text-slate-400 text-xs">Select branch</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onSelectQueueItem(item)}
                                      disabled={!hasActiveCashSession}
                                      title={
                                        !hasActiveCashSession
                                          ? 'Start a cash session first (Cash & expenses → Start shift)'
                                          : ''
                                      }
                                      className="inline-flex items-center rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Dispense
                                    </button>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-xs">No branch</span>
                                )}
                                {!isViewOnly && (
                                  <button
                                    type="button"
                                    onClick={() => setRemoveTarget(item)}
                                    disabled={removingAppointmentId === item.appointmentId}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
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
                            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
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
            <span className="text-xs text-slate-500">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono">Esc</kbd> to exit
            </span>
          </>
        )}
      </div>

      {/* View Prescription modal */}
      {viewItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900">View Prescription</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {viewItem.patientName} · {viewItem.doctorName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-400">Patient ID</dt>
                  <dd className="mt-0.5 font-mono text-slate-700">{viewItem.patientId || '—'}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-400">Appointment ID</dt>
                  <dd className="mt-0.5 font-mono text-slate-700 break-all">{viewItem.appointmentId}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-400">Department</dt>
                  <dd className="mt-0.5 text-slate-700">{viewItem.department || '—'}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-400">Status</dt>
                  <dd className="mt-0.5 font-semibold text-amber-700">Pending</dd>
                </div>
              </dl>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Medicines</p>
                <ul className="space-y-2">
                  {viewItem.medicines.map((med, idx) => (
                    <li key={`${med.name}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-800">{med.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[med.dosage, med.frequency, med.duration].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
              <Button type="button" variant="outline" onClick={() => setViewItem(null)}>
                Close
              </Button>
              {!isViewOnly && viewItem.branchId && (
                <Button
                  type="button"
                  onClick={() => {
                    setViewItem(null)
                    onSelectQueueItem(viewItem)
                  }}
                  disabled={!hasActiveCashSession}
                >
                  Dispense
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        title="Remove from Queue"
        message={
          removeTarget
            ? 'Remove this prescription from the pharmacy queue?\n\nThe prescription will remain in the patient\'s medical history.'
            : ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="danger"
        confirmLoading={Boolean(removeTarget && removingAppointmentId === removeTarget.appointmentId)}
        onConfirm={confirmRemove}
        onCancel={() => {
          if (!removingAppointmentId) setRemoveTarget(null)
        }}
      />
    </div>
  )
}
