'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/StatusComponents'
import { formatDate } from '@/utils/date'

interface UnifiedBillingRecord {
  id: string
  type: "admission" | "appointment"
  admissionId?: string
  appointmentId?: string
  patientId: string
  patientName?: string | null
  doctorId: string
  doctorName?: string | null
  roomCharges?: number
  doctorFee?: number
  consultationFee?: number
  otherServices?: Array<{ description: string; amount: number }>
  totalAmount: number
  generatedAt: string
  status: "pending" | "paid" | "void" | "cancelled"
  paymentMethod?: "card" | "upi" | "cash" | "demo"
  paidAt?: string | null
  paymentType?: "full" | "partial"
  remainingAmount?: number
}

interface Appointment {
  id: string
  paymentAmount: number
  paymentStatus: string
  paymentMethod?: string
  status: string
  appointmentDate: string
  doctorId: string
  doctorName: string
  doctorSpecialization: string
  patientId: string
  patientName?: string
  createdAt: string
  paidAt?: string
}

interface FinancialAnalytics {
  // Revenue Metrics
  totalRevenue: number
  paidRevenue: number
  pendingRevenue: number
  monthlyRevenue: number
  weeklyRevenue: number
  averageTransactionValue: number
  
  // Outstanding Payments
  totalOutstanding: number
  outstandingCount: number
  overdueCount: number
  overdueAmount: number
  
  // Payment Methods Distribution
  paymentMethodDistribution: Record<string, { count: number; amount: number }>
  
  // Revenue by Doctor
  revenueByDoctor: Array<{
    doctorId: string
    doctorName: string
    specialization: string
    totalRevenue: number
    transactionCount: number
    averageTransaction: number
  }>
  
  // Revenue by Specialty
  revenueBySpecialty: Record<string, {
    revenue: number
    count: number
  }>
  
  // Monthly Revenue Trends
  monthlyTrends: Array<{
    month: string
    revenue: number
    transactions: number
    paid: number
    pending: number
  }>
  
  // Recent High-Value Transactions
  topTransactions: Array<{
    id: string
    patientName: string
    doctorName: string
    amount: number
    date: string
    status: string
    type: string
  }>
  
  // Outstanding Payments List
  outstandingPayments: Array<{
    id: string
    patientName: string
    doctorName: string
    amount: number
    date: string
    daysOverdue: number
    type: string
  }>
}

