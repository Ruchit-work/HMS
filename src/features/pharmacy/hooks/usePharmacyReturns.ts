'use client'

import { useCallback, useState } from 'react'
import type { PharmacySale } from '@/types/pharmacy'
import { createPharmacyApiClient } from '@/features/pharmacy/pharmacyApiClient'

export type PendingReturnPayload = {
  saleId: string
  lines: { medicineId: string; quantity: number }[]
  lineSummaries: Array<{ medicineName: string; quantity: number; unitPrice: number; amount: number }>
  refundAmount: number
  note: string
}

export type ReturnReasonType =
  | ''
  | 'damaged'
  | 'wrong_medicine'
  | 'doctor_changed'
  | 'patient_request'
  | 'expired'
  | 'other'

export type UsePharmacyReturnsParams = {
  getToken: () => Promise<string | null>
  fetchPharmacy: (silent?: boolean) => Promise<void>
  setError: (message: string | null) => void
  setSuccess: (message: string | null) => void
}

export function usePharmacyReturns({
  getToken,
  fetchPharmacy,
  setError,
  setSuccess,
}: UsePharmacyReturnsParams) {
  const [selectedReturnSale, setSelectedReturnSale] = useState<PharmacySale | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [showRefundPaymentModal, setShowRefundPaymentModal] = useState(false)
  const [pendingReturnPayload, setPendingReturnPayload] = useState<PendingReturnPayload | null>(null)
  const [refundPaymentMode, setRefundPaymentMode] = useState<'cash' | 'upi' | 'card' | 'other'>('cash')
  const [returnReasonType, setReturnReasonType] = useState<ReturnReasonType>('')
  const [returnReasonDetails, setReturnReasonDetails] = useState('')
  const [returnSupervisorName, setReturnSupervisorName] = useState('')
  const [showRefundCashModal, setShowRefundCashModal] = useState(false)
  const [returnsSearch, setReturnsSearch] = useState('')
  const [returnsDate, setReturnsDate] = useState<string>('')
  const [returnsPaymentFilter, setReturnsPaymentFilter] = useState<string>('all')
  const [returnsMinAmount, setReturnsMinAmount] = useState<string>('')
  const [returnsMaxAmount, setReturnsMaxAmount] = useState<string>('')
  const [returnsInnerTab, setReturnsInnerTab] = useState<'by_sale' | 'by_return'>('by_sale')

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
    [pendingReturnPayload, getToken, fetchPharmacy, setError, setSuccess]
  )

  return {
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
  }
}
