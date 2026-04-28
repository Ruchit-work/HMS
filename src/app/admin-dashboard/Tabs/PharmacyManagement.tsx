'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { usePharmacyPortal } from '@/contexts/PharmacyPortalContext'
import type { PharmacyPortalTabId } from '@/contexts/PharmacyPortalContext'
import SubTabNavigation from '@/components/admin/SubTabNavigation'
import Notification from '@/components/ui/feedback/Notification'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Pagination from '@/components/ui/navigation/Pagination'
import { useTablePagination } from '@/hooks/useTablePagination'
import { RevealModal } from '@/components/ui/overlays/RevealModal'
import { ConfirmDialog } from '@/components/ui/overlays/Modals'
import { RefundCashModal } from '@/components/pharmacy/RefundCashModal'
import type { Branch } from '@/types/branch'
import type {
  PharmacyMedicine,
  BranchMedicineStock,
  MedicineBatch,
  PharmacySupplier,
  PharmacySale,
  LowStockAlert,
  ExpiryAlert,
  StockTransfer,
  PharmacyPurchaseOrder,
  PharmacyCashSession,
  PharmacyCashierProfile,
  PharmacyCounter,
  PharmacyExpense,
  PharmacyExpenseCategory,
} from '@/types/pharmacy'
import { generateBillPDFAndPrint } from '@/utils/pharmacy/billPrint'
import { BarcodeCameraScanner } from '@/components/pharmacy/BarcodeCameraScanner'
import { PharmacyQueueSection } from './pharmacy/PharmacyQueueSection'
import { createPharmacyApiClient } from './pharmacy/api/pharmacyApiClient'
import {
  ActionEmptyState,
  DaysCoverBadge,
  ShiftCloseChecklist,
  getTransferStatusMeta,
} from './pharmacy/components/RealWorldUiBlocks'
import { DispenseModal } from './pharmacy/components/DispenseModal'
import { AddStockForm } from './pharmacy/components/InventoryForms'
import { InventoryTabContent } from './pharmacy/components/InventoryTabContent'
import { AddMedicineForm, EditMinLevelModal } from './pharmacy/components/InventoryModals'
import { OrdersTabContent } from './pharmacy/components/OrdersTabContent'
import { OverviewTabContent } from './pharmacy/components/OverviewTabContent'
import { PharmacyBillingPanel } from './pharmacy/components/PharmacyBillingPanel'
import { ReportsTabContent } from './pharmacy/components/ReportsTabContent'
import { SalesTabContent } from './pharmacy/components/SalesTabContent'
import { CashExpensesDailyContent } from './pharmacy/components/CashExpensesDailyContent'
import { CashExpensesShiftContent } from './pharmacy/components/CashExpensesShiftContent'
import { SettingsTabContent } from './pharmacy/components/SettingsTabContent'
import { BarcodeScanInput, MedicineSearchSelect, POSMedicineSearch } from './pharmacy/components/SearchInputs'
import { SuppliersTabContent } from './pharmacy/components/SuppliersTabContent'
import { AddSupplierForm, EditSupplierForm } from './pharmacy/components/SupplierForms'
import { ReceiveByFileForm } from './pharmacy/components/StockTransferAndImportForms'
import { TransfersTabContent } from './pharmacy/components/TransfersTabContent'
import { AddPharmacistModalContent } from './pharmacy/components/UserManagementForms'
import { MedicineFileUploader, OrderFileUploader } from './pharmacy/components/Uploaders'
import { UsersTabContent } from './pharmacy/components/UsersTabContent'
import { WalkInSaleForm } from './pharmacy/components/WalkInSaleForm'
import { CASH_DENOMS, PHARMACY_UI, RETURN_REASON_OPTIONS, createEmptyCashNotes } from './pharmacy/constants'
import {
  computeCloseShiftPreview,
  computeDailySummary,
  computeDailySummaryDayRows,
  computeDailySummaryRows,
  computePeriodSummaries,
  computeRecentSalesToday,
  computeSessionSales,
  filterDailySummaryDayRows,
  filterShiftReports,
  type DailySummarySalesSort,
} from './pharmacy/cashExpenseSummaries'
import {
  buildExpiryReportRows,
  buildInventoryHealthDonut,
  buildInventorySummary,
  buildOverUnderStockRows,
  buildRecentDailyConsumptionByBranchMedicine,
  buildReorderSuggestionRows,
  buildSalesByBranchRows,
  buildSalesByProductRows,
  buildStockSoldReportData,
  buildValuationReportRows,
} from './pharmacy/inventoryReports'
import {
  buildInventoryFilterRows,
  daysUntilExpiryForBatch,
  getNearestExpiry,
  type InventoryExpiryFilter,
  type InventoryStatusFilter,
} from './pharmacy/inventoryFilters'
import {
  buildReturnEvents,
  computeOrdersForTable,
  computePaymentModeSummary,
  computePoStatusCounts,
  computeTopSellingMedicines,
  computeTotalRefundForFilteredSales,
  filterCashiers,
  filterCounters,
  filterOverviewRecentSales,
  filterSalesRecords,
  filterSuppliers,
} from './pharmacy/commerceDerived'
import {
  computeCategoryDistribution,
  computeCategoryDonutData,
  computeInventoryHealthCounts,
  computeInventoryHealthItems,
  computeLast7DaysSales,
  computePeriodRefundTotal,
  computePeriodSalesCount,
  computePeriodSalesTotal,
  computePieChartData,
  computeRecordTotals,
  computeSalesTrendData,
  type OverviewDateRange,
  type RecordPeriod,
} from './pharmacy/overviewDerived'
import { downloadPurchaseOrderPDF, printPurchaseOrderPDF } from './pharmacy/purchaseOrderPdf'
import type { QueueItem } from './pharmacy/types'

type PharmacySubTab = 'overview' | 'inventory' | 'queue' | 'sales' | 'returns' | 'suppliers' | 'orders' | 'transfers' | 'analytics' | 'reports' | 'users' | 'cash_and_expenses' | 'settings'

