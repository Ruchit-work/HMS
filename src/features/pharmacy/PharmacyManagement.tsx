'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/shared/hooks/useAuth'
import { useMultiHospital } from '@/providers/MultiHospitalProvider'
import { usePharmacyPortal } from '@/providers/PharmacyPortalProvider'
import type { PharmacyPortalTabId } from '@/providers/PharmacyPortalProvider'
import { GroupedNav } from '@/shared/components'
import { Button } from '@/shared/components'
import { buildPharmacyAdminNavSections } from '@/features/pharmacy/pharmacyNavConfig'
import { Notification } from '@/shared/components'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import { RevealModal } from '@/shared/components'
import { ConfirmDialog } from '@/shared/components'
import type {
  PharmacyMedicine,
  BranchMedicineStock,
  PharmacySupplier,
  PharmacySale,
  PharmacyPurchaseOrder,
  PharmacyCashSession,
  PharmacyCashierProfile,
  PharmacyCounter,
} from '@/types/pharmacy'
import { PharmacyQueueSection } from '@/features/pharmacy/components/PharmacyQueueSection'
import { createPharmacyApiClient } from '@/features/pharmacy/pharmacyApiClient'
import { usePharmacyToken } from '@/features/pharmacy/hooks/usePharmacyToken'
import { usePharmacyCatalog } from '@/features/pharmacy/hooks/usePharmacyCatalog'
import { usePharmacyCash } from '@/features/pharmacy/hooks/usePharmacyCash'
import { usePharmacyReturns } from '@/features/pharmacy/hooks/usePharmacyReturns'
import {
  ShiftCloseChecklist,
} from '@/features/pharmacy/components/RealWorldUiBlocks'
import { DispenseModal } from '@/features/pharmacy/components/DispenseModal'
import { InventoryTabContent } from '@/features/pharmacy/components/InventoryTabContent'
import { AddMedicineForm, EditMinLevelModal } from '@/features/pharmacy/components/InventoryModals'
import { OrdersTabContent } from '@/features/pharmacy/components/OrdersTabContent'
import { OverviewTabContent } from '@/features/pharmacy/components/OverviewTabContent'
import { PharmacyBillingPanel } from '@/features/pharmacy/components/PharmacyBillingPanel'
import { PhOpsSkeleton } from '@/features/pharmacy/ui/PhOps'
import { ReportsTabContent } from '@/features/pharmacy/components/ReportsTabContent'
import { SalesTabContent } from '@/features/pharmacy/components/SalesTabContent'
import { ReturnsTabContent } from '@/features/pharmacy/components/ReturnsTabContent'
import { CashExpensesDailyContent } from '@/features/pharmacy/components/CashExpensesDailyContent'
import { CashExpensesShiftContent } from '@/features/pharmacy/components/CashExpensesShiftContent'
import { SettingsTabContent } from '@/features/pharmacy/components/SettingsTabContent'
import { SuppliersTabContent } from '@/features/pharmacy/components/SuppliersTabContent'
import { AddSupplierForm, EditSupplierForm } from '@/features/pharmacy/components/SupplierForms'
import { TransfersTabContent } from '@/features/pharmacy/components/TransfersTabContent'
import { AddPharmacistModalContent } from '@/features/pharmacy/components/UserManagementForms'
import { UsersTabContent } from '@/features/pharmacy/components/UsersTabContent'
import { CASH_DENOMS, REQUIRE_SHIFT_HANDOVER_NOTE, createEmptyCashNotes } from '@/features/pharmacy/constants'
import {
  computeCloseShiftPreview,
  computeDailySummaryDayRows,
  computeDailySummaryRows,
  computePeriodSummaries,
  computeRecentSalesToday,
  computeSessionSales,
  filterDailySummaryDayRows,
  filterShiftReports,
  type DailySummarySalesSort,
} from '@/features/pharmacy/utils/cashExpenseSummaries'
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
} from '@/features/pharmacy/utils/inventoryReports'
import {
  buildInventoryFilterRows,
  getNearestExpiry,
  type InventoryExpiryFilter,
  type InventoryStatusFilter,
} from '@/features/pharmacy/utils/inventoryFilters'
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
} from '@/features/pharmacy/utils/commerceDerived'
import {
  computeCategoryDistribution,
  computeCategoryDonutData,
  computeInventoryHealthCounts,
  computeInventoryHealthItems,
  computePeriodRefundTotal,
  computePeriodSalesCount,
  computePeriodSalesTotal,
  computeSalesTrendData,
  type OverviewDateRange,
} from '@/features/pharmacy/utils/overviewDerived'
import type { QueueItem } from '@/features/pharmacy/queueTypes'

