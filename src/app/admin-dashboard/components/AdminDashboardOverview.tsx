"use client"

import { useMemo } from "react"
import type { Appointment } from "@/types/patient"
import StatCard from "./StatCard"
import ConditionsBarChart, { HEALTHCARE_COLORS } from "./ConditionsBarChart"
import PieChart from "./PieChart"
import type { TrendPoint } from "@/utils/analytics/dashboardCalculations"
import type { RevenueTrendPoint } from "@/utils/analytics/dashboardCalculations"
import NotificationBadge from "@/components/ui/feedback/NotificationBadge"

export interface DashboardStatsForOverview {
  totalPatients: number
  totalDoctors: number
  totalAppointments: number
  todayAppointments: number
  todayRevenue: number
  completedAppointments: number
  pendingAppointments: number
  totalRevenue: number
  monthlyRevenue: number
  weeklyRevenue: number
  activeDoctorsToday: number
  appointmentTrends: { weekly: TrendPoint[]; monthly: TrendPoint[]; yearly: TrendPoint[] }
  appointmentTotals: { weekly: number; monthly: number; yearly: number }
  commonConditions: { condition: string; count: number }[]
  mostPrescribedMedicines: Array<{ medicineName: string; prescriptionCount: number; percentage: number }>
  revenueTrend: { weekly: RevenueTrendPoint[]; monthly: RevenueTrendPoint[]; yearly: RevenueTrendPoint[] }
  topDepartments: Array<{ department: string; count: number }>
}

type AdminTabId = "overview" | "patients" | "doctors" | "campaigns" | "appointments" | "billing" | "analytics" | "hospitals" | "admins" | "branches" | "staff"

interface AdminDashboardOverviewProps {
  displayStats: DashboardStatsForOverview
  trendView: "weekly" | "monthly" | "yearly"
  setTrendView: (v: "weekly" | "monthly" | "yearly") => void
  filteredAppointments: Appointment[]
  branches: Array<{ id: string; name: string }>
  selectedBranchId: string
  filteredRecentAppointments: Appointment[]
  showRecentAppointments: boolean
  setShowRecentAppointments: (v: boolean) => void
  pendingRefunds: any[]
  onApproveRefund: (r: any) => void
  processingRefundId: string | null
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTabId>>
  setSidebarOpen: (open: boolean) => void
  overviewBadge?: { displayCount: number }
  systemAlerts?: { lowStockCount?: number; doctorUnavailableCount?: number }
}

const chartPadding = { left: 70, right: 50, top: 40, bottom: 50 }
const chartSize = { width: 600, height: 280 }

