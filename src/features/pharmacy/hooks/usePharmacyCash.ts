'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  PharmacyCashSession,
  PharmacyCashierProfile,
  PharmacyCounter,
  PharmacyExpense,
  PharmacyExpenseCategory,
} from '@/types/pharmacy'
import { createPharmacyApiClient } from '@/features/pharmacy/pharmacyApiClient'

export type ExpenseFilters = {
  dateFrom: string
  dateTo: string
  categoryId: string
  paymentMethod: string
}

export type UsePharmacyCashParams = {
  activeHospitalId: string | null | undefined
  branchFilter: string
  subTab: string
  getToken: () => Promise<string | null>
  setError: (message: string | null) => void
  setSuccess: (message: string | null) => void
  expenseFilters: ExpenseFilters
  viewShiftReportSession: PharmacyCashSession | null
}

export function usePharmacyCash({
  activeHospitalId,
  branchFilter,
  subTab,
  getToken,
  setError,
  setSuccess,
  expenseFilters,
  viewShiftReportSession,
}: UsePharmacyCashParams) {
  const [activeCashSession, setActiveCashSession] = useState<PharmacyCashSession | null>(null)
  const [recentCashSessions, setRecentCashSessions] = useState<PharmacyCashSession[]>([])
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false)
  const [expenseCategories, setExpenseCategories] = useState<PharmacyExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<PharmacyExpense[]>([])
  const [cashiers, setCashiers] = useState<PharmacyCashierProfile[]>([])
  const [counters, setCounters] = useState<PharmacyCounter[]>([])
  const [shiftReportExpenses, setShiftReportExpenses] = useState<PharmacyExpense[]>([])
  const [pendingCashDelete, setPendingCashDelete] = useState<
    | { kind: 'cashier'; cashier: PharmacyCashierProfile }
    | { kind: 'counter'; counter: PharmacyCounter }
    | null
  >(null)
  const [cashDeleteLoading, setCashDeleteLoading] = useState(false)

  useEffect(() => {
    const s = viewShiftReportSession
    if (!s?.branchId || !activeHospitalId) {
      setShiftReportExpenses([])
      return
    }
    let dateFrom = ''
    let dateTo = ''
    const opened =
      typeof s.openedAt === 'string'
        ? s.openedAt
        : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
    const closed =
      s.closedAt &&
      (typeof s.closedAt === 'string'
        ? s.closedAt
        : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
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
      client
        .getExpenses({
          hospitalId: activeHospitalId,
          branchId: s.branchId,
          dateFrom,
          dateTo,
        })
        .then((result) => {
          if (result.ok && result.data.success && Array.isArray(result.data.expenses)) {
            setShiftReportExpenses(result.data.expenses as PharmacyExpense[])
          } else setShiftReportExpenses([])
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
    } catch {
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

  useEffect(() => {
    fetchCashSessions()
  }, [fetchCashSessions, branchFilter])

  useEffect(() => {
    if (subTab === 'cash_and_expenses') {
      fetchExpensesAndCategories()
    }
  }, [subTab, fetchExpensesAndCategories, branchFilter])

  const handleDeleteCashier = useCallback(
    (cashier: PharmacyCashierProfile) => {
      const hasOpenSession = recentCashSessions.some(
        (s) => s.status === 'open' && s.cashierProfileId === cashier.id
      )
      if (hasOpenSession) {
        setError(`Cannot delete cashier "${cashier.name}" while an active shift is open.`)
        return
      }
      setPendingCashDelete({ kind: 'cashier', cashier })
    },
    [recentCashSessions, setError]
  )

  const handleDeleteCounter = useCallback(
    (counter: PharmacyCounter) => {
      const hasOpenSession = recentCashSessions.some(
        (s) => s.status === 'open' && s.counterId === counter.id
      )
      if (hasOpenSession) {
        setError(`Cannot delete counter "${counter.name}" while an active shift is open.`)
        return
      }
      setPendingCashDelete({ kind: 'counter', counter })
    },
    [recentCashSessions, setError]
  )

  const cancelPendingCashDelete = useCallback(() => {
    if (cashDeleteLoading) return
    setPendingCashDelete(null)
  }, [cashDeleteLoading])

  const confirmPendingCashDelete = useCallback(async () => {
    if (!pendingCashDelete) return
    const token = await getToken()
    if (!token) return
    setCashDeleteLoading(true)
    try {
      const client = createPharmacyApiClient(token)
      if (pendingCashDelete.kind === 'cashier') {
        const result = await client.deleteCashier(pendingCashDelete.cashier.id)
        if (!result.ok || !result.data.success) {
          setError((result.data.error as string) || 'Failed to delete cashier')
          return
        }
        setCashiers((prev) => prev.filter((x) => x.id !== pendingCashDelete.cashier.id))
        setSuccess('Cashier removed.')
      } else {
        const result = await client.deleteCounter(pendingCashDelete.counter.id)
        if (!result.ok || !result.data.success) {
          setError((result.data.error as string) || 'Failed to delete counter')
          return
        }
        setCounters((prev) => prev.filter((x) => x.id !== pendingCashDelete.counter.id))
        setSuccess('Counter removed.')
      }
      setPendingCashDelete(null)
    } catch (e: any) {
      setError(
        e?.message ||
          (pendingCashDelete.kind === 'cashier'
            ? 'Failed to delete cashier'
            : 'Failed to delete counter')
      )
    } finally {
      setCashDeleteLoading(false)
    }
  }, [pendingCashDelete, getToken, setError, setSuccess])

  return {
    activeCashSession,
    setActiveCashSession,
    recentCashSessions,
    setRecentCashSessions,
    cashSessionsLoading,
    expenseCategories,
    setExpenseCategories,
    expenses,
    setExpenses,
    cashiers,
    setCashiers,
    counters,
    setCounters,
    shiftReportExpenses,
    setShiftReportExpenses,
    fetchCashSessions,
    fetchExpensesAndCategories,
    fetchCashiersAndCounters,
    handleDeleteCashier,
    handleDeleteCounter,
    pendingCashDelete,
    cashDeleteLoading,
    cancelPendingCashDelete,
    confirmPendingCashDelete,
  }
}