type PharmacySubTab = 'overview' | 'inventory' | 'queue' | 'sales' | 'returns' | 'suppliers' | 'orders' | 'transfers' | 'reports' | 'users' | 'cash_and_expenses' | 'settings'

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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Declared early for usePharmacyCash
  const [expenseFilters, setExpenseFilters] = useState<{ dateFrom: string; dateTo: string; categoryId: string; paymentMethod: string }>({
    dateFrom: '',
    dateTo: '',
    categoryId: 'all',
    paymentMethod: 'all',
  })
  const [viewShiftReportSession, setViewShiftReportSession] = useState<PharmacyCashSession | null>(null)

  const { getToken } = usePharmacyToken()

  const {
    loading,
    branches,
    medicines,
    stock,
    suppliers,
    lowStock,
    expiring,
    queue,
    sales,
    transfers,
    pharmacists,
    purchaseOrders,
    analytics,
    fetchPharmacy,
  } = usePharmacyCatalog({
    activeHospitalId,
    isSuperAdmin,
    isAdmin,
    isPharmacyPortal,
    branchFilter,
    branchFilterRef,
    portalRef,
    getToken,
    setError,
  })

  const {
    activeCashSession,
    setActiveCashSession,
    recentCashSessions,
    cashSessionsLoading,
    expenseCategories,
    expenses,
    cashiers,
    setCashiers,
    counters,
    setCounters,
    shiftReportExpenses,
    fetchCashSessions,
    fetchExpensesAndCategories,
    handleDeleteCashier,
    handleDeleteCounter,
  } = usePharmacyCash({
    activeHospitalId,
    branchFilter,
    subTab,
    getToken,
    setError,
    setSuccess,
    expenseFilters,
    viewShiftReportSession,
  })

  const {
    selectedReturnSale,
    setSelectedReturnSale,
    returnQuantities,
    setReturnQuantities,
    returnSubmitting,
    showRefundPaymentModal,
    setShowRefundPaymentModal,
    pendingReturnPayload,
    setPendingReturnPayload,
    refundPaymentMode,
    setRefundPaymentMode,
    returnReasonType,
    setReturnReasonType,
    returnReasonDetails,
    setReturnReasonDetails,
    returnSupervisorName,
    setReturnSupervisorName,
    showRefundCashModal,
    setShowRefundCashModal,
    returnsSearch,
    setReturnsSearch,
    returnsDate,
    setReturnsDate,
    returnsPaymentFilter,
    setReturnsPaymentFilter,
    returnsMinAmount,
    setReturnsMinAmount,
    returnsMaxAmount,
    setReturnsMaxAmount,
    returnsInnerTab,
    setReturnsInnerTab,
    getSaleReturnedMap,
    submitReturn,
  } = usePharmacyReturns({
    getToken,
    fetchPharmacy,
    setError,
    setSuccess,
  })

  const [inventoryHealthFilter, setInventoryHealthFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock'>('all')
  const [dispenseQueueItem, setDispenseQueueItem] = useState<QueueItem | null>(null)
  const queuePosSearchRef = useRef<HTMLInputElement>(null)
  const [editMinLevelMedicine, setEditMinLevelMedicine] = useState<PharmacyMedicine | null>(null)
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
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<PharmacySale | null>(null)
  const [salesSearch, setSalesSearch] = useState('')
  const saleDetailRef = useRef<HTMLDivElement | null>(null)
  const [salesDate, setSalesDate] = useState<string>('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('all')
  const [salesMinAmount, setSalesMinAmount] = useState<string>('')
  const [salesMaxAmount, setSalesMaxAmount] = useState<string>('')
  const [openCounterLoading, setOpenCounterLoading] = useState(false)
  const [closeShiftLoading, setCloseShiftLoading] = useState(false)
  const [saveExpenseLoading, setSaveExpenseLoading] = useState(false)
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

  const [expenseForm, setExpenseForm] = useState<{ date: string; amount: string; paymentMethod: string; note: string }>({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    paymentMethod: 'cash',
    note: '',
  })
  const [defaultPrinterId, setDefaultPrinterId] = useState('')
  const [printBridgeUrl, setPrintBridgeUrl] = useState('')
  type CashExpensePeriod = 'today' | 'week' | 'month' | 'year'
  const [cashExpensePeriod, _setCashExpensePeriod] = useState<CashExpensePeriod>('today')
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
  const [openedByName, _setOpenedByName] = useState<string>('')
  const [selectedCashierId, setSelectedCashierId] = useState<string>('')
  const [selectedCounterId, setSelectedCounterId] = useState<string>('')
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

  const paymentModeSummary = useMemo(
    () => computePaymentModeSummary({ sales, branchFilter }),
    [sales, branchFilter]
  )

  /** Top selling medicines (top 8) for bar chart */
  const topSellingMedicines = useMemo(
    () => computeTopSellingMedicines(analytics?.mostPrescribed),
    [analytics?.mostPrescribed]
  )

  const [overviewRecentSalesSearch, _setOverviewRecentSalesSearch] = useState('')
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-800 shadow-sm hover:bg-cyan-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Pharmacist
                </button>
              )}
            </div>
          </div>
        )}
        {!isPharmacyPortal && (
          <div className="border-b border-slate-200 px-6 py-4">
            <GroupedNav
              variant="pills"
              sections={buildPharmacyAdminNavSections({ isSuperAdmin, isAdmin })}
              activeId={subTab}
              onSelect={(id) => setSubTab(id as PharmacySubTab)}
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
            <div className="py-2"><PhOpsSkeleton cards={6} /></div>
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
              onGoToQueue={() => setSubTab('queue')}
              onGoToOrders={() => setSubTab('orders')}
              onGoToBilling={() => setSubTab('queue')}
              onGoToCash={() => setSubTab('cash_and_expenses')}
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
                hasActiveSession={!!activeCashSession}
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
                      className="rounded-lg bg-[#0891b2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0e7490] transition"
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
                openCounterLoading={openCounterLoading}
                saveExpenseLoading={saveExpenseLoading}
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
                  if (openCounterLoading) return
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
                  setOpenCounterLoading(true)
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
                  } finally {
                    setOpenCounterLoading(false)
                  }
                }}
                onSaveExpense={async () => {
                  if (saveExpenseLoading) return
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
                  setSaveExpenseLoading(true)
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
                  } finally {
                    setSaveExpenseLoading(false)
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
          <ReturnsTabContent
            cashSessionsLoading={cashSessionsLoading}
            activeCashSession={activeCashSession}
            onGoToCashExpenses={() => setSubTab('cash_and_expenses')}
            overviewDateRange={overviewDateRange}
            setOverviewDateRange={setOverviewDateRange}
            periodSalesTotal={periodSalesTotal}
            periodRefundTotal={periodRefundTotal}
            periodSalesCount={periodSalesCount}
            paymentModeSummary={paymentModeSummary}
            salesTrendData={salesTrendData}
            topSellingMedicines={topSellingMedicines}
            returnsInnerTab={returnsInnerTab}
            setReturnsInnerTab={setReturnsInnerTab}
            totalRefundForFilteredSales={totalRefundForFilteredSales}
            filteredReturnSales={filteredReturnSales}
            returnsDate={returnsDate}
            setReturnsDate={setReturnsDate}
            returnsPaymentFilter={returnsPaymentFilter}
            setReturnsPaymentFilter={setReturnsPaymentFilter}
            returnsMinAmount={returnsMinAmount}
            setReturnsMinAmount={setReturnsMinAmount}
            returnsMaxAmount={returnsMaxAmount}
            setReturnsMaxAmount={setReturnsMaxAmount}
            returnsSearch={returnsSearch}
            setReturnsSearch={setReturnsSearch}
            loading={loading}
            paginatedReturnSales={paginatedReturnSales}
            selectedReturnSale={selectedReturnSale}
            setSelectedReturnSale={setSelectedReturnSale}
            returnQuantities={returnQuantities}
            setReturnQuantities={setReturnQuantities}
            returnReasonType={returnReasonType}
            setReturnReasonType={setReturnReasonType}
            returnReasonDetails={returnReasonDetails}
            setReturnReasonDetails={setReturnReasonDetails}
            returnSupervisorName={returnSupervisorName}
            setReturnSupervisorName={setReturnSupervisorName}
            returnSubmitting={returnSubmitting}
            getSaleReturnedMap={getSaleReturnedMap}
            setError={setError}
            setPendingReturnPayload={setPendingReturnPayload}
            setRefundPaymentMode={setRefundPaymentMode}
            setShowRefundPaymentModal={setShowRefundPaymentModal}
            returnsPage={returnsPage}
            returnsTotalPages={returnsTotalPages}
            returnsPageSize={returnsPageSize}
            goToReturnsPage={goToReturnsPage}
            setReturnsPageSize={setReturnsPageSize}
            showRefundPaymentModal={showRefundPaymentModal}
            pendingReturnPayload={pendingReturnPayload}
            refundPaymentMode={refundPaymentMode}
            showRefundCashModal={showRefundCashModal}
            setShowRefundCashModal={setShowRefundCashModal}
            submitReturn={submitReturn}
            returnEvents={returnEvents}
          />
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
              <button type="button" onClick={() => setViewSupplier(null)} className="mt-4 rounded-lg bg-[#0891b2] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e7490]">Close</button>
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
                <button type="button" onClick={() => setAddMedicineModalBarcode(null)} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
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
                      {(s.handoverNote || s.varianceReason) && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                          <h3 className="font-semibold text-slate-800">Handover</h3>
                          {s.handoverNote && (
                            <p className="text-slate-700 whitespace-pre-wrap">{s.handoverNote}</p>
                          )}
                          {s.varianceReason && (
                            <p className="text-xs text-slate-500">
                              Variance reason:{' '}
                              <span className="font-medium text-slate-700">{s.varianceReason.replace(/_/g, ' ')}</span>
                            </p>
                          )}
                        </div>
                      )}
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
            contentClassName="!max-w-md max-h-[min(90dvh,720px)]"
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto max-h-[min(90dvh,720px)] flex flex-col overflow-hidden border border-slate-200/80">
              <div className="shrink-0 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Close shift</h2>
                <p className="text-sm text-slate-500 mt-1">Confirm closing this shift. Start and close times are recorded.</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-5">
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
              </div>
              <div className="shrink-0 border-t border-slate-200 bg-white px-6 sm:px-8 py-4 flex justify-end gap-3 rounded-b-2xl">
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
                  <Button
                    type="button"
                    variant="danger"
                    loading={closeShiftLoading}
                    loadingText="Closing shift…"
                    onClick={async () => {
                      if (closeShiftLoading) return
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
                      if (REQUIRE_SHIFT_HANDOVER_NOTE && closeHandoverNote.trim().length < 5) {
                        setError('Please add a handover note before closing the shift.')
                        return
                      }
                      setCloseShiftLoading(true)
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
                        handoverNote: closeHandoverNote.trim() || undefined,
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
                      } finally {
                        setCloseShiftLoading(false)
                      }
                    }}
                  >
                    Yes, close shift
                  </Button>
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