export default function AdminDashboardOverview({
  displayStats,
  trendView,
  setTrendView,
  filteredAppointments,
  branches,
  selectedBranchId,
  filteredRecentAppointments,
  showRecentAppointments,
  setShowRecentAppointments,
  pendingRefunds,
  onApproveRefund,
  processingRefundId,
  setActiveTab,
  setSidebarOpen,
  overviewBadge = { displayCount: 0 },
  systemAlerts = {}
}: AdminDashboardOverviewProps) {
  const trendData = displayStats.appointmentTrends[trendView] || []
  const trendTotal = displayStats.appointmentTotals[trendView] || 0
  const maxTrendCount = trendData.reduce((max, p) => Math.max(max, p.count), 0)
  const safeTrendCount = Math.max(maxTrendCount, 1)
  const innerWidth = chartSize.width - chartPadding.left - chartPadding.right
  const innerHeight = chartSize.height - chartPadding.top - chartPadding.bottom
  const xStep = trendData.length > 1 ? innerWidth / (trendData.length - 1) : 0

  const appointmentStatusCounts = useMemo(() => {
    const scheduled = filteredAppointments.filter((a) => a.status === "confirmed").length
    const waiting = filteredAppointments.filter((a) => a.status === "pending" || (a as any).whatsappPending).length
    const inConsultation = 0
    const completed = filteredAppointments.filter((a) => a.status === "completed").length
    const cancelled = filteredAppointments.filter((a) => a.status === "cancelled").length
    return { scheduled, waiting, inConsultation, completed, cancelled }
  }, [filteredAppointments])

  const branchPerformance = useMemo(() => {
    if (branches.length === 0) return []
    return branches.map((branch) => {
      const apts = filteredAppointments.filter((a) => (a as any).branchId === branch.id)
      const revenue = apts
        .filter((a) => a.status === "completed")
        .reduce((s, a) => s + (a.paymentAmount || 0), 0)
      return { branchId: branch.id, branchName: branch.name, visits: apts.length, revenue }
    })
  }, [branches, filteredAppointments])

  const revenueTrendData = displayStats.revenueTrend[trendView] || []
  const maxRevenue = revenueTrendData.reduce((m, p) => Math.max(m, p.revenue), 0)
  const safeRevenue = Math.max(maxRevenue, 1)
  const revenueXStep = revenueTrendData.length > 1 ? innerWidth / (revenueTrendData.length - 1) : 0

  const doctorSummary = useMemo(() => {
    const byDoctor: Record<
      string,
      { doctorId: string; doctorName: string; patients: Set<string>; revenue: number; total: number; cancelled: number }
    > = {}
    filteredAppointments.forEach((apt) => {
      if (!apt.doctorId || !apt.doctorName) return
      if (!byDoctor[apt.doctorId]) {
        byDoctor[apt.doctorId] = {
          doctorId: apt.doctorId,
          doctorName: apt.doctorName,
          patients: new Set(),
          revenue: 0,
          total: 0,
          cancelled: 0
        }
      }
      const d = byDoctor[apt.doctorId]
      d.total++
      if (apt.patientId) d.patients.add(apt.patientId)
      if (apt.status === "cancelled") d.cancelled++
      if (apt.status === "completed" && (apt.paymentAmount || 0) > 0) d.revenue += apt.paymentAmount || 0
    })
    return Object.values(byDoctor).map((d) => ({
      doctorName: d.doctorName,
      totalPatients: d.patients.size,
      revenue: d.revenue,
      totalAppointments: d.total,
      cancellationRate: d.total > 0 ? (d.cancelled / d.total) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [filteredAppointments])

  const getVisitType = (apt: Appointment) => ((apt as any).createdBy === "receptionist" ? "Walk-in" : "Appointment")
  const getPaymentStatus = (apt: Appointment) => (apt.paymentStatus === "paid" ? "Paid" : apt.paymentStatus === "refunded" ? "Refunded" : "Pending")

  return (
    <div className="space-y-6">
      {/* System Alerts */}
      {(pendingRefunds.length > 0 || (systemAlerts.lowStockCount ?? 0) > 0 || (systemAlerts.doctorUnavailableCount ?? 0) > 0) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-semibold text-amber-900 mb-2">System Alerts</h4>
          <ul className="text-sm text-amber-800 space-y-1">
            {pendingRefunds.length > 0 && (
              <li>• <span className="font-medium">{pendingRefunds.length}</span> pending refund request{pendingRefunds.length !== 1 ? "s" : ""}</li>
            )}
            {(systemAlerts.lowStockCount ?? 0) > 0 && (
              <li>• Low medicine stock: <span className="font-medium">{systemAlerts.lowStockCount}</span> item(s)</li>
            )}
            {(systemAlerts.doctorUnavailableCount ?? 0) > 0 && (
              <li>• <span className="font-medium">{systemAlerts.doctorUnavailableCount}</span> doctor(s) unavailable</li>
            )}
          </ul>
        </div>
      )}

      {/* Pending Refund Requests Banner */}
      {pendingRefunds.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-orange-900 mb-1">Pending Refund Requests</h4>
              <p className="text-sm text-orange-800">{pendingRefunds.length} request{pendingRefunds.length !== 1 ? "s" : ""} awaiting approval.</p>
            </div>
            <NotificationBadge count={overviewBadge.displayCount} size="md" position="top-right" className="relative" />
          </div>
        </div>
      )}

      {/* 1. Top Summary Cards — 6 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Patients</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{displayStats.totalPatients}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Doctors</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{displayStats.totalDoctors}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Today&apos;s Appointments</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{displayStats.todayAppointments}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Today&apos;s Revenue</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">₹{displayStats.todayRevenue.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly Revenue</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">₹{displayStats.monthlyRevenue.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Doctors Today</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{displayStats.activeDoctorsToday}</p>
            </div>
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Appointment Trends + 3. Appointment Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Appointment Trends</h3>
            <select
              value={trendView}
              onChange={(e) => setTrendView(e.target.value as "weekly" | "monthly" | "yearly")}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
            </select>
          </div>
          <div className="h-56 sm:h-64 relative">
            {trendData.length > 0 ? (
              <svg className="w-full h-full" viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}>
                <defs>
                  <pattern id="gridOverview" width="50" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="#fafafa" />
                <rect width="100%" height="100%" fill="url(#gridOverview)" />
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = chartSize.height - chartPadding.bottom - (innerHeight * i) / 4
                  return (
                    <text key={i} x={chartPadding.left - 10} y={y + 4} className="text-xs font-medium fill-slate-600" textAnchor="end">
                      {Math.round((safeTrendCount * i) / 4)}
                    </text>
                  )
                })}
                <polyline
                  points={trendData.map((p, i) => {
                    const x = chartPadding.left + i * xStep
                    const y = chartSize.height - chartPadding.bottom - (p.count / safeTrendCount) * innerHeight
                    return `${x},${y}`
                  }).join(" ")}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {trendData.map((p, i) => {
                  const x = chartPadding.left + i * xStep
                  const y = chartSize.height - chartPadding.bottom - (p.count / safeTrendCount) * innerHeight
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="4" fill="#3b82f6" />
                      <text x={x} y={y - 10} className="text-xs font-semibold fill-slate-700" textAnchor="middle">{p.count}</text>
                      <text x={x} y={chartSize.height - 12} className="text-xs font-medium fill-slate-600" textAnchor="middle">{p.label}</text>
                    </g>
                  )
                })}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No appointment data</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Appointment Status</h3>
          <div className="space-y-3">
            <StatCard label="Scheduled" value={appointmentStatusCounts.scheduled} icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} bgColor="bg-blue-50" borderColor="border-blue-100" iconBgColor="bg-blue-500" />
            <StatCard label="Waiting" value={appointmentStatusCounts.waiting} icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} bgColor="bg-amber-50" borderColor="border-amber-100" iconBgColor="bg-amber-500" />
            <StatCard label="In Consultation" value={appointmentStatusCounts.inConsultation} icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} bgColor="bg-violet-50" borderColor="border-violet-100" iconBgColor="bg-violet-500" />
            <StatCard label="Completed" value={appointmentStatusCounts.completed} icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} bgColor="bg-green-50" borderColor="border-green-100" iconBgColor="bg-green-500" />
            <StatCard label="Cancelled" value={appointmentStatusCounts.cancelled} icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>} bgColor="bg-red-50" borderColor="border-red-100" iconBgColor="bg-red-500" />
          </div>
        </div>
      </div>

      {/* 4. Medical Analytics — Conditions (bar) & Prescribed Medicines (donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 shadow-sm p-5 sm:p-6 flex flex-col min-h-[20rem]">
          <h3 className="text-lg font-semibold text-slate-800 mb-5">Common Patient Conditions</h3>
          <div className="flex-1 min-h-[16rem] flex items-center pr-2">
            <ConditionsBarChart
              data={displayStats.commonConditions.map((c) => ({ name: c.condition, value: c.count }))}
              emptyMessage="No condition data"
              maxBars={8}
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 shadow-sm p-5 sm:p-6 flex flex-col min-h-[20rem]">
          <h3 className="text-lg font-semibold text-slate-800 mb-5">Most Prescribed Medicines</h3>
          <div className="flex-1 min-h-[16rem] flex items-center">
            <PieChart
              data={displayStats.mostPrescribedMedicines.map((m) => ({ name: m.medicineName, value: m.prescriptionCount }))}
              colors={HEALTHCARE_COLORS}
              maxSlices={8}
              emptyMessage="No medicine data"
              getLabel={(item) => item.name}
              getCountLabel={(_, count) => `${count} prescriptions`}
            />
          </div>
        </div>
      </div>

      {/* 5. Revenue Analytics — 4 cards + trend chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between"><span className="text-sm text-slate-600">Today</span><span className="font-semibold text-slate-900">₹{displayStats.todayRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">This Week</span><span className="font-semibold text-slate-900">₹{displayStats.weeklyRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">This Month</span><span className="font-semibold text-slate-900">₹{displayStats.monthlyRevenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-600">All Time</span><span className="font-semibold text-slate-900">₹{displayStats.totalRevenue.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue Trend</h3>
          <div className="h-56 sm:h-64 relative">
            {revenueTrendData.length > 0 ? (
              <svg className="w-full h-full" viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}>
                <rect width="100%" height="100%" fill="#fafafa" />
                {revenueTrendData.map((p, i) => {
                  const x = chartPadding.left + i * revenueXStep
                  const y = chartSize.height - chartPadding.bottom - (p.revenue / safeRevenue) * innerHeight
                  return (
                    <g key={i}>
                      <line x1={x} y1={chartSize.height - chartPadding.bottom} x2={x} y2={y} stroke="#10b981" strokeWidth="2" />
                      <circle cx={x} cy={y} r="4" fill="#10b981" />
                      <text x={x} y={y - 8} className="text-xs font-medium fill-slate-700" textAnchor="middle">₹{(p.revenue / 1000).toFixed(0)}k</text>
                      <text x={x} y={chartSize.height - 12} className="text-xs fill-slate-600" textAnchor="middle">{p.label}</text>
                    </g>
                  )
                })}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No revenue data</div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Branch Performance */}
      {branches.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Branch Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-700">Branch</th>
                  <th className="text-right py-2 font-semibold text-slate-700">Visits</th>
                  <th className="text-right py-2 font-semibold text-slate-700">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branchPerformance.map((b) => (
                  <tr key={b.branchId} className="border-b border-slate-100">
                    <td className="py-2 text-slate-900">{b.branchName}</td>
                    <td className="py-2 text-right text-slate-700">{b.visits}</td>
                    <td className="py-2 text-right font-medium text-slate-900">₹{b.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Recent Appointments — with Visit Type & Payment Status */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Recent Appointments</h3>
          <button
            type="button"
            onClick={() => setShowRecentAppointments(!showRecentAppointments)}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            {showRecentAppointments ? "Hide" : "Show"}
          </button>
        </div>
        {showRecentAppointments && (
          <div className="p-4 sm:p-6">
            {filteredRecentAppointments.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No recent appointments</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Doctor</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Date & Time</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Visit Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecentAppointments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{apt.patientName}</div>
                          <div className="text-xs text-slate-500">{apt.patientEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{apt.doctorName}</div>
                          <div className="text-xs text-slate-500">{apt.doctorSpecialization}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{new Date(apt.appointmentDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                          <div className="text-xs text-slate-500">{apt.appointmentTime}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getVisitType(apt) === "Walk-in" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                            {getVisitType(apt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            apt.status === "completed" ? "bg-green-100 text-green-800" :
                            apt.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                            apt.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"
                          }`}>
                            {apt.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            getPaymentStatus(apt) === "Paid" ? "bg-green-100 text-green-700" :
                            getPaymentStatus(apt) === "Refunded" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                          }`}>
                            {getPaymentStatus(apt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredRecentAppointments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-center">
                <button type="button" onClick={() => setActiveTab("appointments")} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View all appointments →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8. Doctor Performance Analytics (compact + link to full tab) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Doctor Performance</h3>
          <button type="button" onClick={() => { setActiveTab("analytics"); setSidebarOpen(false); }} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Full analytics →
          </button>
        </div>
        {doctorSummary.length === 0 ? (
          <p className="text-slate-500 text-sm">No doctor data for selected branch</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-700">Doctor</th>
                  <th className="text-right py-2 font-semibold text-slate-700">Patients</th>
                  <th className="text-right py-2 font-semibold text-slate-700">Revenue</th>
                  <th className="text-right py-2 font-semibold text-slate-700">Cancellation %</th>
                </tr>
              </thead>
              <tbody>
                {doctorSummary.map((d, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-900">{d.doctorName}</td>
                    <td className="py-2 text-right text-slate-700">{d.totalPatients}</td>
                    <td className="py-2 text-right font-medium text-slate-900">₹{d.revenue.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600">{d.cancellationRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund Requests table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Refund Requests</h3>
        {pendingRefunds.length === 0 ? (
          <p className="text-slate-500 text-sm">No pending refund requests</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Patient</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Doctor</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Requested</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingRefunds.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{r.patientName || r.patientId}</td>
                    <td className="px-3 py-2 text-slate-700">{r.doctorName || r.doctorId}</td>
                    <td className="px-3 py-2">₹{Number(r.paymentAmount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onApproveRefund(r)}
                        disabled={processingRefundId === r.id}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