export default function FinancialAnalytics() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<FinancialAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '3months' | '6months' | '1year' | 'all'>('1year')

  useEffect(() => {
    if (!user) return
    fetchFinancialAnalytics()
  }, [user, timeRange])

  const fetchFinancialAnalytics = async () => {
    try {
      setLoading(true)

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in")
      }

      const token = await currentUser.getIdToken()

      // Fetch billing records
      const billingRes = await fetch("/api/admin/billing-records", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      let billingRecords: UnifiedBillingRecord[] = []
      if (billingRes.ok) {
        const billingData = await billingRes.json().catch(() => ({}))
        billingRecords = Array.isArray(billingData?.records) ? billingData.records : []
      }

      // Fetch appointments (they also have payment data)
      const appointmentsSnapshot = await getDocs(collection(db, 'appointments'))
      const appointments: Appointment[] = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))

      // Calculate date ranges
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      // Filter data by time range
      let filteredBillingRecords = billingRecords
      let filteredAppointments = appointments
      
      if (timeRange === '7days') {
        filteredBillingRecords = billingRecords.filter(r => new Date(r.generatedAt) >= sevenDaysAgo)
        filteredAppointments = appointments.filter(a => new Date(a.createdAt) >= sevenDaysAgo)
      } else if (timeRange === '30days') {
        filteredBillingRecords = billingRecords.filter(r => new Date(r.generatedAt) >= thirtyDaysAgo)
        filteredAppointments = appointments.filter(a => new Date(a.createdAt) >= thirtyDaysAgo)
      } else if (timeRange === '3months') {
        filteredBillingRecords = billingRecords.filter(r => new Date(r.generatedAt) >= threeMonthsAgo)
        filteredAppointments = appointments.filter(a => new Date(a.createdAt) >= threeMonthsAgo)
      } else if (timeRange === '6months') {
        filteredBillingRecords = billingRecords.filter(r => new Date(r.generatedAt) >= sixMonthsAgo)
        filteredAppointments = appointments.filter(a => new Date(a.createdAt) >= sixMonthsAgo)
      } else if (timeRange === '1year') {
        filteredBillingRecords = billingRecords.filter(r => new Date(r.generatedAt) >= oneYearAgo)
        filteredAppointments = appointments.filter(a => new Date(a.createdAt) >= oneYearAgo)
      }

      // Combine all paid transactions
      const allPaidRecords: Array<{ amount: number; date: string; method?: string; type: string }> = []
      
      // From billing records
      filteredBillingRecords.forEach(record => {
        if (record.status === 'paid') {
          allPaidRecords.push({
            amount: record.totalAmount,
            date: record.paidAt || record.generatedAt,
            method: record.paymentMethod,
            type: record.type
          })
        }
      })

      // From appointments
      filteredAppointments.forEach(apt => {
        if (apt.paymentStatus === 'paid' && apt.paymentAmount > 0) {
          allPaidRecords.push({
            amount: apt.paymentAmount,
            date: apt.paidAt || apt.createdAt,
            method: apt.paymentMethod,
            type: 'appointment'
          })
        }
      })

      // Calculate revenue metrics
      const totalRevenue = allPaidRecords.reduce((sum, r) => sum + r.amount, 0)
      const paidRevenue = totalRevenue
      const averageTransactionValue = allPaidRecords.length > 0 
        ? totalRevenue / allPaidRecords.length 
        : 0

      // Calculate outstanding payments
      const allPendingRecords: Array<{ 
        id: string
        amount: number
        date: string
        patientName?: string
        doctorName?: string
        type: string
      }> = []

      filteredBillingRecords.forEach(record => {
        if (record.status === 'pending') {
          allPendingRecords.push({
            id: record.id,
            amount: record.totalAmount,
            date: record.generatedAt,
            patientName: record.patientName || undefined,
            doctorName: record.doctorName || undefined,
            type: record.type
          })
        }
      })

      filteredAppointments.forEach(apt => {
        if ((apt.paymentStatus === 'pending' || apt.paymentStatus === 'unpaid') && apt.paymentAmount > 0) {
          allPendingRecords.push({
            id: apt.id,
            amount: apt.paymentAmount,
            date: apt.createdAt,
            patientName: apt.patientName || undefined,
            doctorName: apt.doctorName || undefined,
            type: 'appointment'
          })
        }
      })

      const totalOutstanding = allPendingRecords.reduce((sum, r) => sum + r.amount, 0)
      const outstandingCount = allPendingRecords.length

      // Calculate overdue (older than 30 days)
      const overdueThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const overduePayments = allPendingRecords.filter(r => new Date(r.date) < overdueThreshold)
      const overdueAmount = overduePayments.reduce((sum, r) => sum + r.amount, 0)

      // Monthly revenue (last 30 days)
      const monthlyRevenue = allPaidRecords
        .filter(r => new Date(r.date) >= thirtyDaysAgo)
        .reduce((sum, r) => sum + r.amount, 0)

      // Weekly revenue (last 7 days)
      const weeklyRevenue = allPaidRecords
        .filter(r => new Date(r.date) >= sevenDaysAgo)
        .reduce((sum, r) => sum + r.amount, 0)

      const pendingRevenue = totalOutstanding

      // Payment method distribution
      const paymentMethodDistribution: Record<string, { count: number; amount: number }> = {}
      allPaidRecords.forEach(r => {
        const method = r.method || 'unknown'
        if (!paymentMethodDistribution[method]) {
          paymentMethodDistribution[method] = { count: 0, amount: 0 }
        }
        paymentMethodDistribution[method].count += 1
        paymentMethodDistribution[method].amount += r.amount
      })

      // Revenue by doctor
      const doctorRevenueMap: Record<string, {
        doctorId: string
        doctorName: string
        specialization: string
        revenue: number
        count: number
      }> = {}

      // From billing records
      filteredBillingRecords.forEach(record => {
        if (record.status === 'paid' && record.doctorId) {
          if (!doctorRevenueMap[record.doctorId]) {
            doctorRevenueMap[record.doctorId] = {
              doctorId: record.doctorId,
              doctorName: record.doctorName || 'Unknown',
              specialization: '',
              revenue: 0,
              count: 0
            }
          }
          doctorRevenueMap[record.doctorId].revenue += record.totalAmount
          doctorRevenueMap[record.doctorId].count += 1
        }
      })

      // From appointments
      filteredAppointments.forEach(apt => {
        if (apt.paymentStatus === 'paid' && apt.paymentAmount > 0 && apt.doctorId) {
          if (!doctorRevenueMap[apt.doctorId]) {
            doctorRevenueMap[apt.doctorId] = {
              doctorId: apt.doctorId,
              doctorName: apt.doctorName || 'Unknown',
              specialization: apt.doctorSpecialization || '',
              revenue: 0,
              count: 0
            }
          }
          doctorRevenueMap[apt.doctorId].revenue += apt.paymentAmount
          doctorRevenueMap[apt.doctorId].count += 1
          if (!doctorRevenueMap[apt.doctorId].specialization && apt.doctorSpecialization) {
            doctorRevenueMap[apt.doctorId].specialization = apt.doctorSpecialization
          }
        }
      })

      const revenueByDoctor = Object.values(doctorRevenueMap)
        .filter(doc => doc && doc.revenue !== undefined && doc.revenue !== null)
        .map(doc => ({
          doctorId: doc.doctorId || '',
          doctorName: doc.doctorName || 'Unknown',
          specialization: doc.specialization || 'Unknown',
          totalRevenue: Number(doc.revenue) || 0,
          transactionCount: Number(doc.count) || 0,
          averageTransaction: (doc.count && doc.count > 0) ? (Number(doc.revenue) || 0) / Number(doc.count) : 0
        }))
        .filter(doc => doc.totalRevenue > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10)

      // Revenue by specialty
      const revenueBySpecialty: Record<string, { revenue: number; count: number }> = {}
      revenueByDoctor.forEach(doc => {
        const specialty = doc.specialization || 'Unknown'
        if (!revenueBySpecialty[specialty]) {
          revenueBySpecialty[specialty] = { revenue: 0, count: 0 }
        }
        revenueBySpecialty[specialty].revenue += doc.totalRevenue
        revenueBySpecialty[specialty].count += doc.transactionCount
      })

      // Monthly trends (last 12 months)
      const monthlyTrends: Array<{
        month: string
        revenue: number
        transactions: number
        paid: number
        pending: number
      }> = []

      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

        const monthPaid = allPaidRecords.filter(r => {
          const rDate = new Date(r.date)
          return rDate >= monthStart && rDate <= monthEnd
        })

        const monthPending = allPendingRecords.filter(r => {
          const rDate = new Date(r.date)
          return rDate >= monthStart && rDate <= monthEnd
        })

        monthlyTrends.push({
          month: monthName,
          revenue: monthPaid.reduce((sum, r) => sum + r.amount, 0),
          transactions: monthPaid.length,
          paid: monthPaid.reduce((sum, r) => sum + r.amount, 0),
          pending: monthPending.reduce((sum, r) => sum + r.amount, 0)
        })
      }

      // Top transactions - avoid duplicates by excluding appointments that have billing records
      const appointmentIdsWithBilling = new Set(
        filteredBillingRecords
          .filter(r => r.appointmentId)
          .map(r => r.appointmentId!)
      )

      const allTransactions = [
        ...filteredBillingRecords.filter(r => r.status === 'paid').map(r => ({
          id: `${r.type}-${r.id}`, // Unique key combining type and id
          patientName: r.patientName || 'Unknown',
          doctorName: r.doctorName || 'Unknown',
          amount: r.totalAmount,
          date: r.paidAt || r.generatedAt,
          status: r.status,
          type: r.type
        })),
        ...filteredAppointments
          .filter(a => a.paymentStatus === 'paid' && a.paymentAmount > 0 && !appointmentIdsWithBilling.has(a.id))
          .map(a => ({
            id: `appointment-${a.id}`, // Unique key with prefix
            patientName: a.patientName || 'Unknown',
            doctorName: a.doctorName || 'Unknown',
            amount: a.paymentAmount,
            date: a.paidAt || a.createdAt,
            status: a.paymentStatus,
            type: 'appointment'
          }))
      ]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)

      // Outstanding payments with overdue calculation
      const outstandingPayments = allPendingRecords.map(r => {
        const generatedDate = new Date(r.date)
        const daysDiff = Math.floor((now.getTime() - generatedDate.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: r.id,
          patientName: r.patientName || 'Unknown',
          doctorName: r.doctorName || 'Unknown',
          amount: r.amount,
          date: r.date,
          daysOverdue: daysDiff > 30 ? daysDiff - 30 : 0,
          type: r.type
        }
      }).sort((a, b) => {
        // Sort by overdue first, then by amount
        if (a.daysOverdue > 0 && b.daysOverdue === 0) return -1
        if (a.daysOverdue === 0 && b.daysOverdue > 0) return 1
        return b.amount - a.amount
      }).slice(0, 20)

      setAnalytics({
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        monthlyRevenue,
        weeklyRevenue,
        averageTransactionValue: Math.round(averageTransactionValue),
        totalOutstanding,
        outstandingCount,
        overdueCount: overduePayments.length,
        overdueAmount,
        paymentMethodDistribution,
        revenueByDoctor,
        revenueBySpecialty,
        monthlyTrends,
        topTransactions: allTransactions,
        outstandingPayments
      })
    } catch (error) {
      console.error('Error fetching financial analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading financial analytics..." />
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No financial data available</p>
      </div>
    )
  }

  const maxMonthlyRevenue = Math.max(...analytics.monthlyTrends.map(m => m.revenue), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Analytics & Revenue Insights</h2>
          <p className="text-sm text-slate-600 mt-1">Comprehensive financial metrics and payment tracking</p>
        </div>
        
        {/* Time Range Selector */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="3months">Last 3 Months</option>
          <option value="6months">Last 6 Months</option>
          <option value="1year">Last Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">Total Revenue</span>
            <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-900">₹{analytics.totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-600 mt-1">Paid transactions</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">Monthly Revenue</span>
            <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-900">₹{analytics.monthlyRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-blue-600 mt-1">Last 30 days</p>
        </div>

        {/* Outstanding Payments */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-700">Outstanding</span>
            <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-red-900">₹{analytics.totalOutstanding.toLocaleString('en-IN')}</p>
          <p className="text-xs text-red-600 mt-1">{analytics.outstandingCount} pending payments</p>
        </div>

        {/* Average Transaction */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">Avg Transaction</span>
            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-900">₹{analytics.averageTransactionValue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-purple-600 mt-1">Per transaction</p>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Weekly Revenue */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-700">Weekly Revenue</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">₹{analytics.weeklyRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-2">Last 7 days</p>
        </div>

        {/* Overdue Payments */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-700">Overdue Payments</span>
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-3xl font-bold text-red-600">₹{analytics.overdueAmount.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-2">{analytics.overdueCount} payments (&gt;30 days)</p>
        </div>

        {/* Collection Rate */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-700">Collection Rate</span>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {analytics.totalRevenue + analytics.totalOutstanding > 0
              ? Math.round((analytics.totalRevenue / (analytics.totalRevenue + analytics.totalOutstanding)) * 100)
              : 0}%
          </p>
          <p className="text-xs text-slate-500 mt-2">Paid vs Total</p>
        </div>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Trend */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly Revenue Trend</h3>
          <div className="space-y-4">
            {analytics.monthlyTrends.map((month, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">{month.month}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    ₹{month.revenue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                    style={{ width: `${(month.revenue / maxMonthlyRevenue) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{month.transactions} transactions</span>
                  {month.pending > 0 && (
                    <span className="text-xs text-red-600">₹{month.pending.toLocaleString('en-IN')} pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Doctor */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Revenue by Doctor</h3>
          <div className="space-y-3">
            {(analytics.revenueByDoctor || []).slice(0, 5).map((doctor, idx) => (
              <div key={doctor.doctorId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doctor.doctorName}</p>
                    <p className="text-xs text-slate-500 truncate">{doctor.specialization || 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-lg font-bold text-slate-800">₹{(doctor.totalRevenue || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-500">{doctor.transactionCount || 0} transactions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {Object.entries(analytics.paymentMethodDistribution)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([method, data]) => {
                const percentage = analytics.totalRevenue > 0 
                  ? (data.amount / analytics.totalRevenue) * 100 
                  : 0
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 capitalize">{method}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        ₹{data.amount.toLocaleString('en-IN')} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{data.count} transactions</p>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Revenue by Specialty */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Revenue by Specialty</h3>
          <div className="space-y-3">
            {Object.entries(analytics.revenueBySpecialty)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .slice(0, 5)
              .map(([specialty, data]) => {
                const percentage = analytics.totalRevenue > 0
                  ? (data.revenue / analytics.totalRevenue) * 100
                  : 0
                return (
                  <div key={specialty}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{specialty || 'Unknown'}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        ₹{data.revenue.toLocaleString('en-IN')} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{data.count} transactions</p>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Outstanding Payments Table */}
      {analytics.outstandingPayments.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Outstanding Payments ({analytics.outstandingCount})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Patient</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Doctor</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Due Date</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Days Overdue</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                </tr>
              </thead>
              <tbody>
                {analytics.outstandingPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-900">{payment.patientName || 'Unknown'}</td>
                    <td className="py-3 px-4 text-slate-700">{payment.doctorName || 'Unknown'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatDate(payment.date)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {payment.daysOverdue > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          {payment.daysOverdue} days
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                        {payment.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Transactions */}
      {analytics.topTransactions.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Patient</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Doctor</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-900">{transaction.patientName}</td>
                    <td className="py-3 px-4 text-slate-700">{transaction.doctorName}</td>
                    <td className="py-3 px-4 text-right font-semibold text-green-600">
                      ₹{transaction.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                        {transaction.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