export default function PharmacyManagement() {
  const { user: authUser } = useAuth()
  const pathname = usePathname()
  const isPharmacyPortal = pathname === '/pharmacy'
  const isAdmin = authUser?.role === 'admin'
  const { activeHospitalId, activeHospital, isSuperAdmin } = useMultiHospital()
  const portal = usePharmacyPortal()

  const [branchFilterLocal, setBranchFilterLocal] = useState<string>('all')
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<InventoryStatusFilter>('all')
  const [inventorySupplierFilter, setInventorySupplierFilter] = useState<string>('all')
  const [inventoryExpiryFilter, setInventoryExpiryFilter] = useState<InventoryExpiryFilter>('all')
  const [inventoryViewBatchesStock, setInventoryViewBatchesStock] = useState<BranchMedicineStock | null>(null)
  const [inventoryDetailView, setInventoryDetailView] = useState<{ stock: BranchMedicineStock; medicine: PharmacyMedicine | null } | null>(null)
  const [inventoryRowActionsOpen, setInventoryRowActionsOpen] = useState<string | null>(null)
  const [inventoryDeleteTarget, setInventoryDeleteTarget] = useState<BranchMedicineStock | null>(null)
  const [inventoryDeleteLoading, setInventoryDeleteLoading] = useState(false)
  const [branches, setBranchesState] = useState<Array<{ id: string; name: string }>>([])
  const branchFilter = isPharmacyPortal && portal ? portal.branchFilter : branchFilterLocal
  const setBranchFilter = isPharmacyPortal && portal ? (id: string) => portal.setBranchFilter(id) : setBranchFilterLocal

  const branchFilterRef = useRef(branchFilter)
  const portalRef = useRef(portal)
  branchFilterRef.current = branchFilter
  portalRef.current = portal

  const [subTabLocal, setSubTabLocal] = useState<PharmacySubTab>('queue')
  const subTab = (isPharmacyPortal && portal ? portal.activeTab : subTabLocal) as PharmacySubTab
  const headerSearchQuery = (isPharmacyPortal && portal ? portal.headerSearchQuery : '') || ''
  const setSubTab = (isPharmacyPortal && portal
    ? (id: PharmacySubTab) => portal.setActiveTab(id as PharmacyPortalTabId)
    : setSubTabLocal) as (id: PharmacySubTab) => void
  const [queueInnerTab, setQueueInnerTab] = useState<'walk_in' | 'prescriptions'>('walk_in')
  const [isQueueFullscreen, setIsQueueFullscreen] = useState(false)
  const queueFullscreenRef = useRef<HTMLDivElement>(null)
  const keepFullscreenAfterSaleRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([])
  const [stock, setStock] = useState<BranchMedicineStock[]>([])
  const [suppliers, setSuppliers] = useState<PharmacySupplier[]>([])
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([])
  const [expiring, setExpiring] = useState<ExpiryAlert[]>([])
  const [inventoryHealthFilter, setInventoryHealthFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock'>('all')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [dispenseQueueItem, setDispenseQueueItem] = useState<QueueItem | null>(null)
  const queuePosSearchRef = useRef<HTMLInputElement>(null)
  const [editMinLevelMedicine, setEditMinLevelMedicine] = useState<PharmacyMedicine | null>(null)
  const [sales, setSales] = useState<PharmacySale[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [pharmacists, setPharmacists] = useState<Array<{ id: string; email: string; firstName: string; lastName: string; branchName: string }>>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PharmacyPurchaseOrder[]>([])
  const [receiveOrder, setReceiveOrder] = useState<PharmacyPurchaseOrder | null>(null)
  const [receiveDetailsForm, setReceiveDetailsForm] = useState<Array<{ batchNumber: string; expiryDate: string; manufacturingDate: string }>>([])
  const [receiveSupplierInvoice, setReceiveSupplierInvoice] = useState('')
  const [receiveSubmitting, setReceiveSubmitting] = useState(false)
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<PharmacyPurchaseOrder | null>(null)
  const [cancelOrderSubmitting, setCancelOrderSubmitting] = useState(false)
  const [pendingAddToOrder, setPendingAddToOrder] = useState<{ medicineId: string; medicineName: string; quantity: number; manufacturer?: string } | null>(null)
  const [addMedicineModalBarcode, setAddMedicineModalBarcode] = useState<string | null>(null)
  const [addSupplierModalOpen, setAddSupplierModalOpen] = useState(false)
  const [viewSupplier, setViewSupplier] = useState<PharmacySupplier | null>(null)
  const [editSupplier, setEditSupplier] = useState<PharmacySupplier | null>(null)
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('')
  const [analytics, setAnalytics] = useState<{
    totalMedicines: number
    totalStockItems: number
    lowStockCount: number
    expiringCount: number
    dailySalesTotal: number
    mostPrescribed: Array<{ medicineName: string; count: number }>
  } | null>(null)
  const [selectedReturnSale, setSelectedReturnSale] = useState<PharmacySale | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [showRefundPaymentModal, setShowRefundPaymentModal] = useState(false)
  const [pendingReturnPayload, setPendingReturnPayload] = useState<{
    saleId: string
    lines: { medicineId: string; quantity: number }[]
    lineSummaries: Array<{ medicineName: string; quantity: number; unitPrice: number; amount: number }>
    refundAmount: number
    note: string
  } | null>(null)
  const [refundPaymentMode, setRefundPaymentMode] = useState<'cash' | 'upi' | 'card' | 'other'>('cash')
  const [returnReasonType, setReturnReasonType] = useState<'' | 'damaged' | 'wrong_medicine' | 'doctor_changed' | 'patient_request' | 'expired' | 'other'>('')
  const [returnReasonDetails, setReturnReasonDetails] = useState('')
  const [returnSupervisorName, setReturnSupervisorName] = useState('')
  const [showRefundCashModal, setShowRefundCashModal] = useState(false)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<PharmacySale | null>(null)
  const [salesSearch, setSalesSearch] = useState('')
  const [returnsSearch, setReturnsSearch] = useState('')
  const saleDetailRef = useRef<HTMLDivElement | null>(null)
  const [salesDate, setSalesDate] = useState<string>('')
  const [returnsDate, setReturnsDate] = useState<string>('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('all')
  const [returnsPaymentFilter, setReturnsPaymentFilter] = useState<string>('all')
  const [salesMinAmount, setSalesMinAmount] = useState<string>('')
  const [salesMaxAmount, setSalesMaxAmount] = useState<string>('')
  const [returnsMinAmount, setReturnsMinAmount] = useState<string>('')
  const [returnsMaxAmount, setReturnsMaxAmount] = useState<string>('')
  const [returnsInnerTab, setReturnsInnerTab] = useState<'by_sale' | 'by_return'>('by_sale')
  const [activeCashSession, setActiveCashSession] = useState<PharmacyCashSession | null>(null)
  const [recentCashSessions, setRecentCashSessions] = useState<PharmacyCashSession[]>([])
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false)
  const [viewShiftReportSession, setViewShiftReportSession] = useState<PharmacyCashSession | null>(null)
  const [shiftReportExpenses, setShiftReportExpenses] = useState<PharmacyExpense[]>([])
  const [cashOpeningNotes, setCashOpeningNotes] = useState<Record<string, string>>(() => createEmptyCashNotes())
  const [cashClosingNotes, setCashClosingNotes] = useState<Record<string, string>>(() => createEmptyCashNotes())
  const openCounterSectionRef = useRef<HTMLDivElement>(null)
  const closeCounterSectionRef = useRef<HTMLDivElement>(null)
  const [highlightOpenCounter, setHighlightOpenCounter] = useState(false)
  const [highlightCloseCounter, setHighlightCloseCounter] = useState(false)
  const [closeCounterButtonClicked, setCloseCounterButtonClicked] = useState(false)
  const lastPreFilledSessionIdRef = useRef<string | null>(null)
  const [lastClosedSummary, setLastClosedSummary] = useState<{
    openingCashTotal: number
    closingCashTotal: number
    cashSales: number
    upiSales: number
    cardSales: number
    refunds: number
    cashExpenses: number
    profit: number
  } | null>(null)
  useEffect(() => {
    if (!highlightOpenCounter && !highlightCloseCounter) return
    const t = setTimeout(() => {
      setHighlightOpenCounter(false)
      setHighlightCloseCounter(false)
    }, 4000)
    return () => clearTimeout(t)
  }, [highlightOpenCounter, highlightCloseCounter])

  // Pre-fill close counter form with expected notes from runningNotes (from dispense/billing)
  useEffect(() => {
    const session = activeCashSession
    if (!session?.id || !session.runningNotes) return
    if (lastPreFilledSessionIdRef.current === session.id) return
    lastPreFilledSessionIdRef.current = session.id
    const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
    const next: Record<string, string> = {}
    denoms.forEach((d) => {
      const n = session.runningNotes![d]
      next[d] = n != null && n > 0 ? String(n) : ''
    })
    setCashClosingNotes(next)
  }, [activeCashSession?.id, activeCashSession?.runningNotes])

  useEffect(() => {
    if (!activeCashSession) lastPreFilledSessionIdRef.current = null
  }, [activeCashSession])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored =
      window.localStorage.getItem('pharmacyPrinterIds') ||
      window.localStorage.getItem('pharmacyPrinterId') ||
      window.localStorage.getItem('printerId') ||
      ''
    setDefaultPrinterId(stored)
    const bridgeStored =
      window.localStorage.getItem('pharmacyPrintBridgeUrl') ||
      window.localStorage.getItem('printBridgeUrl') ||
      ''
    setPrintBridgeUrl(bridgeStored)
  }, [])

  const [expenseCategories, setExpenseCategories] = useState<import('@/types/pharmacy').PharmacyExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<import('@/types/pharmacy').PharmacyExpense[]>([])
  const [expenseFilters, setExpenseFilters] = useState<{ dateFrom: string; dateTo: string; categoryId: string; paymentMethod: string }>({
    dateFrom: '',
    dateTo: '',
    categoryId: 'all',
    paymentMethod: 'all',
  })
  const [expenseForm, setExpenseForm] = useState<{ date: string; amount: string; paymentMethod: string; note: string }>({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    paymentMethod: 'cash',
    note: '',
  })
  const [defaultPrinterId, setDefaultPrinterId] = useState('')
  const [printBridgeUrl, setPrintBridgeUrl] = useState('')
  type CashExpensePeriod = 'today' | 'week' | 'month' | 'year'
  const [cashExpensePeriod, setCashExpensePeriod] = useState<CashExpensePeriod>('today')
  type CashExpenseSubTab = 'shift' | 'daily'
  const [cashExpenseSubTab, setCashExpenseSubTab] = useState<CashExpenseSubTab>('shift')
  const [dailySummarySearch, setDailySummarySearch] = useState('')
  const [dailySummaryDateFrom, setDailySummaryDateFrom] = useState('')
  const [dailySummaryDateTo, setDailySummaryDateTo] = useState('')
  const [dailySummarySalesSort, setDailySummarySalesSort] = useState<DailySummarySalesSort>('default')
  const [shiftReportsSearch, setShiftReportsSearch] = useState('')
  const [shiftReportsDateFrom, setShiftReportsDateFrom] = useState('')
  const [shiftReportsDateTo, setShiftReportsDateTo] = useState('')
  const [expandedDailySummaryDates, setExpandedDailySummaryDates] = useState<Set<string>>(new Set())
  const [showExpenseCashModal, setShowExpenseCashModal] = useState(false)
  const [pendingExpensePayload, setPendingExpensePayload] = useState<{ amount: number; date: string; note: string; paymentMethod: string } | null>(null)
  const [openedByName, setOpenedByName] = useState<string>('')
  const [selectedCashierId, setSelectedCashierId] = useState<string>('')
  const [selectedCounterId, setSelectedCounterId] = useState<string>('')
  const [cashiers, setCashiers] = useState<PharmacyCashierProfile[]>([])
  const [counters, setCounters] = useState<PharmacyCounter[]>([])
  const [showCreateCashierModal, setShowCreateCashierModal] = useState(false)
  const [showCreateCounterModal, setShowCreateCounterModal] = useState(false)
  const [newCashier, setNewCashier] = useState<{ name: string; phone: string }>({ name: '', phone: '' })
  const [newCounterName, setNewCounterName] = useState<string>('')
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null)
  const [editingCounterId, setEditingCounterId] = useState<string | null>(null)
  const [manageCashierCounterTab, setManageCashierCounterTab] = useState<'cashier' | 'counter'>('cashier')
  const [cashierSearchQuery, setCashierSearchQuery] = useState('')
  const [counterSearchQuery, setCounterSearchQuery] = useState('')
  const [showCloseShiftConfirm, setShowCloseShiftConfirm] = useState(false)
  const [closedByName, setClosedByName] = useState<string>('')
  const [closeChecklist, setCloseChecklist] = useState({
    countedCash: false,
    reviewedRefundsAndExpenses: false,
    varianceAcknowledged: false,
  })
  const [closeVarianceReason, setCloseVarianceReason] = useState('')
  const [closeHandoverNote, setCloseHandoverNote] = useState('')
  const [showAddPharmacistModal, setShowAddPharmacistModal] = useState(false)
  const [pharmacistForm, setPharmacistForm] = useState<{ firstName: string; lastName: string; email: string; password: string; branchId: string }>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    branchId: '',
  })

  const getSaleReturnedMap = useCallback((sale: PharmacySale) => {
    const map: Record<string, number> = {}
    if (!sale.returns) return map
    for (const ret of sale.returns) {
      for (const line of ret.lines || []) {
        const key = line.medicineId
        const qty = Number(line.quantity) || 0
        if (!qty) continue
        map[key] = (map[key] || 0) + qty
      }
    }
    return map
  }, [])

  const getToken = useCallback(async () => {
    const user = auth.currentUser
    if (!user) return null
    return user.getIdToken()
  }, [])

  useEffect(() => {
    const s = viewShiftReportSession
    if (!s?.branchId || !activeHospitalId) {
      setShiftReportExpenses([])
      return
    }
    let dateFrom = ''
    let dateTo = ''
    const opened = typeof s.openedAt === 'string' ? s.openedAt : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
    const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
    if (opened) dateFrom = opened.slice(0, 10)
    if (closed) dateTo = closed.slice(0, 10)
    else dateTo = new Date().toISOString().slice(0, 10)
    if (!dateFrom) {
      setShiftReportExpenses([])
      return
    }
    getToken().then((token) => {
      if (!token) return
      const client = createPharmacyApiClient(token)
      client.getExpenses({
        hospitalId: activeHospitalId,
        branchId: s.branchId,
        dateFrom,
        dateTo,
      })
        .then((result) => {
          if (result.ok && result.data.success && Array.isArray(result.data.expenses)) {
            setShiftReportExpenses(result.data.expenses as PharmacyExpense[])
          }
          else setShiftReportExpenses([])
        })
        .catch(() => setShiftReportExpenses([]))
    })
  }, [viewShiftReportSession, activeHospitalId, getToken])

  const fetchCashSessions = useCallback(async () => {
    setCashSessionsLoading(true)
    try {
      const token = await getToken()
      if (!token) return null
      const client = createPharmacyApiClient(token)
      const result = await client.getCashSessions({
        hospitalId: activeHospitalId ?? undefined,
        branchId: branchFilter && branchFilter !== 'all' ? branchFilter : undefined,
      })
      if (!result.ok || !result.data.success) {
        console.warn('Failed to load cash sessions', { status: result.status, body: result.data })
        setActiveCashSession(null)
        return null
      }
      setActiveCashSession((result.data.activeSession as PharmacyCashSession | undefined) ?? null)
      setRecentCashSessions((result.data.recentSessions as PharmacyCashSession[] | undefined) ?? [])
      return (result.data.activeSession as PharmacyCashSession | undefined) ?? null
    } catch (e) {
      console.error(e)
      return null
    } finally {
      setCashSessionsLoading(false)
    }
  }, [getToken, activeHospitalId, branchFilter])

  const fetchExpensesAndCategories = useCallback(async () => {
    if (!activeHospitalId) return
    try {
      const token = await getToken()
      if (!token) return
      const client = createPharmacyApiClient(token)
      const [catResult, expResult] = await Promise.all([
        client.getExpenseCategories({ hospitalId: activeHospitalId }),
        client.getExpenses({
          hospitalId: activeHospitalId,
          branchId: branchFilter && branchFilter !== 'all' ? branchFilter : undefined,
          dateFrom: expenseFilters.dateFrom || undefined,
          dateTo: expenseFilters.dateTo || undefined,
          categoryId: expenseFilters.categoryId !== 'all' ? expenseFilters.categoryId : undefined,
          paymentMethod: expenseFilters.paymentMethod !== 'all' ? expenseFilters.paymentMethod : undefined,
        }),
      ])
      if (catResult.ok && catResult.data.success && Array.isArray(catResult.data.categories)) {
        setExpenseCategories(catResult.data.categories as PharmacyExpenseCategory[])
      }
      if (expResult.ok && expResult.data.success && Array.isArray(expResult.data.expenses)) {
        setExpenses(expResult.data.expenses as PharmacyExpense[])
      }
    } catch (e) {
      // ignore for now; page will show empty state
    }
  }, [activeHospitalId, branchFilter, expenseFilters, getToken])

  const fetchCashiersAndCounters = useCallback(async () => {
    if (!activeHospitalId) return
    try {
      const token = await getToken()
      if (!token) return
      const client = createPharmacyApiClient(token)
      const branchId = branchFilter && branchFilter !== 'all' ? branchFilter : undefined
      const [cashiersResult, countersResult] = await Promise.all([
        client.getCashiers({ hospitalId: activeHospitalId, branchId }),
        client.getCounters({ hospitalId: activeHospitalId, branchId }),
      ])
      if (cashiersResult.ok && cashiersResult.data.success && Array.isArray(cashiersResult.data.cashiers)) {
        setCashiers(cashiersResult.data.cashiers as PharmacyCashierProfile[])
      }
      if (countersResult.ok && countersResult.data.success && Array.isArray(countersResult.data.counters)) {
        setCounters(countersResult.data.counters as PharmacyCounter[])
      }
    } catch {
      // ignore, UI will show empty dropdowns
    }
  }, [activeHospitalId, branchFilter, getToken])

  useEffect(() => {
    fetchCashiersAndCounters()
  }, [fetchCashiersAndCounters])

  const handleDeleteCashier = useCallback(async (cashier: PharmacyCashierProfile) => {
    const hasOpenSession = recentCashSessions.some(
      (s) => s.status === 'open' && s.cashierProfileId === cashier.id
    )
    if (hasOpenSession) {
      setError(`Cannot delete cashier "${cashier.name}" while an active shift is open.`)
      return
    }
    if (!window.confirm(
      `Delete cashier "${cashier.name}"?\n\nThis removes the cashier from future shift selection. Historical shift records remain unchanged.`
    )) return
    const token = await getToken()
    if (!token) return
    try {
      const client = createPharmacyApiClient(token)
      const result = await client.deleteCashier(cashier.id)
      if (!result.ok || !result.data.success) {
        setError((result.data.error as string) || 'Failed to delete cashier')
        return
      }
      setCashiers((prev) => prev.filter((x) => x.id !== cashier.id))
      setSuccess('Cashier removed.')
    } catch (e: any) {
      setError(e?.message || 'Failed to delete cashier')
    }
  }, [getToken, recentCashSessions])

  const handleDeleteCounter = useCallback(async (counter: PharmacyCounter) => {
    const hasOpenSession = recentCashSessions.some(
      (s) => s.status === 'open' && s.counterId === counter.id
    )
    if (hasOpenSession) {
      setError(`Cannot delete counter "${counter.name}" while an active shift is open.`)
      return
    }
    if (!window.confirm(
      `Delete counter "${counter.name}"?\n\nThis removes the counter from future shift selection. Historical shift records remain unchanged.`
    )) return
    const token = await getToken()
    if (!token) return
    try {
      const client = createPharmacyApiClient(token)
      const result = await client.deleteCounter(counter.id)
      if (!result.ok || !result.data.success) {
        setError((result.data.error as string) || 'Failed to delete counter')
        return
      }
      setCounters((prev) => prev.filter((x) => x.id !== counter.id))
      setSuccess('Counter removed.')
    } catch (e: any) {
      setError(e?.message || 'Failed to delete counter')
    }
  }, [getToken, recentCashSessions])

  const fetchBranches = useCallback(async () => {
    if (!activeHospitalId) return
    const token = await getToken()
    if (!token) return
    const res = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success && data.branches) {
      const list = data.branches.map((b: Branch) => ({ id: b.id, name: b.name }))
      setBranchesState(list)
      const p = portalRef.current
      if (isPharmacyPortal && p) p.setBranches(list)
    }
  }, [activeHospitalId, getToken])

  const FETCH_PHARMACY_TIMEOUT_MS = 60000

  const fetchPharmacy = useCallback(async (silent = false) => {
    if (!activeHospitalId) {
      if (!silent) setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setError(null)
    const token = await getToken()
    if (!token) {
      if (!silent) setLoading(false)
      return
    }
    const client = createPharmacyApiClient(token)
    const currentBranch = branchFilterRef.current
    const scopedBranchId = currentBranch !== 'all' ? currentBranch : undefined

    const runFetches = async () => {
      const [medRes, stockRes, suppliersRes, alertsRes, queueRes, salesRes, analyticsRes, transfersRes, pharmacistsRes, ordersRes] = await Promise.all([
        client.getMedicines({ hospitalId: activeHospitalId }),
        client.getStock({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
        client.getSuppliers({ hospitalId: activeHospitalId }),
        client.getAlerts({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
        client.getPrescriptionQueue({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
        client.getSales({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
        client.getAnalytics({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
        isSuperAdmin ? client.getTransfers({ hospitalId: activeHospitalId }) : Promise.resolve(null),
        isAdmin ? client.getPharmacists() : Promise.resolve(null),
        client.getPurchaseOrders({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
      ])

      if (medRes.ok && medRes.data.success) {
        setMedicines((medRes.data.medicines as PharmacyMedicine[] | undefined) || [])
      }
      if (stockRes.ok && stockRes.data.success) {
        setStock((stockRes.data.stock as BranchMedicineStock[] | undefined) || [])
      }
      if (suppliersRes.ok && suppliersRes.data.success) {
        setSuppliers((suppliersRes.data.suppliers as PharmacySupplier[] | undefined) || [])
      }
      if (alertsRes.ok && alertsRes.data.success) {
          const nextLowStock = (alertsRes.data.lowStock as LowStockAlert[] | undefined) || []
          const nextExpiring = (alertsRes.data.expiring as ExpiryAlert[] | undefined) || []
          setLowStock(nextLowStock)
          setExpiring(nextExpiring)
          const p = portalRef.current
          if (isPharmacyPortal && p) p.setAlertCounts(nextLowStock.length, nextExpiring.length)
      }
      if (queueRes.ok && queueRes.data.success) {
        setQueue((queueRes.data.queue as QueueItem[] | undefined) || [])
      }
      if (salesRes.ok && salesRes.data.success) {
        setSales((salesRes.data.sales as PharmacySale[] | undefined) || [])
      }
      if (analyticsRes.ok && analyticsRes.data.success && analyticsRes.data.analytics) {
        setAnalytics(analyticsRes.data.analytics as {
          totalMedicines: number
          totalStockItems: number
          lowStockCount: number
          expiringCount: number
          dailySalesTotal: number
          mostPrescribed: Array<{ medicineName: string; count: number }>
        })
      }
      if (transfersRes?.ok && transfersRes.data.success) {
        setTransfers((transfersRes.data.transfers as StockTransfer[] | undefined) || [])
      }
      if (pharmacistsRes?.ok && pharmacistsRes.data.success) {
        setPharmacists((pharmacistsRes.data.pharmacists as Array<{ id: string; email: string; firstName: string; lastName: string; branchName: string }> | undefined) || [])
      }
      if (ordersRes.ok && ordersRes.data.success) {
        setPurchaseOrders((ordersRes.data.orders as PharmacyPurchaseOrder[] | undefined) || [])
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), FETCH_PHARMACY_TIMEOUT_MS)
    })

    try {
      await Promise.race([runFetches(), timeoutPromise])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load pharmacy data'
      if (msg.includes('Request timed out') && isPharmacyPortal) {
        console.warn('Pharmacy portal initial load timed out; showing partial data.')
      } else {
        setError(msg)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeHospitalId, isSuperAdmin, isAdmin, getToken])

  const submitReturn = useCallback(
    async (mode: 'cash' | 'upi' | 'card' | 'other', notes?: Record<string, number>) => {
      if (!pendingReturnPayload) return
      setReturnSubmitting(true)
      setError(null)
      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')
        const client = createPharmacyApiClient(token)
        const result = await client.submitSaleReturn({
          saleId: pendingReturnPayload.saleId,
          lines: pendingReturnPayload.lines,
          note: pendingReturnPayload.note,
          refundPaymentMode: mode,
          ...(mode === 'cash' && notes && Object.keys(notes).length > 0 ? { refundNotes: notes } : {}),
        })
        if (!result.ok || !result.data.success) throw new Error((result.data.error as string) || 'Sales return failed')
        setSuccess('Sales return recorded and stock updated.')
        setReturnQuantities({})
        setReturnReasonType('')
        setReturnReasonDetails('')
        setReturnSupervisorName('')
        setSelectedReturnSale(null)
        setPendingReturnPayload(null)
        setShowRefundPaymentModal(false)
        setShowRefundCashModal(false)
        await fetchPharmacy(true)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Sales return failed')
      } finally {
        setReturnSubmitting(false)
      }
    },
    [pendingReturnPayload, getToken, fetchPharmacy]
  )

  const hasLoadedOnceRef = useRef(false)
  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  useEffect(() => {
    const isInitial = !hasLoadedOnceRef.current
    if (isInitial) hasLoadedOnceRef.current = true
    fetchPharmacy(isInitial ? false : true)
    fetchCashSessions()
    if (subTab === 'cash_and_expenses') {
      fetchExpensesAndCategories()
    }
  }, [fetchPharmacy, fetchCashSessions, fetchExpensesAndCategories, branchFilter, subTab])

  const [recordPeriod, setRecordPeriod] = useState<RecordPeriod>('monthly')
  const { salesRecordTotal, purchaseRecordTotal } = useMemo(
    () => computeRecordTotals({ recordPeriod, branchFilter, sales, purchaseOrders }),
    [recordPeriod, branchFilter, sales, purchaseOrders]
  )

  /** Last 7 days sales for bar chart (by day) */
  const last7DaysSales = useMemo(
    () => computeLast7DaysSales({ branchFilter, sales }),
    [branchFilter, sales]
  )

  /** Pie chart segments: Purchases, Suppliers, Sales, No Sales (reference design) */
  const pieChartData = useMemo(
    () => computePieChartData({ salesRecordTotal, purchaseRecordTotal, suppliersCount: suppliers.length }),
    [salesRecordTotal, purchaseRecordTotal, suppliers.length]
  )

  /** Overview dashboard date range: today, 7d, 30d, 6m, year, all */
  const [overviewDateRange, setOverviewDateRange] = useState<OverviewDateRange>('7d')

  /** Period sales total for the selected range (drives Sales card and updates with date filter) */
  const periodSalesTotal = useMemo(
    () => computePeriodSalesTotal({ overviewDateRange, branchFilter, sales }),
    [overviewDateRange, branchFilter, sales]
  )

  /** Period refund total for selected range (sum of refundedAmount on matching sales) */
  const periodRefundTotal = useMemo(
    () => computePeriodRefundTotal({ overviewDateRange, branchFilter, sales }),
    [overviewDateRange, branchFilter, sales]
  )

  /** Period sales count (number of bills) for the selected range */
  const periodSalesCount = useMemo(
    () => computePeriodSalesCount({ overviewDateRange, branchFilter, sales }),
    [overviewDateRange, branchFilter, sales]
  )

  /** Sales trend for line chart: daily for 7d/30d, monthly for 6m/year/all */
  const salesTrendData = useMemo(
    () => computeSalesTrendData({ overviewDateRange, branchFilter, sales }),
    [overviewDateRange, branchFilter, sales]
  )

  /** Medicine category distribution for donut (Tablets, Capsules, etc.) */
  const categoryDistribution = useMemo(
    () => computeCategoryDistribution({ medicines, stock, branchFilter }),
    [medicines, stock, branchFilter]
  )

  /** Category donut percentages */
  const categoryDonutData = useMemo(
    () => computeCategoryDonutData(categoryDistribution),
    [categoryDistribution]
  )

  /** Inventory health: In Stock, Low Stock, Out of Stock, Expiring Soon, Dead Stock */
  const inventoryHealthCounts = useMemo(
    () => computeInventoryHealthCounts({ stock, medicines, branchFilter, expiring, sales }),
    [stock, medicines, branchFilter, expiring, sales]
  )

  const inventoryHealthItems = useMemo(
    () =>
      computeInventoryHealthItems({
        inventoryHealthFilter,
        stock,
        medicines,
        branches,
        branchFilter,
        expiring,
        deadStockIds: inventoryHealthCounts.deadStockIds,
      }),
    [inventoryHealthFilter, stock, medicines, branches, branchFilter, expiring, inventoryHealthCounts.deadStockIds]
  )

  // Auto-scroll sales detail into view when selection changes
  useEffect(() => {
    if (!selectedSaleDetail) return
    if (!saleDetailRef.current) return
    // Small timeout to ensure layout has rendered before scrolling
    const id = window.setTimeout(() => {
      saleDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => window.clearTimeout(id)
  }, [selectedSaleDetail])

  // Filtered sales for search + branch
  const filteredSales = useMemo(
    () =>
      filterSalesRecords({
        sales,
        branchFilter,
        search: salesSearch,
        date: salesDate,
        paymentFilter: salesPaymentFilter,
        minAmount: salesMinAmount,
        maxAmount: salesMaxAmount,
      }),
    [sales, branchFilter, salesSearch, salesDate, salesPaymentFilter, salesMinAmount, salesMaxAmount]
  )

  const {
    currentPage: salesPage,
    pageSize: salesPageSize,
    totalPages: salesTotalPages,
    paginatedItems: paginatedSales,
    goToPage: goToSalesPage,
    setPageSize: setSalesPageSize,
  } = useTablePagination(filteredSales, { initialPageSize: 10 })

  // Daily income & expense for Cash & Expenses tab (today only)
  const dailySummary = useMemo(
    () => computeDailySummary(sales, expenses, branchFilter),
    [sales, expenses, branchFilter]
  )

  // Sales that occurred today (by dispensedAt date) – used for Active Shift Info totals and Recent Sales table
  const recentSalesToday = useMemo(
    () => computeRecentSalesToday(filteredSales),
    [filteredSales]
  )

  // Sales in the current open shift (since openedAt) – for correct expected cash and payment breakdown
  const sessionSales = useMemo(
    () => computeSessionSales(filteredSales, activeCashSession?.openedAt),
    [activeCashSession?.openedAt, filteredSales]
  )

  const closeShiftPreview = useMemo(
    () => computeCloseShiftPreview({
      activeCashSession,
      sessionSales,
      cashClosingNotes,
      cashDenoms: CASH_DENOMS,
    }),
    [activeCashSession, sessionSales, cashClosingNotes]
  )

  // Period date range helpers (combined across all counters – filter by branch only)
  const periodSummaries = useMemo(
    () => computePeriodSummaries(filteredSales, expenses),
    [filteredSales, expenses]
  )

  /** Daily summary: one row per closed shift (so multiple open/close on same day = multiple rows), plus one row per day that has sales/expenses but no closed shift */
  const dailySummaryRows = useMemo(
    () => computeDailySummaryRows({ sales, expenses, branchFilter, recentCashSessions }),
    [sales, expenses, branchFilter, recentCashSessions]
  )

  /** Daily Summary: grouped by date for accordion (one row per day with totals + child shifts) */
  const dailySummaryDayRows = useMemo(
    () => computeDailySummaryDayRows(dailySummaryRows),
    [dailySummaryRows]
  )

  /** Daily Summary: filtered and sorted by search, date range, and sales sort (at day level) */
  const filteredDailySummaryRows = useMemo(
    () =>
      filterDailySummaryDayRows({
        rows: dailySummaryDayRows,
        search: dailySummarySearch,
        dateFrom: dailySummaryDateFrom,
        dateTo: dailySummaryDateTo,
        salesSort: dailySummarySalesSort,
      }),
    [dailySummaryDayRows, dailySummarySearch, dailySummaryDateFrom, dailySummaryDateTo, dailySummarySalesSort]
  )

  const closedShiftSessions = useMemo(
    () => recentCashSessions.filter((s) => s.status !== 'open'),
    [recentCashSessions]
  )
  /** Shift Reports: filtered by search (cashier name, date text) and date range (closed date) */
  const filteredShiftReports = useMemo(
    () =>
      filterShiftReports({
        closedShiftSessions,
        search: shiftReportsSearch,
        dateFrom: shiftReportsDateFrom,
        dateTo: shiftReportsDateTo,
      }),
    [closedShiftSessions, shiftReportsSearch, shiftReportsDateFrom, shiftReportsDateTo]
  )
  const {
    currentPage: dailySummaryPage,
    totalPages: dailySummaryTotalPages,
    pageSize: dailySummaryPageSize,
    paginatedItems: paginatedDailySummaryRows,
    goToPage: goToDailySummaryPage,
    setPageSize: setDailySummaryPageSize,
  } = useTablePagination(filteredDailySummaryRows, { initialPageSize: 10 })
  const {
    currentPage: shiftReportsPage,
    totalPages: shiftReportsTotalPages,
    pageSize: shiftReportsPageSize,
    paginatedItems: paginatedShiftReports,
    goToPage: goToShiftReportsPage,
    setPageSize: setShiftReportsPageSize,
  } = useTablePagination(filteredShiftReports, { initialPageSize: 10 })

  // Filtered sales for returns tab (can share logic, separate search term)
  const filteredReturnSales = useMemo(
    () =>
      filterSalesRecords({
        sales,
        branchFilter,
        search: returnsSearch,
        date: returnsDate,
        paymentFilter: returnsPaymentFilter,
        minAmount: returnsMinAmount,
        maxAmount: returnsMaxAmount,
      }),
    [sales, branchFilter, returnsSearch, returnsDate, returnsPaymentFilter, returnsMinAmount, returnsMaxAmount]
  )

  const totalRefundForFilteredSales = useMemo(
    () => computeTotalRefundForFilteredSales(filteredReturnSales),
    [filteredReturnSales],
  )

  const returnEvents = useMemo(
    () => buildReturnEvents({ sales, branchFilter }),
    [sales, branchFilter]
  )

  const {
    currentPage: returnsPage,
    pageSize: returnsPageSize,
    totalPages: returnsTotalPages,
    paginatedItems: paginatedReturnSales,
    goToPage: goToReturnsPage,
    setPageSize: setReturnsPageSize,
  } = useTablePagination(filteredReturnSales, { initialPageSize: 10 })

  /** Purchase order status counts */
  const poStatusCounts = useMemo(
    () => computePoStatusCounts({ branchFilter, purchaseOrders }),
    [branchFilter, purchaseOrders]
  )

  const ordersForTable = useMemo(
    () => computeOrdersForTable({ purchaseOrders, branchFilter }),
    [purchaseOrders, branchFilter],
  )

  const {
    currentPage: ordersPage,
    pageSize: ordersPageSize,
    totalPages: ordersTotalPages,
    paginatedItems: paginatedOrders,
    goToPage: goToOrdersPage,
    setPageSize: setOrdersPageSize,
  } = useTablePagination(ordersForTable, { initialPageSize: 10 })

  const filteredSuppliers = useMemo(
    () =>
      filterSuppliers({
        suppliers,
        supplierSearchQuery,
        isPharmacyPortal,
        headerSearchQuery,
      }),
    [suppliers, supplierSearchQuery, isPharmacyPortal, headerSearchQuery]
  )

  const {
    currentPage: supplierPage,
    pageSize: supplierPageSize,
    totalPages: supplierTotalPages,
    paginatedItems: paginatedSuppliers,
    goToPage: goToSupplierPage,
    setPageSize: setSupplierPageSize,
  } = useTablePagination(filteredSuppliers, { initialPageSize: 10 })

  const filteredCashiers = useMemo(
    () => filterCashiers({ cashiers, cashierSearchQuery }),
    [cashiers, cashierSearchQuery]
  )

  const filteredCounters = useMemo(
    () => filterCounters({ counters, counterSearchQuery }),
    [counters, counterSearchQuery]
  )

  // simple keyframes for row expand animation (fade + slight slide)
  const expandStyle = `
    @keyframes fadeExpand {
      0% { opacity: 0; transform: translateY(-4px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `

  const paymentModeSummary = useMemo(
    () => computePaymentModeSummary({ sales, branchFilter }),
    [sales, branchFilter]
  )

  /** Top selling medicines (top 8) for bar chart */
  const topSellingMedicines = useMemo(
    () => computeTopSellingMedicines(analytics?.mostPrescribed),
    [analytics?.mostPrescribed]
  )

  const [overviewRecentSalesSearch, setOverviewRecentSalesSearch] = useState('')
  const recentSalesFiltered = useMemo(
    () => filterOverviewRecentSales({ branchFilter, sales, overviewRecentSalesSearch }),
    [branchFilter, sales, overviewRecentSalesSearch]
  )

  type ReportType = 'expiry' | 'valuation' | 'sales' | 'over_under' | 'reorder' | 'stock_sold'
  const [reportType, setReportType] = useState<ReportType>('expiry')
  const [expiryReportDays, setExpiryReportDays] = useState<30 | 60 | 90>(30)
  const [stockSoldReportPeriod, setStockSoldReportPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day')

  const expiryReportRows = useMemo(
    () => buildExpiryReportRows({ stock, branchFilter, branches, expiryReportDays }),
    [stock, branchFilter, branches, expiryReportDays]
  )

  const valuationReportRows = useMemo(
    () => buildValuationReportRows({ stock, medicines, branchFilter, branches }),
    [stock, medicines, branchFilter, branches]
  )

  const salesByProductRows = useMemo(
    () => buildSalesByProductRows({ sales, branchFilter }),
    [sales, branchFilter]
  )

  const salesByBranchRows = useMemo(
    () => buildSalesByBranchRows({ sales, branchFilter, branches }),
    [sales, branchFilter, branches]
  )

  const overUnderStockRows = useMemo(
    () => buildOverUnderStockRows({ stock, medicines, branchFilter, branches }),
    [stock, medicines, branchFilter, branches]
  )

  const reorderSuggestionsRows = useMemo(
    () => buildReorderSuggestionRows({ stock, medicines, sales, branchFilter, branches }),
    [stock, medicines, sales, branchFilter, branches]
  )

  const stockSoldReportData = useMemo(
    () => buildStockSoldReportData({ stock, medicines, sales, branchFilter, stockSoldReportPeriod }),
    [stock, medicines, sales, branchFilter, stockSoldReportPeriod]
  )

  const isViewOnly = false
  const selectedBranchName = branchFilter !== 'all' ? branches.find((b) => b.id === branchFilter)?.name : undefined

  const clearInventoryFilters = useCallback(() => {
    setInventorySearch('')
    setInventoryStatusFilter('all')
    setInventorySupplierFilter('all')
    setInventoryExpiryFilter('all')
  }, [])

  const applyInventoryQuickFilter = useCallback((filter: 'low_stock' | 'expiring_soon') => {
    setSubTab('inventory')
    setInventoryHealthFilter('all')
    setInventorySearch('')
    setInventorySupplierFilter('all')
    if (filter === 'low_stock') {
      setInventoryStatusFilter('low_stock')
      setInventoryExpiryFilter('all')
      return
    }
    setInventoryStatusFilter('all')
    setInventoryExpiryFilter('expiring_soon')
  }, [setSubTab])

  const { filteredStock, inventoryTableRows, hasInventoryFiltersApplied } = useMemo(
    () =>
      buildInventoryFilterRows({
        stock,
        medicines,
        branches,
        branchFilter,
        inventorySearch,
        headerSearchQuery,
        isPharmacyPortal,
        inventoryStatusFilter,
        inventorySupplierFilter,
        inventoryExpiryFilter,
      }),
    [
      stock,
      medicines,
      branches,
      branchFilter,
      inventorySearch,
      headerSearchQuery,
      isPharmacyPortal,
      inventoryStatusFilter,
      inventorySupplierFilter,
      inventoryExpiryFilter,
    ]
  )
  const recentDailyConsumptionByBranchMedicine = useMemo(
    () => buildRecentDailyConsumptionByBranchMedicine({ branchFilter, sales }),
    [branchFilter, sales]
  )

  const getDaysOfCover = useCallback((row: BranchMedicineStock) => {
    const qty = Number(row.totalQuantity || 0)
    if (qty <= 0) return 0
    const key = `${row.branchId || 'unknown'}__${row.medicineId}`
    const daily = recentDailyConsumptionByBranchMedicine.get(key) || 0
    if (daily <= 0) return null
    return Math.floor(qty / daily)
  }, [recentDailyConsumptionByBranchMedicine])
  const {
    currentPage: inventoryPage,
    pageSize: inventoryPageSize,
    totalPages: inventoryTotalPages,
    paginatedItems: paginatedInventoryRows,
    goToPage: goToInventoryPage,
    setPageSize: setInventoryPageSize,
  } = useTablePagination(inventoryTableRows, { initialPageSize: 20 })

  /** Inventory page: summary metrics (based on branch-filtered stock only) */
  const inventorySummary = useMemo(
    () => buildInventorySummary({ stock, medicines, branchFilter, expiring }),
    [stock, medicines, branchFilter, expiring]
  )

  /** Inventory health donut: In Stock, Low Stock, Out of Stock, Expired (batches past expiry) */
  const inventoryHealthDonut = useMemo(
    () => buildInventoryHealthDonut({ stock, medicines, branchFilter }),
    [stock, medicines, branchFilter]
  )

  const queueToShow = branchFilter === 'all' ? queue : queue.filter(q => q.branchId === branchFilter)
  const pendingQueue = queueToShow.filter(q => !q.dispensed)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && subTab === 'queue') {
        e.preventDefault()
        queuePosSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [subTab])

  // Fullscreen for Dispense & Billing: listen for change and re-enter if it exited right after a sale
  useEffect(() => {
    const onFullscreenChange = () => {
      const inFullscreen = !!(document.fullscreenElement && document.fullscreenElement === queueFullscreenRef.current)
      setIsQueueFullscreen(inFullscreen)
      if (!inFullscreen && keepFullscreenAfterSaleRef.current && queueFullscreenRef.current) {
        keepFullscreenAfterSaleRef.current = false
        queueFullscreenRef.current.requestFullscreen?.().catch(() => {})
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const enterQueueFullscreen = useCallback(() => {
    queueFullscreenRef.current?.requestFullscreen?.().catch(() => {})
  }, [])
  const exitQueueFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  if (!activeHospitalId) {
    return (
      <>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-slate-600">Select a hospital to manage pharmacy.</p>
        </div>
        <ConfirmDialog
          isOpen={!!inventoryDeleteTarget}
          title="Remove from branch inventory?"
          message={
            inventoryDeleteTarget
              ? `This will remove "${inventoryDeleteTarget.medicineName}" from this branch's inventory. Existing sales history will remain.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          confirmLoading={inventoryDeleteLoading}
          onCancel={() => {
            if (inventoryDeleteLoading) return
            setInventoryDeleteTarget(null)
          }}
          onConfirm={async () => {
            if (!inventoryDeleteTarget) return
            try {
              setInventoryDeleteLoading(true)
              const token = await getToken()
              if (!token) {
                setError('Not signed in')
                return
              }
              const client = createPharmacyApiClient(token)
              const result = await client.deleteStock({ stockId: inventoryDeleteTarget.id })
              if (!result.ok || !result.data.success) {
                throw new Error((result.data.error as string) || 'Failed to delete stock')
              }
              setSuccess('Medicine removed from this branch inventory.')
              fetchPharmacy()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to delete stock')
            } finally {
              setInventoryDeleteLoading(false)
              setInventoryDeleteTarget(null)
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className={isPharmacyPortal ? 'bg-white rounded-[12px] border border-[#E0E0E0] shadow-sm p-6' : 'bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl'}>
        {!isPharmacyPortal && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 px-6 py-3">
            <span className="text-sm text-slate-600">Pharmacy management</span>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setPharmacistForm({ firstName: '', lastName: '', email: '', password: '', branchId: '' })
                    setShowAddPharmacistModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Pharmacist
                </button>
              )}
              <Link
                href="/pharmacy"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1565C0] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#0D47A1]"
              >
                Open Pharmacy Portal
              </Link>
            </div>
          </div>
        )}
        {!isPharmacyPortal && (
          <div className="border-b border-slate-200 px-6 pt-6">
            <SubTabNavigation
              variant="default"
              tabs={[
                { id: 'queue', label: 'Dispense & Billing' },     // 1
                { id: 'returns', label: 'Sales returns' },        // 2
                { id: 'sales', label: 'Sales records' },          // 3
                { id: 'inventory', label: 'Inventory' },          // 4
                { id: 'orders', label: 'Orders' },                // 5
                ...(isSuperAdmin ? [{ id: 'transfers' as const, label: 'Transfers' }] : []),
                { id: 'reports', label: 'Reports' },              // 6
                { id: 'suppliers', label: 'Suppliers' },          // 7
                ...(isAdmin ? [{ id: 'users' as const, label: 'Pharmacy Users' }] : []),
                { id: 'overview', label: 'Overview' },            // 8
              ]}
              activeTab={subTab}
              onTabChange={(id) => setSubTab(id as PharmacySubTab)}
            />
          </div>
        )}
        <div className={isPharmacyPortal ? '' : 'p-6'}>
        {error && !(subTab === 'queue' && isQueueFullscreen) && (
          <Notification type="error" message={error} onClose={() => setError(null)} />
        )}
        {success && !(subTab === 'queue' && isQueueFullscreen) && (
          <Notification type="success" message={success} onClose={() => setSuccess(null)} />
        )}
        {/* Branch filter - only when not in pharmacy portal (portal has it in header) */}
        {!isPharmacyPortal && branches.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Branch:</span>
            <select
              value={branchFilter}
              onChange={(e) => {
                const newVal = e.target.value
                if (newVal === branchFilter) return
                if (!window.confirm('Are you sure you want to change the branch? Inventory and data will filter by the new branch.')) return
                setBranchFilter(newVal)
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {subTab === 'overview' && (
          loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
          ) : (
            <OverviewTabContent
              overviewDateRange={overviewDateRange}
              setOverviewDateRange={setOverviewDateRange}
              branches={branches}
              branchFilter={branchFilter}
              setBranchFilter={setBranchFilter}
              analytics={analytics}
              medicinesCount={medicines.length}
              lowStock={lowStock}
              expiring={expiring}
              applyInventoryQuickFilter={applyInventoryQuickFilter}
              periodRefundTotal={periodRefundTotal}
              periodSalesTotal={periodSalesTotal}
              queueCount={queue.length}
              poStatusCounts={poStatusCounts}
              paymentModeSummary={paymentModeSummary}
              salesTrendData={salesTrendData}
              topSellingMedicines={topSellingMedicines}
              categoryDonutData={categoryDonutData}
              inventoryHealthFilter={inventoryHealthFilter}
              setInventoryHealthFilter={setInventoryHealthFilter}
              inventoryHealthCounts={inventoryHealthCounts}
              inventoryHealthItems={inventoryHealthItems}
              recentSalesFiltered={recentSalesFiltered}
              isPharmacyPortal={isPharmacyPortal}
              headerSearchQuery={headerSearchQuery}
            />
          )
        )}

        {subTab === 'inventory' && (
          <InventoryTabContent
            isViewOnly={isViewOnly}
            inventorySummary={inventorySummary}
            purchaseOrders={purchaseOrders}
            setSuccess={setSuccess}
            fetchPharmacy={fetchPharmacy}
            setError={setError}
            getToken={getToken}
            branchFilter={branchFilter}
            activeHospitalId={activeHospitalId ?? undefined}
            setAddMedicineModalBarcode={setAddMedicineModalBarcode}
            inventorySearch={inventorySearch}
            setInventorySearch={setInventorySearch}
            inventoryStatusFilter={inventoryStatusFilter}
            setInventoryStatusFilter={setInventoryStatusFilter}
            suppliers={suppliers}
            inventorySupplierFilter={inventorySupplierFilter}
            setInventorySupplierFilter={setInventorySupplierFilter}
            inventoryExpiryFilter={inventoryExpiryFilter}
            setInventoryExpiryFilter={setInventoryExpiryFilter}
            hasInventoryFiltersApplied={hasInventoryFiltersApplied}
            clearInventoryFilters={clearInventoryFilters}
            inventoryTableRows={inventoryTableRows}
            filteredStock={filteredStock}
            isPharmacyPortal={isPharmacyPortal}
            lowStock={lowStock}
            medicines={medicines}
            setPendingAddToOrder={setPendingAddToOrder}
            setSubTab={(id) => setSubTab(id as PharmacySubTab)}
            loading={loading}
            paginatedInventoryRows={paginatedInventoryRows}
            branches={branches}
            getNearestExpiry={getNearestExpiry}
            getDaysOfCover={getDaysOfCover}
            inventoryRowActionsOpen={inventoryRowActionsOpen}
            setInventoryRowActionsOpen={setInventoryRowActionsOpen}
            setInventoryDetailView={setInventoryDetailView}
            setInventoryViewBatchesStock={setInventoryViewBatchesStock}
            setInventoryDeleteTarget={setInventoryDeleteTarget}
            inventoryPage={inventoryPage}
            inventoryTotalPages={inventoryTotalPages}
            inventoryPageSize={inventoryPageSize}
            goToInventoryPage={goToInventoryPage}
            setInventoryPageSize={setInventoryPageSize}
            inventoryHealthDonut={inventoryHealthDonut}
            inventoryDetailView={inventoryDetailView}
            setEditMinLevelMedicine={setEditMinLevelMedicine}
            inventoryViewBatchesStock={inventoryViewBatchesStock}
          />
        )}

        {subTab === 'queue' && (
          <PharmacyQueueSection
            queueContainerRef={queueFullscreenRef}
            isQueueFullscreen={isQueueFullscreen}
            error={error}
            success={success}
            onClearError={() => setError(null)}
            onClearSuccess={() => setSuccess(null)}
            cashSessionsLoading={cashSessionsLoading}
            hasActiveCashSession={!!activeCashSession}
            onGoToCashAndExpenses={() => setSubTab('cash_and_expenses')}
            queueInnerTab={queueInnerTab}
            onQueueInnerTabChange={setQueueInnerTab}
            renderWalkInPanel={() => (
              <PharmacyBillingPanel
                branches={branches}
                medicines={medicines}
                stock={stock}
                selectedBranchId={!isViewOnly ? branchFilter : undefined}
                selectedBranchName={!isViewOnly ? selectedBranchName : undefined}
                hospitalId={activeHospitalId ?? ''}
                onSuccess={() => {
                  keepFullscreenAfterSaleRef.current = true
                  setSuccess('Sale recorded; stock updated.')
                  fetchPharmacy()
                  fetchCashSessions()
                }}
                onError={setError}
                getToken={getToken}
                onOpenAddMedicine={(barcode) => setAddMedicineModalBarcode(barcode)}
                posSearchRef={queuePosSearchRef}
                queueItems={pendingQueue}
                hasActiveSession={!!activeCashSession}
              />
            )}
            selectedQueueItem={dispenseQueueItem}
            renderDispensePanel={(queueItem) => (
              <DispenseModal
                inline
                queueItem={queueItem}
                medicines={medicines}
                stock={stock}
                hospitalId={activeHospitalId ?? ''}
                onSuccess={() => {
                  keepFullscreenAfterSaleRef.current = true
                  setSuccess('Medicine dispensed; stock updated.')
                  setDispenseQueueItem(null)
                  fetchPharmacy()
                  fetchCashSessions()
                }}
                onError={setError}
                onClose={() => setDispenseQueueItem(null)}
                getToken={getToken}
                onOpenAddMedicine={(barcode) => setAddMedicineModalBarcode(barcode)}
              />
            )}
            loading={loading}
            pendingQueue={pendingQueue}
            isViewOnly={isViewOnly}
            onSelectQueueItem={setDispenseQueueItem}
            onRefreshQueue={() => { void fetchPharmacy() }}
            onEnterFullscreen={enterQueueFullscreen}
            onExitFullscreen={exitQueueFullscreen}
          />
        )}

        {subTab === 'sales' && (
          <SalesTabContent
            overviewDateRange={overviewDateRange}
            setOverviewDateRange={setOverviewDateRange}
            periodSalesTotal={periodSalesTotal}
            periodRefundTotal={periodRefundTotal}
            periodSalesCount={periodSalesCount}
            paymentModeSummary={paymentModeSummary}
            salesTrendData={salesTrendData}
            topSellingMedicines={topSellingMedicines}
            salesDate={salesDate}
            setSalesDate={setSalesDate}
            salesPaymentFilter={salesPaymentFilter}
            setSalesPaymentFilter={setSalesPaymentFilter}
            salesMinAmount={salesMinAmount}
            setSalesMinAmount={setSalesMinAmount}
            salesMaxAmount={salesMaxAmount}
            setSalesMaxAmount={setSalesMaxAmount}
            salesSearch={salesSearch}
            setSalesSearch={setSalesSearch}
            loading={loading}
            paginatedSales={paginatedSales}
            selectedSaleDetail={selectedSaleDetail}
            onToggleSaleDetail={(sale) => setSelectedSaleDetail((prev) => (prev?.id === sale.id ? null : sale))}
            saleDetailRef={saleDetailRef}
            getSaleReturnedMap={getSaleReturnedMap}
            filteredSalesCount={filteredSales.length}
            salesPage={salesPage}
            salesTotalPages={salesTotalPages}
            salesPageSize={salesPageSize}
            goToSalesPage={goToSalesPage}
            setSalesPageSize={setSalesPageSize}
          />
        )}

        {subTab === 'cash_and_expenses' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">Billing printer settings</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Save printer ID once. Bills auto-open print flow when configured; otherwise PDF downloads.
                  </p>
                </div>
                <div className="w-full sm:w-[460px]">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Default printer ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={defaultPrinterId}
                      onChange={(e) => setDefaultPrinterId(e.target.value)}
                      placeholder="e.g. HP-LaserJet-1, EPSON-TM-T82, Canon-FrontDesk"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window === 'undefined') return
                        const ids = defaultPrinterId
                          .split(/[\n,]/g)
                          .map((v) => v.trim())
                          .filter(Boolean)
                        if (ids.length > 0) {
                          window.localStorage.setItem('pharmacyPrinterIds', ids.join(','))
                          window.localStorage.setItem('pharmacyPrinterId', ids[0])
                          setSuccess(`Saved ${ids.length} printer ID${ids.length > 1 ? 's' : ''}.`)
                        } else {
                          window.localStorage.removeItem('pharmacyPrinterIds')
                          window.localStorage.removeItem('pharmacyPrinterId')
                          setSuccess('Default printer ID cleared. Bills will download as PDF.')
                        }
                      }}
                      className="rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] transition"
                    >
                      Save
                    </button>
                  </div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 mt-3">Print bridge URL (Phase 2)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={printBridgeUrl}
                      onChange={(e) => setPrintBridgeUrl(e.target.value)}
                      placeholder="e.g. http://localhost:3210/print"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window === 'undefined') return
                        const url = printBridgeUrl.trim()
                        if (url) {
                          window.localStorage.setItem('pharmacyPrintBridgeUrl', url)
                          setSuccess('Print bridge URL saved.')
                        } else {
                          window.localStorage.removeItem('pharmacyPrintBridgeUrl')
                          setSuccess('Print bridge URL cleared.')
                        }
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      Save URL
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Cash & Expenses sub-tabs – professional tab bar */}
            <div className="border-b border-slate-200 bg-white">
              <div className="flex gap-0" role="tablist" aria-label="Cash & Expenses views">
                {(['shift', 'daily'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={cashExpenseSubTab === tab}
                    onClick={() => setCashExpenseSubTab(tab)}
                    className={`relative min-w-[160px] px-5 py-3.5 text-sm font-semibold transition-colors duration-200 border-b-2 -mb-px ${
                      cashExpenseSubTab === tab
                        ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    {tab === 'shift' ? 'Shift Dashboard' : 'Daily Summary'}
                  </button>
                ))}
              </div>
            </div>

            {cashExpenseSubTab === 'daily' ? (
              <CashExpensesDailyContent
                dailySummarySearch={dailySummarySearch}
                setDailySummarySearch={setDailySummarySearch}
                dailySummaryDateFrom={dailySummaryDateFrom}
                setDailySummaryDateFrom={setDailySummaryDateFrom}
                dailySummaryDateTo={dailySummaryDateTo}
                setDailySummaryDateTo={setDailySummaryDateTo}
                dailySummarySalesSort={dailySummarySalesSort}
                setDailySummarySalesSort={setDailySummarySalesSort}
                filteredDailySummaryRows={filteredDailySummaryRows}
                paginatedDailySummaryRows={paginatedDailySummaryRows}
                expandedDailySummaryDates={expandedDailySummaryDates}
                setExpandedDailySummaryDates={setExpandedDailySummaryDates}
                dailySummaryPage={dailySummaryPage}
                dailySummaryTotalPages={dailySummaryTotalPages}
                dailySummaryPageSize={dailySummaryPageSize}
                goToDailySummaryPage={goToDailySummaryPage}
                setDailySummaryPageSize={setDailySummaryPageSize}
                shiftReportsSearch={shiftReportsSearch}
                setShiftReportsSearch={setShiftReportsSearch}
                shiftReportsDateFrom={shiftReportsDateFrom}
                setShiftReportsDateFrom={setShiftReportsDateFrom}
                shiftReportsDateTo={shiftReportsDateTo}
                setShiftReportsDateTo={setShiftReportsDateTo}
                closedShiftSessions={closedShiftSessions}
                filteredShiftReports={filteredShiftReports}
                paginatedShiftReports={paginatedShiftReports}
                shiftReportsPage={shiftReportsPage}
                shiftReportsTotalPages={shiftReportsTotalPages}
                shiftReportsPageSize={shiftReportsPageSize}
                goToShiftReportsPage={goToShiftReportsPage}
                setShiftReportsPageSize={setShiftReportsPageSize}
                setViewShiftReportSession={setViewShiftReportSession}
              />
            ) : (
              <CashExpensesShiftContent
                cashExpensePeriod={cashExpensePeriod}
                periodSummaries={periodSummaries}
                cashSessionsLoading={cashSessionsLoading}
                activeCashSession={activeCashSession}
                sessionSales={sessionSales}
                recentSalesToday={recentSalesToday}
                cashClosingNotes={cashClosingNotes}
                setCashClosingNotes={setCashClosingNotes}
                closeShiftPreview={closeShiftPreview}
                closeCounterButtonClicked={closeCounterButtonClicked}
                closeCounterSectionRef={closeCounterSectionRef}
                openCounterSectionRef={openCounterSectionRef}
                highlightCloseCounter={highlightCloseCounter}
                highlightOpenCounter={highlightOpenCounter}
                lastClosedSummary={lastClosedSummary}
                recentCashSessions={recentCashSessions}
                cashiers={cashiers}
                counters={counters}
                selectedCashierId={selectedCashierId}
                setSelectedCashierId={setSelectedCashierId}
                selectedCounterId={selectedCounterId}
                setSelectedCounterId={setSelectedCounterId}
                cashOpeningNotes={cashOpeningNotes}
                setCashOpeningNotes={setCashOpeningNotes}
                openedByName={openedByName}
                branchFilter={branchFilter}
                activeHospitalId={activeHospitalId}
                expenseForm={expenseForm}
                setExpenseForm={setExpenseForm}
                pendingExpensePayload={pendingExpensePayload}
                showExpenseCashModal={showExpenseCashModal}
                setShowExpenseCashModal={setShowExpenseCashModal}
                setPendingExpensePayload={setPendingExpensePayload}
                expenses={expenses}
                expenseCategories={expenseCategories}
                expenseFilters={expenseFilters}
                setExpenseFilters={setExpenseFilters}
                branches={branches}
                onCloseShiftClick={() => {
                  setCloseCounterButtonClicked(true)
                  window.setTimeout(() => setCloseCounterButtonClicked(false), 350)
                  setCloseChecklist({
                    countedCash: false,
                    reviewedRefundsAndExpenses: false,
                    varianceAcknowledged: false,
                  })
                  setCloseVarianceReason('')
                  setCloseHandoverNote('')
                  setShowCloseShiftConfirm(true)
                }}
                onStartNewShift={() => {
                  setLastClosedSummary(null)
                  openCounterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  setHighlightOpenCounter(true)
                }}
                onLoadPreviousCounter={() => {
                  const lastClosed = recentCashSessions.find((s) => s.status !== 'open')
                  if (!lastClosed?.closingNotes) return
                  const next: Record<string, string> = {}
                  CASH_DENOMS.forEach((d) => {
                    const n = lastClosed.closingNotes?.[d]
                    next[d] = n != null && n > 0 ? String(n) : ''
                  })
                  setCashOpeningNotes(next)
                }}
                onOpenCounter={async () => {
                  const token = await getToken()
                  if (!token || !activeHospitalId) return
                  if (!selectedCashierId || !selectedCounterId) {
                    setError('Select both cashier and counter to open a shift.')
                    return
                  }
                  const cashier = cashiers.find((c) => c.id === selectedCashierId)
                  const counter = counters.find((c) => c.id === selectedCounterId)
                  const notesNum: Record<string, number> = {}
                  let openingTotal = 0
                  CASH_DENOMS.forEach((den) => {
                    const count = Math.max(0, Number(cashOpeningNotes[den] || 0))
                    notesNum[den] = count
                    openingTotal += count * Number(den)
                  })
                  try {
                    const client = createPharmacyApiClient(token)
                    const result = await client.upsertCashSession({
                      action: 'open',
                      hospitalId: activeHospitalId,
                      branchId: branchFilter === 'all' ? undefined : branchFilter,
                      openingNotes: notesNum,
                      openingCashTotal: openingTotal,
                      openedByName: openedByName || cashier?.name || undefined,
                      cashierProfileId: cashier?.id,
                      cashierName: cashier?.name,
                      counterId: counter?.id,
                      counterName: counter?.name,
                    })
                    if (!result.ok || !result.data.success) {
                      setError((result.data.error as string) || 'Failed to open counter')
                      return
                    }
                    setSuccess('Billing counter opened.')
                    setActiveCashSession((result.data.session as PharmacyCashSession | undefined) ?? null)
                    setLastClosedSummary(null)
                  } catch (e: any) {
                    setError(e?.message || 'Failed to open counter')
                  }
                }}
                onSaveExpense={async () => {
                  if (!activeHospitalId) {
                    setError('Active hospital is not set.')
                    return
                  }
                  const note = expenseForm.note.trim()
                  const amount = Number(expenseForm.amount)
                  if (!expenseForm.date || !note) {
                    setError('Please fill date and note (required).')
                    return
                  }
                  if (!amount || amount <= 0) {
                    setError('Please enter a valid amount.')
                    return
                  }
                  if (branchFilter === 'all') {
                    setError('Select a branch to add expense.')
                    return
                  }
                  if (expenseForm.paymentMethod === 'cash') {
                    if (!activeCashSession) {
                      setError('Start a cash session first to record cash expense.')
                      return
                    }
                    setPendingExpensePayload({
                      amount,
                      date: expenseForm.date,
                      note,
                      paymentMethod: expenseForm.paymentMethod,
                    })
                    setShowExpenseCashModal(true)
                    return
                  }
                  try {
                    setError(null)
                    const token = await getToken()
                    if (!token) throw new Error('Not authenticated')
                    const client = createPharmacyApiClient(token)
                    const result = await client.createExpense({
                      hospitalId: activeHospitalId,
                      branchId: branchFilter,
                      date: expenseForm.date,
                      note,
                      amount,
                      paymentMethod: expenseForm.paymentMethod,
                    })
                    if (!result.ok || !result.data.success) throw new Error((result.data.error as string) || 'Failed to add expense')
                    setSuccess('Expense recorded.')
                    setExpenseForm((prev) => ({ ...prev, amount: '', note: '' }))
                    fetchExpensesAndCategories()
                    fetchCashSessions()
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Failed to add expense')
                  }
                }}
                onConfirmExpenseCash={async (expenseNotes) => {
                  if (!pendingExpensePayload) return
                  try {
                    setError(null)
                    const token = await getToken()
                    if (!token) throw new Error('Not authenticated')
                    const client = createPharmacyApiClient(token)
                    const result = await client.createExpense({
                      hospitalId: activeHospitalId,
                      branchId: branchFilter,
                      date: pendingExpensePayload.date,
                      note: pendingExpensePayload.note,
                      amount: pendingExpensePayload.amount,
                      paymentMethod: 'cash',
                      expenseNotes,
                    })
                    if (!result.ok || !result.data.success) throw new Error((result.data.error as string) || 'Failed to add expense')
                    setSuccess('Expense recorded. Counter updated.')
                    setExpenseForm((prev) => ({ ...prev, amount: '', note: '' }))
                    setShowExpenseCashModal(false)
                    setPendingExpensePayload(null)
                    fetchExpensesAndCategories()
                    fetchCashSessions()
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Failed to add expense')
                  }
                }}
                onApplyExpenseFilters={fetchExpensesAndCategories}
              />
            )}
          </div>
        )}

        {subTab === 'settings' && (
          <SettingsTabContent
            manageCashierCounterTab={manageCashierCounterTab}
            setManageCashierCounterTab={setManageCashierCounterTab}
            cashierSearchQuery={cashierSearchQuery}
            setCashierSearchQuery={setCashierSearchQuery}
            counterSearchQuery={counterSearchQuery}
            setCounterSearchQuery={setCounterSearchQuery}
            cashiers={cashiers}
            counters={counters}
            filteredCashiers={filteredCashiers}
            filteredCounters={filteredCounters}
            onOpenCreateCashier={() => {
              setEditingCashierId(null)
              setNewCashier({ name: '', phone: '' })
              setShowCreateCashierModal(true)
            }}
            onOpenEditCashier={(cashier) => {
              setEditingCashierId(cashier.id)
              setNewCashier({ name: cashier.name, phone: cashier.phone || '' })
              setShowCreateCashierModal(true)
            }}
            onDeleteCashier={handleDeleteCashier}
            onOpenCreateCounter={() => {
              setEditingCounterId(null)
              setNewCounterName('')
              setShowCreateCounterModal(true)
            }}
            onOpenEditCounter={(counter) => {
              setEditingCounterId(counter.id)
              setNewCounterName(counter.name)
              setShowCreateCounterModal(true)
            }}
            onDeleteCounter={handleDeleteCounter}
          />
        )}

        {subTab === 'returns' && (
          <div className="space-y-6">
            {!cashSessionsLoading && !activeCashSession && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <span className="font-medium">Start a cash session to process returns.</span>
                <span>Go to{' '}
                  <button
                    type="button"
                    onClick={() => setSubTab('cash_and_expenses')}
                    className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
                  >
                    Cash & expenses
                  </button>
                  {' '}and click <strong>Start shift</strong>.</span>
              </div>
            )}
            {/* Selling data – same as Overview */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] p-4 sm:p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Selling data</h3>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setOverviewDateRange(range)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${overviewDateRange === range ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6m' : range === 'year' ? 'Year' : 'All'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sales</p>
                  <p className="text-xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-emerald-600">Revenue</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sales returns</p>
                  <p className="text-xl font-bold text-rose-600">₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-rose-500">Refunded</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Bills</p>
                  <p className="text-xl font-bold text-slate-900">{periodSalesCount}</p>
                  <p className="text-[10px] text-slate-500">In period</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Payments by mode</h4>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-1.5 font-medium text-slate-700">Mode</th>
                        <th className="text-right py-1.5 font-medium text-slate-700">Bills</th>
                        <th className="text-right py-1.5 font-medium text-slate-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                        const row = paymentModeSummary[mode]
                        if (!row) return null
                        const label = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : mode === 'other' ? 'Other' : 'Not set'
                        return (
                          <tr key={mode} className="border-b border-slate-100 last:border-0">
                            <td className="py-1.5 text-slate-800">{label}</td>
                            <td className="py-1.5 text-right text-slate-700">{row.count}</td>
                            <td className="py-1.5 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Sales trend</h4>
                  <div className="h-32 w-full">
                    {salesTrendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">No data</div>
                    ) : (
                      <svg viewBox="0 0 400 120" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="salesTrendGradReturnsTab" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                          const pts = salesTrendData.map((d, i) => {
                            const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                            const y = 100 - (d.value / maxVal) * 80
                            return `${x},${y}`
                          }).join(' ')
                          const areaPoints = `${pts} 390,100 10,100`
                          return (
                            <>
                              <polyline fill="url(#salesTrendGradReturnsTab)" points={areaPoints} />
                              <polyline fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                            </>
                          )
                        })()}
                      </svg>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                    {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 8).map((d, i) => (
                      <span key={i}>{d.date}</span>
                    ))}
                  </div>
                </div>
              </div>
              {topSellingMedicines.length > 0 && (
                <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Top selling medicines</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {topSellingMedicines.map((m, i) => (
                      <span key={i} className="text-slate-700"><span className="font-medium text-slate-900">{m.name}</span> <span className="text-slate-500">×{m.count}</span></span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-2">Sales returns</h3>
              <p className="text-sm text-slate-500 mb-4">
                Click a sale to expand return details below that row, enter quantities to return, and the system will update stock and net sale amount automatically.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-semibold text-slate-800">Sales returns</h4>
                      {returnsInnerTab === 'by_return' && (
                        <div className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-100">
                          Total refunded: ₹{totalRefundForFilteredSales.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {filteredReturnSales.length} sale(s) with returns in current filters
                    </span>
                    <div className="mt-1 inline-flex rounded-full bg-slate-50 p-1 text-[11px] font-medium text-slate-600">
                      <button
                        type="button"
                        onClick={() => setReturnsInnerTab('by_sale')}
                        className={`px-3 py-1.5 rounded-full transition ${returnsInnerTab === 'by_sale' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                      >
                        By sale
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnsInnerTab('by_return')}
                        className={`px-3 py-1.5 rounded-full transition ${returnsInnerTab === 'by_return' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                      >
                        Return events
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={returnsDate}
                      onChange={(e) => setReturnsDate(e.target.value)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                      value={returnsPaymentFilter}
                      onChange={(e) => setReturnsPaymentFilter(e.target.value)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All payments</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="credit">Credit</option>
                      <option value="other">Other / Insurance</option>
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={returnsMinAmount}
                      onChange={(e) => setReturnsMinAmount(e.target.value)}
                      placeholder="Min amount"
                      className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={returnsMaxAmount}
                      onChange={(e) => setReturnsMaxAmount(e.target.value)}
                      placeholder="Max amount"
                      className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={returnsSearch}
                      onChange={(e) => setReturnsSearch(e.target.value)}
                      placeholder="Search by invoice, name, phone, medicine…"
                      className="w-full sm:w-56 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {(returnsDate || returnsSearch || returnsPaymentFilter !== 'all' || returnsMinAmount || returnsMaxAmount) && (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnsDate('')
                          setReturnsSearch('')
                          setReturnsPaymentFilter('all')
                          setReturnsMinAmount('')
                          setReturnsMaxAmount('')
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {loading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
                ) : returnsInnerTab === 'by_sale' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3">Invoice #</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Patient / Customer</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-right p-3">Net after returns</th>
                          <th className="text-right p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReturnSales.map((s) => {
                          const dateRaw = s.dispensedAt
                          const dateStr = !dateRaw
                            ? '—'
                            : typeof dateRaw === 'string'
                            ? dateRaw.slice(0, 10)
                            : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—'
                          const name = s.patientName || '—'
                          const total = s.totalAmount ?? 0
                          const refunded = s.refundedAmount ?? 0
                          const net = s.netAmount ?? Math.max(0, total - refunded)
                          const isSelected = selectedReturnSale?.id === s.id
                          const returnedMap = getSaleReturnedMap(s)
                          const saleLines = s.lines || []
                          const estimatedRefund = isSelected
                            ? saleLines.reduce((sum, l) => {
                                const raw = returnQuantities[l.medicineId] || ''
                                const qty = Math.floor(Number(raw) || 0)
                                const unit = Number(l.unitPrice) || 0
                                return sum + (qty > 0 ? qty * unit : 0)
                              }, 0)
                            : 0
                          return (
                            <React.Fragment key={s.id}>
                              <tr
                                className={`border-t border-slate-200 cursor-pointer hover:bg-slate-50 ${
                                  isSelected ? 'bg-blue-50/40' : ''
                                }`}
                                onClick={() => {
                                  if (selectedReturnSale?.id === s.id) {
                                    setSelectedReturnSale(null)
                                    setReturnQuantities({})
                                    setReturnReasonType('')
                                    setReturnReasonDetails('')
                                    setReturnSupervisorName('')
                                  } else {
                                    setSelectedReturnSale(s)
                                    setReturnQuantities({})
                                    setReturnReasonType('')
                                    setReturnReasonDetails('')
                                    setReturnSupervisorName('')
                                  }
                                }}
                              >
                                <td className="p-3 font-mono text-xs">{s.invoiceNumber ?? '—'}</td>
                                <td className="p-3">{dateStr}</td>
                                <td className="p-3">{name}</td>
                                <td className="p-3 text-right">₹{total}</td>
                                <td className="p-3 text-right">₹{net}</td>
                                <td className="p-3 text-right text-[11px] text-slate-500">
                                  Click row to enter return
                                </td>
                              </tr>
                              <tr
                                className={`border-t border-slate-200 bg-[#EEF3FF] transition-all duration-200 ease-out ${
                                  isSelected ? 'animate-[fadeExpand_0.18s_ease-out] opacity-100' : 'hidden opacity-0'
                                }`}
                              >
                                <td colSpan={6} className="p-3">
                                  <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-3 sm:p-4">
                                    <form
                                      onSubmit={async (e) => {
                                        e.preventDefault()
                                        if (!activeCashSession) {
                                          setError('Please start a cash session first to process returns (Cash & expenses → Start shift).')
                                          return
                                        }
                                        if (!returnReasonType) {
                                          setError('Select a return reason before processing the return.')
                                          return
                                        }
                                        if (returnReasonType === 'other' && returnReasonDetails.trim().length < 3) {
                                          setError('Please add a short note for "Other reason".')
                                          return
                                        }
                                        const lines = saleLines
                                        const retMap = getSaleReturnedMap(s)
                                        const payloadLines = lines
                                          .map((l) => {
                                            const raw = returnQuantities[l.medicineId] || ''
                                            const qty = Math.floor(Number(raw) || 0)
                                            if (qty <= 0) return null
                                            const sold = Number(l.quantity) || 0
                                            const alreadyReturned = Number(retMap[l.medicineId] || 0)
                                            const maxReturn = Math.max(0, sold - alreadyReturned)
                                            const clampedQty = Math.min(qty, maxReturn)
                                            return clampedQty > 0 ? { medicineId: l.medicineId, quantity: clampedQty } : null
                                          })
                                          .filter(Boolean) as { medicineId: string; quantity: number }[]
                                        if (payloadLines.length === 0) {
                                          setError('Enter at least one quantity to return.')
                                          return
                                        }
                                        const refundAmount = payloadLines.reduce((sum, pl) => {
                                          const line = saleLines.find((l) => l.medicineId === pl.medicineId)
                                          return sum + (line ? pl.quantity * (Number(line.unitPrice) || 0) : 0)
                                        }, 0)
                                        if (refundAmount >= 2000 && !returnSupervisorName.trim()) {
                                          setError('Supervisor name is required for high-value returns (>= ₹2000).')
                                          return
                                        }
                                        const lineSummaries = payloadLines.map((pl) => {
                                          const line = saleLines.find((l) => l.medicineId === pl.medicineId)
                                          const unitPrice = Number(line?.unitPrice) || 0
                                          return {
                                            medicineName: line?.medicineName || pl.medicineId,
                                            quantity: pl.quantity,
                                            unitPrice,
                                            amount: pl.quantity * unitPrice,
                                          }
                                        })
                                        const baseReasonLabel = RETURN_REASON_OPTIONS.find((opt) => opt.value === returnReasonType)?.label || 'Other reason'
                                        const reasonNoteBase = returnReasonType === 'other'
                                          ? `Other reason: ${returnReasonDetails.trim()}`
                                          : returnReasonDetails.trim()
                                            ? `${baseReasonLabel} - ${returnReasonDetails.trim()}`
                                            : baseReasonLabel
                                        const reasonNote = returnSupervisorName.trim()
                                          ? `${reasonNoteBase} | Supervisor: ${returnSupervisorName.trim()}`
                                          : reasonNoteBase
                                        setError(null)
                                        setPendingReturnPayload({
                                          saleId: s.id,
                                          lines: payloadLines,
                                          lineSummaries,
                                          refundAmount,
                                          note: reasonNote,
                                        })
                                        setRefundPaymentMode('cash')
                                        setShowRefundPaymentModal(true)
                                      }}
                                      className="space-y-3"
                                    >
                                      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                                        <div>
                                          <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                                            Return reason <span className="text-rose-600">*</span>
                                          </label>
                                          <select
                                            value={returnReasonType}
                                            onChange={(e) => setReturnReasonType(e.target.value as '' | 'damaged' | 'wrong_medicine' | 'doctor_changed' | 'patient_request' | 'expired' | 'other')}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            required
                                          >
                                            <option value="">Select reason</option>
                                            {RETURN_REASON_OPTIONS.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                                            Notes {returnReasonType === 'other' ? <span className="text-rose-600">*</span> : '(optional)'}
                                          </label>
                                          <input
                                            type="text"
                                            value={returnReasonDetails}
                                            onChange={(e) => setReturnReasonDetails(e.target.value)}
                                            placeholder={returnReasonType === 'other' ? 'Describe reason' : 'Add context for audit trail'}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                                            Supervisor (required if refund &gt;= ₹2000)
                                          </label>
                                          <input
                                            type="text"
                                            value={returnSupervisorName}
                                            onChange={(e) => setReturnSupervisorName(e.target.value)}
                                            placeholder="Name / ID"
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>
                                      <div className="text-xs text-slate-600">
                                        Invoice&nbsp;
                                        <span className="font-mono">{s.invoiceNumber ?? s.id}</span>
                                      </div>
                                      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                                        <table className="w-full text-[11px]">
                                          <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                              <th className="text-left px-2 py-1.5">Medicine</th>
                                              <th className="text-right px-2 py-1.5">Returnable</th>
                                              <th className="text-right px-2 py-1.5">Unit price</th>
                                              <th className="text-right px-2 py-1.5">Return qty</th>
                                              <th className="text-right px-2 py-1.5">Line refund</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {saleLines.map((l) => {
                                              const key = l.medicineId
                                              const raw = returnQuantities[key] || ''
                                              const qty = Math.floor(Number(raw) || 0)
                                              const unit = Number(l.unitPrice) || 0
                                              const sold = Number(l.quantity) || 0
                                              const alreadyReturned = Number(returnedMap[l.medicineId] || 0)
                                              const remaining = Math.max(0, sold - alreadyReturned)
                                              const lineRefund = qty > 0 ? qty * unit : 0
                                              return (
                                                <tr key={key} className="border-t border-slate-200">
                                                  <td className="px-2 py-1.5 font-medium text-slate-900">
                                                    {l.medicineName}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right text-slate-700">
                                                    {alreadyReturned > 0 && (
                                                      <span className="text-[10px] text-slate-400 mr-1">
                                                        (sold {sold}, returned {alreadyReturned})
                                                      </span>
                                                    )}
                                                    {remaining}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right text-slate-700">
                                                    ₹{unit.toFixed(2)}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right">
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      max={remaining}
                                                      value={returnQuantities[key] ?? ''}
                                                      disabled={remaining === 0}
                                                      onChange={(e) => {
                                                        const v = e.target.value
                                                        if (v === '') {
                                                          setReturnQuantities((prev) => ({ ...prev, [key]: '' }))
                                                          return
                                                        }
                                                        const num = Math.floor(Number(v)) || 0
                                                        const clamped = Math.min(Math.max(0, num), remaining)
                                                        setReturnQuantities((prev) => ({ ...prev, [key]: String(clamped) }))
                                                      }}
                                                      onBlur={(e) => {
                                                        const v = e.target.value
                                                        if (v === '') return
                                                        const num = Math.floor(Number(v)) || 0
                                                        const clamped = Math.min(Math.max(0, num), remaining)
                                                        setReturnQuantities((prev) => ({ ...prev, [key]: clamped > 0 ? String(clamped) : '' }))
                                                      }}
                                                      className={`w-16 rounded-full border px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                                                        remaining === 0 ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'
                                                      }`}
                                                    />
                                                    <div className="mt-0.5 text-[10px] text-slate-500">max {remaining}</div>
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right text-slate-700">
                                                    ₹{lineRefund.toFixed(2)}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-slate-700">
                                        <span>
                                          Refund amount:&nbsp;
                                          <span className="font-semibold text-rose-600">
                                            ₹{estimatedRefund.toFixed(2)}
                                          </span>
                                        </span>
                                        <button
                                          type="submit"
                                          disabled={returnSubmitting || !activeCashSession}
                                          title={!activeCashSession ? 'Start a cash session first (Cash & expenses → Start shift)' : ''}
                                          className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {returnSubmitting ? 'Processing…' : 'Process return & update stock'}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                  </td>
                                </tr>
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Patient / Customer</th>
                          <th className="text-left p-3">Invoice #</th>
                          <th className="text-left p-3">Phone</th>
                          <th className="text-left p-3">Payment</th>
                          <th className="text-right p-3">Refund amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnEvents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6">
                              <ActionEmptyState
                                title="No returns recorded yet."
                                hint="Return events will appear here after processing from the By Sale tab."
                                actions={[
                                  { label: 'Go to By Sale', onClick: () => setReturnsInnerTab('by_sale'), variant: 'secondary' },
                                ]}
                              />
                            </td>
                          </tr>
                        ) : (
                          returnEvents.map((r) => (
                            <tr key={r.id} className="border-t border-slate-200 align-top">
                              <td className="p-3">
                                {r.createdAt ? r.createdAt.toISOString().slice(0, 10) : '—'}
                              </td>
                              <td className="p-3">
                                <div className="text-slate-900 font-medium">{r.patientName}</div>
                              </td>
                              <td className="p-3 font-mono text-xs">{r.invoice}</td>
                              <td className="p-3 text-slate-700">{r.phone || '—'}</td>
                              <td className="p-3 text-slate-700">
                                {r.paymentMode
                                  ? r.paymentMode.charAt(0).toUpperCase() + r.paymentMode.slice(1)
                                  : '—'}
                              </td>
                              <td className="p-3 text-right text-rose-600 font-semibold">
                                ₹{r.amount.toFixed(2)}
                                <div className="mt-1 text-[10px] text-slate-500">
                                  {r.lines.map((l) => (
                                    <div key={l.medicineId}>
                                      {l.medicineName} × {l.quantity} @ ₹{l.unitPrice.toFixed(2)}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredReturnSales.length > 0 && (
                  <Pagination
                    currentPage={returnsPage}
                    totalPages={returnsTotalPages}
                    pageSize={returnsPageSize}
                    totalItems={filteredReturnSales.length}
                    onPageChange={goToReturnsPage}
                    onPageSizeChange={setReturnsPageSize}
                    itemLabel="sales"
                    className="border-t border-slate-200"
                  />
                )}

                {showRefundPaymentModal && pendingReturnPayload && (
                  <RevealModal
                    isOpen
                    onClose={() => {
                      setShowRefundPaymentModal(false)
                      setPendingReturnPayload(null)
                    }}
                  >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
                      <div className="border-b border-slate-200 px-6 pt-6 pb-4">
                        <h2 className="text-xl font-bold text-slate-800">Refund payment</h2>
                        <p className="text-sm text-slate-500 mt-1">How are you giving the refund to the customer?</p>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
                          <p className="text-sm font-medium text-rose-700">Refund amount</p>
                          <p className="text-2xl font-bold text-rose-900">₹{pendingReturnPayload.refundAmount.toFixed(2)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Return summary</p>
                          <p className="mt-1 text-sm text-slate-700">{pendingReturnPayload.note}</p>
                          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Medicine</th>
                                  <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Qty</th>
                                  <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pendingReturnPayload.lineSummaries.map((line, idx) => (
                                  <tr key={`${line.medicineName}-${idx}`} className="border-t border-slate-100">
                                    <td className="px-2 py-1.5 text-slate-700">{line.medicineName}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-600">{line.quantity}</td>
                                    <td className="px-2 py-1.5 text-right font-medium text-slate-800">₹{line.amount.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Payment method</p>
                          <div className="flex flex-wrap gap-2">
                            {(['cash', 'upi', 'card', 'other'] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setRefundPaymentMode(m)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
                                  refundPaymentMode === m
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRefundPaymentModal(false)
                              setPendingReturnPayload(null)
                            }}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (refundPaymentMode === 'cash') {
                                setShowRefundCashModal(true)
                              } else {
                                submitReturn(refundPaymentMode)
                              }
                            }}
                            disabled={returnSubmitting}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                          >
                            {refundPaymentMode === 'cash' ? 'Enter notes…' : 'Confirm refund'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </RevealModal>
                )}

                {pendingReturnPayload && (
                  <RefundCashModal
                    isOpen={showRefundCashModal}
                    onClose={() => setShowRefundCashModal(false)}
                    refundAmount={pendingReturnPayload.refundAmount}
                    onConfirm={(notes) => {
                      submitReturn('cash', notes)
                    }}
                  />
                )}
              </div>
          </div>
        )}

        {subTab === 'suppliers' && (
          <SuppliersTabContent
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            supplierSearchQuery={supplierSearchQuery}
            setSupplierSearchQuery={setSupplierSearchQuery}
            onOpenAddSupplier={() => setAddSupplierModalOpen(true)}
            filteredSuppliers={filteredSuppliers}
            paginatedSuppliers={paginatedSuppliers}
            loading={loading}
            onViewSupplier={setViewSupplier}
            onEditSupplier={setEditSupplier}
            onDeleteSupplier={async (supplier) => {
              const pendingOrdersForSupplier = purchaseOrders.filter(
                (o) => o.supplierId === supplier.id && (o.status ?? '').toLowerCase() === 'pending'
              ).length
              if (pendingOrdersForSupplier > 0) {
                const continueDelete = window.confirm(
                  `Supplier "${supplier.name}" has ${pendingOrdersForSupplier} pending order(s).\n\nDeleting now can disrupt pending-order follow-up. Continue anyway?`
                )
                if (!continueDelete) return
              }
              if (!window.confirm(
                `Delete supplier "${supplier.name}"?\n\nThis will remove supplier master data from active lists. Historical purchases remain in records.`
              )) return
              const token = await getToken()
              if (!token) {
                setError('Not authenticated')
                return
              }
              const client = createPharmacyApiClient(token)
              const result = await client.deleteSupplier(supplier.id)
              if (result.ok && result.data.success) {
                setSuccess('Supplier deleted')
                fetchPharmacy()
              } else {
                setError((result.data.error as string) || 'Failed to delete')
              }
            }}
            supplierPage={supplierPage}
            supplierTotalPages={supplierTotalPages}
            supplierPageSize={supplierPageSize}
            goToSupplierPage={goToSupplierPage}
            setSupplierPageSize={setSupplierPageSize}
          />
        )}

        {/* Add Supplier modal */}
        {addSupplierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAddSupplierModalOpen(false)} aria-hidden />
            <div className="relative w-full max-w-md rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[#263238] mb-4">Add Supplier</h3>
              <AddSupplierForm
                onSuccess={() => { setSuccess('Supplier added'); fetchPharmacy(); setAddSupplierModalOpen(false); }}
                onError={setError}
                getToken={getToken}
                hospitalId={activeHospitalId!}
              />
              <button type="button" onClick={() => setAddSupplierModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg text-[#607D8B] hover:bg-[#F5F5F5]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* View Supplier modal */}
        {viewSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setViewSupplier(null)} aria-hidden />
            <div className="relative w-full max-w-lg rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[#263238] mb-4">Supplier details</h3>
              <dl className="space-y-2 text-sm">
                <div><dt className="font-medium text-[#607D8B]">Name</dt><dd className="text-[#263238]">{viewSupplier.name}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Company / Contact</dt><dd className="text-[#263238]">{viewSupplier.contactPerson ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Phone</dt><dd className="text-[#263238]">{viewSupplier.phone ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Email</dt><dd className="text-[#263238]">{viewSupplier.email ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Address</dt><dd className="text-[#263238]">{viewSupplier.address ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Payment terms</dt><dd className="text-[#263238]">{viewSupplier.paymentTerms ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Lead time (days)</dt><dd className="text-[#263238]">{viewSupplier.leadTimeDays != null ? viewSupplier.leadTimeDays : '—'}</dd></div>
              </dl>
              <button type="button" onClick={() => setViewSupplier(null)} className="mt-4 rounded-lg bg-[#1565C0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D47A1]">Close</button>
              <button type="button" onClick={() => setViewSupplier(null)} className="absolute top-4 right-4 p-1 rounded-lg text-[#607D8B] hover:bg-[#F5F5F5]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* Edit Supplier modal */}
        {editSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditSupplier(null)} aria-hidden />
            <div className="relative w-full max-w-md rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[#263238] mb-4">Edit Supplier</h3>
              <EditSupplierForm
                supplier={editSupplier}
                onSuccess={() => { setSuccess('Supplier updated'); fetchPharmacy(); setEditSupplier(null); }}
                onError={setError}
                onCancel={() => setEditSupplier(null)}
                getToken={getToken}
              />
              <button type="button" onClick={() => setEditSupplier(null)} className="absolute top-4 right-4 p-1 rounded-lg text-[#607D8B] hover:bg-[#F5F5F5]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {subTab === 'orders' && (
          <OrdersTabContent
            isViewOnly={isViewOnly}
            branches={branches}
            suppliers={suppliers}
            medicines={medicines}
            lowStock={lowStock}
            branchFilter={branchFilter}
            selectedBranchName={selectedBranchName}
            pendingAddToOrder={pendingAddToOrder}
            onConsumePendingAddToOrder={() => setPendingAddToOrder(null)}
            onSuccess={(message) => setSuccess(message)}
            onError={(message) => setError(message)}
            getToken={getToken}
            loading={loading}
            paginatedOrders={paginatedOrders}
            purchaseOrders={purchaseOrders}
            ordersForTableCount={ordersForTable.length}
            ordersPage={ordersPage}
            ordersTotalPages={ordersTotalPages}
            ordersPageSize={ordersPageSize}
            goToOrdersPage={goToOrdersPage}
            setOrdersPageSize={setOrdersPageSize}
            setReceiveOrder={setReceiveOrder}
            setReceiveDetailsForm={setReceiveDetailsForm}
            setReceiveSupplierInvoice={setReceiveSupplierInvoice}
            selectedOrderDetail={selectedOrderDetail}
            setSelectedOrderDetail={setSelectedOrderDetail}
            receiveOrder={receiveOrder}
            receiveDetailsForm={receiveDetailsForm}
            receiveSupplierInvoice={receiveSupplierInvoice}
            receiveSubmitting={receiveSubmitting}
            setReceiveSubmitting={setReceiveSubmitting}
            fetchPharmacy={() => fetchPharmacy()}
            activeHospitalName={activeHospital?.name}
            activeHospitalAddress={activeHospital?.address}
            cancelOrderSubmitting={cancelOrderSubmitting}
            setCancelOrderSubmitting={setCancelOrderSubmitting}
          />
        )}

        {subTab === 'reports' && (
          <ReportsTabContent
            reportType={reportType}
            setReportType={setReportType}
            expiryReportDays={expiryReportDays}
            setExpiryReportDays={setExpiryReportDays}
            expiryReportRows={expiryReportRows}
            valuationReportRows={valuationReportRows}
            stockSoldReportPeriod={stockSoldReportPeriod}
            setStockSoldReportPeriod={setStockSoldReportPeriod}
            stockSoldReportData={stockSoldReportData}
            branchFilter={branchFilter}
            salesByProductRows={salesByProductRows}
            salesByBranchRows={salesByBranchRows}
            overUnderStockRows={overUnderStockRows}
            reorderSuggestionsRows={reorderSuggestionsRows}
          />
        )}

        {subTab === 'transfers' && isSuperAdmin && (
          <TransfersTabContent
            branches={branches}
            medicines={medicines}
            transfers={transfers}
            loading={loading}
            getToken={getToken}
            hospitalId={activeHospitalId!}
            onSuccess={(message) => setSuccess(message)}
            onError={(message) => setError(message)}
            fetchPharmacy={() => fetchPharmacy()}
          />
        )}

        {subTab === 'users' && isAdmin && (
          <UsersTabContent
            pharmacists={pharmacists}
            loading={loading}
            onOpenCreatePharmacist={() => {
              setPharmacistForm({ firstName: '', lastName: '', email: '', password: '', branchId: '' })
              setShowAddPharmacistModal(true)
            }}
          />
        )}
        </div>
      </div>

        {editMinLevelMedicine && (
          <EditMinLevelModal
            medicine={editMinLevelMedicine}
            onSave={() => { setSuccess('Minimum stock level updated.'); fetchPharmacy(); setEditMinLevelMedicine(null); }}
            onError={setError}
            onClose={() => setEditMinLevelMedicine(null)}
            getToken={getToken}
          />
        )}

        {addMedicineModalBarcode !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setAddMedicineModalBarcode(null)}>
            <div
              role="dialog"
              aria-modal="true"
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-slate-800 text-lg mb-2">Add medicine</h3>
              <p className="text-sm text-slate-600 mb-4">Barcode <strong>{addMedicineModalBarcode}</strong> is pre-filled. Enter name and other details, then save.</p>
              <AddMedicineForm
                hospitalId={activeHospitalId ?? ''}
                supplierOptions={suppliers}
                initialBarcode={addMedicineModalBarcode}
                getToken={getToken}
                onSuccess={() => {
                  setSuccess('Medicine added. You can now use it in sales or orders.')
                  fetchPharmacy()
                  setAddMedicineModalBarcode(null)
                }}
                onError={setError}
              />
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setAddMedicineModalBarcode(null)} className="btn-modern btn-modern-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {viewShiftReportSession && (
          <RevealModal isOpen onClose={() => setViewShiftReportSession(null)} zIndex={100} contentClassName="w-full max-w-2xl max-h-[90vh] flex flex-col min-h-0 mx-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200/80 flex flex-col min-h-0 flex-1">
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Shift report</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {viewShiftReportSession.closedAt
                        ? new Date(typeof viewShiftReportSession.closedAt === 'string' ? viewShiftReportSession.closedAt : (viewShiftReportSession.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? '').toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
                        : 'Closed session'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewShiftReportSession(null)}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 sm:p-8 space-y-4 overflow-y-auto min-h-0 flex-1">
                {(() => {
                  const s = viewShiftReportSession
                  const cash = Number(s.cashSales ?? 0)
                  const upi = Number(s.upiSales ?? 0)
                  const card = Number(s.cardSales ?? 0)
                  const refunds = Number(s.refunds ?? 0)
                  const changeGiven = Number(s.changeGiven ?? 0)
                  const cashExp = Number(s.cashExpenses ?? 0)
                  const opening = Number(s.openingCashTotal ?? 0)
                  const expected = Number(s.expectedCash ?? 0)
                  const closing = Number(s.closingCashTotal ?? 0)
                  const diff = Number(s.difference ?? 0)
                  const totalCollection = cash + upi + card - refunds
                  const totalIncome = cash + upi + card
                  const totalExpense = cashExp
                  const DENOMS = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
                  const runningNotes = s.runningNotes || {}
                  const closingNotes = s.closingNotes || {}
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 block text-xs">Opened by</span>
                          <span className="font-medium text-slate-800">{s.openedByName ?? '—'}</span>
                          <span className="text-slate-500 block text-xs mt-0.5">
                            {s.openedAt ? new Date(typeof s.openedAt === 'string' ? s.openedAt : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? '').toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-xs">Closed by</span>
                          <span className="font-medium text-slate-800">{s.closedByName ?? '—'}</span>
                          <span className="text-slate-500 block text-xs mt-0.5">
                            {s.closedAt ? new Date(typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? '').toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                        <p className="text-xs font-medium text-emerald-700 mb-1">Total income</p>
                        <p className="text-xl font-bold text-emerald-900 tabular-nums">₹{totalIncome.toFixed(2)}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Cash + UPI + Card sales</p>
                      </div>
                      {totalExpense > 0 && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                          <p className="text-xs font-medium text-amber-700 mb-1">Total expense</p>
                          <p className="text-xl font-bold text-amber-900 tabular-nums">₹{totalExpense.toFixed(2)}</p>
                          <p className="text-xs text-amber-600 mt-0.5">Cash expenses from counter</p>
                        </div>
                      )}
                      {shiftReportExpenses.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          <h3 className="text-sm font-semibold text-slate-800 mb-2">Expenses in this shift</h3>
                          <ul className="space-y-1.5 text-sm">
                            {shiftReportExpenses.map((ex) => (
                              <li key={ex.id} className="flex justify-between items-start gap-2">
                                <span className="text-slate-700 truncate flex-1" title={ex.description ?? ex.categoryName ?? ''}>
                                  {ex.description || ex.categoryName || 'Expense'}
                                </span>
                                <span className="font-medium tabular-nums text-slate-900 shrink-0">₹{Number(ex.amount || 0).toFixed(2)}</span>
                                <span className="text-xs capitalize text-slate-500 shrink-0">({ex.paymentMethod})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Opening cash</span>
                          <span className="font-semibold tabular-nums">₹{opening.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Cash sales</span>
                          <span className="font-medium tabular-nums">₹{cash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">UPI sales</span>
                          <span className="font-medium tabular-nums">₹{upi.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Card sales</span>
                          <span className="font-medium tabular-nums">₹{card.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span>Refunds</span>
                          <span className="font-medium tabular-nums">−₹{refunds.toFixed(2)}</span>
                        </div>
                        {changeGiven > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Change given</span>
                            <span className="tabular-nums">−₹{changeGiven.toFixed(2)}</span>
                          </div>
                        )}
                        {changeGiven > 0 && s.changeNotesTotal && (() => {
                          const cnt = s.changeNotesTotal
                          const hasBreakdown = DENOMS.some((d) => (Number(cnt[d]) || 0) > 0)
                          if (!hasBreakdown) return null
                          return (
                            <div className="pl-2 text-xs text-slate-500 border-l-2 border-slate-200">
                              <span className="font-medium text-slate-600">Change given (notes/coins): </span>
                              {DENOMS.map((d) => {
                                const n = Number(cnt[d]) || 0
                                if (n === 0) return null
                                return <span key={d} className="tabular-nums mr-2">₹{d}×{n}</span>
                              })}
                            </div>
                          )
                        })()}
                        {cashExp > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Cash expenses</span>
                            <span className="tabular-nums">−₹{cashExp.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 pt-2 flex justify-between">
                          <span className="text-slate-600">Expected cash in drawer</span>
                          <span className="font-semibold tabular-nums">₹{expected.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Actual closing cash</span>
                          <span className="font-semibold tabular-nums">₹{closing.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-700 font-medium">Difference</span>
                          <span className={`font-semibold tabular-nums ${diff === 0 ? 'text-slate-700' : diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {diff === 0 ? 'Balanced' : diff < 0 ? `Short ₹${Math.abs(diff).toFixed(2)}` : `Extra ₹${diff.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-800 mb-2">Notes in counter</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 font-medium text-slate-600">Denomination</th>
                                <th className="text-right py-2 font-medium text-slate-600">Expected</th>
                                <th className="text-right py-2 font-medium text-slate-600">Actual</th>
                                <th className="text-right py-2 font-medium text-slate-600">Diff</th>
                              </tr>
                            </thead>
                            <tbody>
                              {DENOMS.map((d) => {
                                const exp = Number(runningNotes[d]) || 0
                                const act = Number(closingNotes[d]) || 0
                                const rowDiff = act - exp
                                return (
                                  <tr key={d} className="border-b border-slate-100">
                                    <td className="py-1.5 text-slate-700">₹{d}</td>
                                    <td className="text-right tabular-nums">{exp}</td>
                                    <td className="text-right tabular-nums">{act}</td>
                                    <td className={`text-right tabular-nums ${rowDiff === 0 ? 'text-slate-600' : rowDiff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {rowDiff === 0 ? '—' : rowDiff > 0 ? `+${rowDiff}` : rowDiff}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Expected = notes in drawer at close (from sales). Actual = count entered when closing.</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 mb-1">Total collection (net sales)</p>
                        <p className="text-xl font-bold text-slate-900 tabular-nums">₹{totalCollection.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Cash + UPI + Card − Refunds</p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </RevealModal>
        )}

        {showCloseShiftConfirm && activeCashSession && (
          <RevealModal
            isOpen
            onClose={() => {
              setShowCloseShiftConfirm(false)
              setCloseChecklist({
                countedCash: false,
                reviewedRefundsAndExpenses: false,
                varianceAcknowledged: false,
              })
              setCloseVarianceReason('')
              setCloseHandoverNote('')
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl shrink-0">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Close shift</h2>
                <p className="text-sm text-slate-500 mt-1">Confirm closing this shift. Start and close times are recorded.</p>
              </div>
              <div className="p-6 sm:p-8 space-y-5">
                <p className="text-slate-700 font-medium">Are you sure you want to close this shift?</p>
                <ShiftCloseChecklist
                  difference={closeShiftPreview.difference}
                  expectedCash={closeShiftPreview.expectedCash}
                  actualCash={closeShiftPreview.actualCash}
                  closedByName={closedByName}
                  onClosedByNameChange={setClosedByName}
                  closeVarianceReason={closeVarianceReason}
                  onCloseVarianceReasonChange={setCloseVarianceReason}
                  closeHandoverNote={closeHandoverNote}
                  onCloseHandoverNoteChange={setCloseHandoverNote}
                  closeChecklist={closeChecklist}
                  onCloseChecklistChange={setCloseChecklist}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCloseShiftConfirm(false)
                      setCloseChecklist({
                        countedCash: false,
                        reviewedRefundsAndExpenses: false,
                        varianceAcknowledged: false,
                      })
                      setCloseVarianceReason('')
                      setCloseHandoverNote('')
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const token = await getToken()
                      if (!token || !activeCashSession) return
                      if (!closeChecklist.countedCash || !closeChecklist.reviewedRefundsAndExpenses) {
                        setError('Please complete the close-shift checklist before closing.')
                        return
                      }
                      if (closeShiftPreview.difference !== 0 && !closeChecklist.varianceAcknowledged) {
                        setError('Please acknowledge the non-zero cash variance before closing.')
                        return
                      }
                      if (closeShiftPreview.difference !== 0 && !closeVarianceReason) {
                        setError('Please select a variance reason before closing.')
                        return
                      }
                      if (closeHandoverNote.trim().length < 5) {
                        setError('Please add a handover note before closing the shift.')
                        return
                      }
                      setShowCloseShiftConfirm(false)
                      const closingNotesNum: Record<string, number> = {}
                      CASH_DENOMS.forEach((den) => {
                        const count = Math.max(0, Number(cashClosingNotes[den] || 0))
                        closingNotesNum[den] = count
                      })
                      const closingTotal = closeShiftPreview.actualCash
                      const body = {
                        action: 'close',
                        sessionId: activeCashSession.id,
                        closingNotes: closingNotesNum,
                        closingCashTotal: closingTotal,
                        closedByName: closedByName || undefined,
                        varianceReason: closeVarianceReason || undefined,
                        handoverNote: closeHandoverNote.trim(),
                        cashSales: sessionSales
                          .filter((s) => s.paymentMode === 'cash')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0),
                        upiSales: sessionSales
                          .filter((s) => s.paymentMode === 'upi')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0),
                        cardSales: sessionSales
                          .filter((s) => s.paymentMode === 'card')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0),
                        refunds: sessionSales.reduce((sum, s) => sum + Number(s.refundedAmount || 0), 0),
                        cashRefunds: sessionSales
                          .filter((s) => s.paymentMode === 'cash')
                          .reduce((sum, s) => sum + Number(s.refundedAmount || 0), 0),
                        changeGiven: Number(activeCashSession?.changeGiven ?? 0),
                        hospitalId: activeHospitalId,
                        branchId: branchFilter === 'all' ? undefined : branchFilter,
                      }
                      try {
                        const client = createPharmacyApiClient(token)
                        const result = await client.upsertCashSession(body)
                        if (!result.ok || !result.data.success) {
                          setError((result.data.error as string) || 'Failed to close cash session')
                          return
                        }
                        setSuccess('Counter closed and report saved.')
                        setActiveCashSession(null)
                        setCashClosingNotes(createEmptyCashNotes())
                        const closed = result.data.session as PharmacyCashSession | undefined
                        if (closed) {
                          const cash = Number(closed.cashSales ?? 0)
                          const upi = Number(closed.upiSales ?? 0)
                          const card = Number(closed.cardSales ?? 0)
                          const refunds = Number(closed.refunds ?? 0)
                          const cashExp = Number(closed.cashExpenses ?? 0)
                          const totalCollection = cash + upi + card - refunds
                          setLastClosedSummary({
                            openingCashTotal: Number(closed.openingCashTotal ?? 0),
                            closingCashTotal: Number(closed.closingCashTotal ?? 0),
                            cashSales: cash,
                            upiSales: upi,
                            cardSales: card,
                            refunds,
                            cashExpenses: cashExp,
                            profit: totalCollection - cashExp,
                          })
                        }
                        fetchCashSessions()
                        openCounterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      } catch (e: any) {
                        setError(e?.message || 'Failed to close cash session')
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
                  >
                    Yes, close shift
                  </button>
                </div>
              </div>
            </div>
          </RevealModal>
        )}

        {showCreateCashierModal && (
          <RevealModal isOpen onClose={() => setShowCreateCashierModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingCashierId ? 'Edit cashier' : 'Create cashier'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Add or update a cashier for assigning shifts.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newCashier.name}
                    onChange={(e) => setNewCashier((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Raj"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone / ID (optional)</label>
                  <input
                    type="text"
                    value={newCashier.phone}
                    onChange={(e) => setNewCashier((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCashierModal(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCashier.name.trim()) {
                        setError('Cashier name is required.')
                        return
                      }
                      const token = await getToken()
                      if (!token || !activeHospitalId) return
                      try {
                        const client = createPharmacyApiClient(token)
                        if (editingCashierId) {
                          const result = await client.updateCashier(editingCashierId, {
                            name: newCashier.name,
                            phone: newCashier.phone,
                          })
                          if (!result.ok || !result.data.success) {
                            setError((result.data.error as string) || 'Failed to update cashier')
                            return
                          }
                          setCashiers((prev) =>
                            prev.map((c) => (c.id === editingCashierId ? ((result.data.cashier as PharmacyCashierProfile | undefined) ?? c) : c)),
                          )
                        } else {
                          const result = await client.createCashier({
                            name: newCashier.name,
                            phone: newCashier.phone,
                            branchId: branchFilter === 'all' ? undefined : branchFilter,
                          })
                          if (!result.ok || !result.data.success) {
                            setError((result.data.error as string) || 'Failed to create cashier')
                            return
                          }
                          const cashier = result.data.cashier as PharmacyCashierProfile | undefined
                          if (cashier) setCashiers((prev) => [...prev, cashier])
                        }
                        setNewCashier({ name: '', phone: '' })
                        setEditingCashierId(null)
                        setShowCreateCashierModal(false)
                      } catch (e: any) {
                        setError(e?.message || 'Failed to save cashier')
                      }
                    }}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </RevealModal>
        )}

        {showCreateCounterModal && (
          <RevealModal isOpen onClose={() => setShowCreateCounterModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingCounterId ? 'Edit counter' : 'Create counter'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Add or update a billing counter for assigning shifts.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Counter name</label>
                  <input
                    type="text"
                    value={newCounterName}
                    onChange={(e) => setNewCounterName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Counter 1, Night counter"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCounterModal(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCounterName.trim()) {
                        setError('Counter name is required.')
                        return
                      }
                      const token = await getToken()
                      if (!token || !activeHospitalId) return
                      try {
                        const client = createPharmacyApiClient(token)
                        if (editingCounterId) {
                          const result = await client.updateCounter(editingCounterId, {
                            name: newCounterName,
                          })
                          if (!result.ok || !result.data.success) {
                            setError((result.data.error as string) || 'Failed to update counter')
                            return
                          }
                          setCounters((prev) =>
                            prev.map((c) => (c.id === editingCounterId ? ((result.data.counter as PharmacyCounter | undefined) ?? c) : c)),
                          )
                        } else {
                          const result = await client.createCounter({
                            name: newCounterName,
                            branchId: branchFilter === 'all' ? undefined : branchFilter,
                          })
                          if (!result.ok || !result.data.success) {
                            setError((result.data.error as string) || 'Failed to create counter')
                            return
                          }
                          const counter = result.data.counter as PharmacyCounter | undefined
                          if (counter) setCounters((prev) => [...prev, counter])
                        }
                        setNewCounterName('')
                        setEditingCounterId(null)
                        setShowCreateCounterModal(false)
                      } catch (e: any) {
                        setError(e?.message || 'Failed to save counter')
                      }
                    }}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </RevealModal>
        )}

        {showAddPharmacistModal && (
          <RevealModal isOpen onClose={() => setShowAddPharmacistModal(false)}>
            <AddPharmacistModalContent
              form={pharmacistForm}
              setForm={setPharmacistForm}
              branches={branches}
              saving={false}
              onSubmit={async (e) => {
                e.preventDefault()
                if (!pharmacistForm.email.trim() || !pharmacistForm.password) {
                  setError('Email and password are required')
                  return
                }
                if (pharmacistForm.password.length < 6) {
                  setError('Password must be at least 6 characters')
                  return
                }
                try {
                  const token = await getToken()
                  if (!token) { setError('Not authenticated'); return }
                  const res = await fetch('/api/admin/create-pharmacist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      email: pharmacistForm.email.trim().toLowerCase(),
                      password: pharmacistForm.password,
                      firstName: pharmacistForm.firstName.trim(),
                      lastName: pharmacistForm.lastName.trim(),
                      branchId: pharmacistForm.branchId || undefined,
                    }),
                  })
                  const data = await res.json()
                  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create pharmacist')
                  setShowAddPharmacistModal(false)
                  setSuccess(`Pharmacist created. They can login at /auth/login?role=pharmacy with email: ${pharmacistForm.email.trim()} and the password you set.`)
                  fetchPharmacy()
                } catch (err: any) {
                  setError(err?.message || 'Failed to create pharmacist')
                }
              }}
            />
          </RevealModal>
        )}

        <ConfirmDialog
          isOpen={!!inventoryDeleteTarget}
          title="Remove from branch inventory?"
          message={
            inventoryDeleteTarget
              ? `This will remove "${inventoryDeleteTarget.medicineName}" from this branch's inventory. Existing sales history will remain.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          confirmLoading={inventoryDeleteLoading}
          onCancel={() => {
            if (inventoryDeleteLoading) return
            setInventoryDeleteTarget(null)
          }}
          onConfirm={async () => {
            if (!inventoryDeleteTarget) return
            try {
              setInventoryDeleteLoading(true)
              const token = await getToken()
              if (!token) {
                setError('Not signed in')
                return
              }
              const client = createPharmacyApiClient(token)
              const result = await client.deleteStock({ stockId: inventoryDeleteTarget.id })
              if (!result.ok || !result.data.success) {
                throw new Error((result.data.error as string) || 'Failed to delete stock')
              }
              setSuccess('Medicine removed from this branch inventory.')
              fetchPharmacy()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to delete stock')
            } finally {
              setInventoryDeleteLoading(false)
              setInventoryDeleteTarget(null)
            }
          }}
        />
    </>
  )
}
