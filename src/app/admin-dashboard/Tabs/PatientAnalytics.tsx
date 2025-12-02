'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/hospital-queries'
import LoadingSpinner from '@/components/ui/StatusComponents'
import { formatDate, calculateAge } from '@/utils/date'

interface Patient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  bloodGroup: string
  dateOfBirth: string
  createdAt: string
  address?: string
}

interface Appointment {
  id: string
  patientId: string
  appointmentDate: string
  status: string
  createdAt: string
}

interface PatientAnalytics {
  totalPatients: number
  newPatients: number // Created in last 30 days
  returningPatients: number // Patients with 2+ appointments
  averageVisitsPerYear: number
  patientRetentionRate: number // % of patients who return
  demographicDistribution: {
    gender: Record<string, number>
    ageGroups: Record<string, number>
    bloodGroups: Record<string, number>
  }
  topVisitingPatients: Array<{
    patientId: string
    patientName: string
    visitCount: number
    lastVisit: string
  }>
  monthlyGrowth: Array<{
    month: string
    newPatients: number
    totalPatients: number
  }>
  inactivePatients: number // No visits in last 6 months
  activePatients: number // Visits in last 3 months
}

export default function PatientAnalytics() {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<PatientAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<'30days' | '3months' | '6months' | '1year' | 'all'>('1year')

  useEffect(() => {
    if (!user || !activeHospitalId) return
    fetchAnalytics()
  }, [user, activeHospitalId, timeRange])

  const fetchAnalytics = async () => {
    if (!activeHospitalId) return
    
    try {
      setLoading(true)

      // Fetch all patients - use hospital-scoped collection
      const patientsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, 'patients'))
      const patients: Patient[] = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Patient))

      // Fetch all appointments - use hospital-scoped collection
      const appointmentsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, 'appointments'))
      const appointments: Appointment[] = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))

      // Calculate date ranges
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      // Filter appointments by time range
      let filteredAppointments = appointments
      if (timeRange === '30days') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= thirtyDaysAgo
        )
      } else if (timeRange === '3months') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= threeMonthsAgo
        )
      } else if (timeRange === '6months') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= sixMonthsAgo
        )
      } else if (timeRange === '1year') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= oneYearAgo
        )
      }

      // Calculate metrics
      const totalPatients = patients.length

      // New patients (created in last 30 days)
      const newPatients = patients.filter(p => {
        const createdDate = new Date(p.createdAt || 0)
        return createdDate >= thirtyDaysAgo
      }).length

      // Count appointments per patient
      const patientVisitCounts: Record<string, number> = {}
      const patientLastVisit: Record<string, Date> = {}
      
      filteredAppointments.forEach(apt => {
        if (apt.patientId) {
          patientVisitCounts[apt.patientId] = (patientVisitCounts[apt.patientId] || 0) + 1
          const visitDate = new Date(apt.appointmentDate || apt.createdAt)
          if (!patientLastVisit[apt.patientId] || visitDate > patientLastVisit[apt.patientId]) {
            patientLastVisit[apt.patientId] = visitDate
          }
        }
      })

      // Returning patients (2+ appointments)
      const returningPatients = Object.values(patientVisitCounts).filter(count => count >= 2).length

      // Average visits per year
      const totalVisits = filteredAppointments.length
      const patientsWithVisits = Object.keys(patientVisitCounts).length
      const averageVisitsPerYear = patientsWithVisits > 0 
        ? (totalVisits / patientsWithVisits) * (365 / getDaysInRange(timeRange))
        : 0

      // Patient retention rate (% who have 2+ visits)
      const patientsWithMultipleVisits = Object.values(patientVisitCounts).filter(count => count >= 2).length
      const patientRetentionRate = patientsWithVisits > 0 
        ? (patientsWithMultipleVisits / patientsWithVisits) * 100 
        : 0

      // Demographic distribution
      const genderDistribution: Record<string, number> = {}
      const ageGroups: Record<string, number> = {}
      const bloodGroupDistribution: Record<string, number> = {}

      patients.forEach(patient => {
        // Gender
        const gender = patient.gender || 'Unknown'
        genderDistribution[gender] = (genderDistribution[gender] || 0) + 1

        // Age groups
        if (patient.dateOfBirth) {
          const age = calculateAge(patient.dateOfBirth)
          if (age !== null && age >= 0) {
            let ageGroup: string
            if (age < 18) ageGroup = '0-17 (Pediatric)'
            else if (age < 30) ageGroup = '18-29 (Young Adult)'
            else if (age < 45) ageGroup = '30-44 (Adult)'
            else if (age < 60) ageGroup = '45-59 (Middle Age)'
            else ageGroup = '60+ (Senior)'
            ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1
          } else {
            // Invalid age calculation - add to unknown category
            ageGroups['Unknown'] = (ageGroups['Unknown'] || 0) + 1
          }
        } else {
          // No date of birth provided - add to unknown category
          ageGroups['Unknown'] = (ageGroups['Unknown'] || 0) + 1
        }

        // Blood groups
        if (patient.bloodGroup) {
          const bg = patient.bloodGroup.toUpperCase()
          bloodGroupDistribution[bg] = (bloodGroupDistribution[bg] || 0) + 1
        }
      })

      // Top visiting patients
      const topVisitingPatients = Object.entries(patientVisitCounts)
        .map(([patientId, visitCount]) => {
          const patient = patients.find(p => p.id === patientId)
          return {
            patientId,
            patientName: patient 
              ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown'
              : 'Unknown',
            visitCount,
            lastVisit: patientLastVisit[patientId]?.toISOString() || ''
          }
        })
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 10)

      // Monthly growth (last 12 months)
      const monthlyGrowth: Array<{ month: string; newPatients: number; totalPatients: number }> = []
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        
        const newInMonth = patients.filter(p => {
          const created = new Date(p.createdAt || 0)
          return created >= monthStart && created <= monthEnd
        }).length

        const totalByMonth = patients.filter(p => {
          const created = new Date(p.createdAt || 0)
          return created <= monthEnd
        }).length

        monthlyGrowth.push({
          month: monthName,
          newPatients: newInMonth,
          totalPatients: totalByMonth
        })
      }

      // Active vs Inactive patients
      const activePatients = new Set(
        appointments
          .filter(apt => {
            const visitDate = new Date(apt.appointmentDate || apt.createdAt)
            return visitDate >= threeMonthsAgo && apt.status !== 'cancelled'
          })
          .map(apt => apt.patientId)
      ).size

      const inactivePatients = totalPatients - activePatients

      setAnalytics({
        totalPatients,
        newPatients,
        returningPatients,
        averageVisitsPerYear: Math.round(averageVisitsPerYear * 10) / 10,
        patientRetentionRate: Math.round(patientRetentionRate * 10) / 10,
        demographicDistribution: {
          gender: genderDistribution,
          ageGroups,
          bloodGroups: bloodGroupDistribution
        },
        topVisitingPatients,
        monthlyGrowth,
        inactivePatients,
        activePatients
      })
    } catch (error) {
      console.error('Error fetching patient analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInRange = (range: string): number => {
    switch (range) {
      case '30days': return 30
      case '3months': return 90
      case '6months': return 180
      case '1year': return 365
      default: return 365
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading patient analytics..." />
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Patient Analytics & Insights</h2>
          <p className="text-sm text-slate-600 mt-1">Comprehensive patient statistics and metrics</p>
        </div>
        
        {/* Time Range Selector */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="30days">Last 30 Days</option>
          <option value="3months">Last 3 Months</option>
          <option value="6months">Last 6 Months</option>
          <option value="1year">Last Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Patients */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">Total Patients</span>
            <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-900">{analytics.totalPatients.toLocaleString()}</p>
          <p className="text-xs text-blue-600 mt-1">All registered patients</p>
        </div>

        {/* New Patients */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">New Patients</span>
            <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-900">{analytics.newPatients.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">Last 30 days</p>
        </div>

        {/* Returning Patients */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">Returning Patients</span>
            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-900">{analytics.returningPatients.toLocaleString()}</p>
          <p className="text-xs text-purple-600 mt-1">2+ appointments</p>
        </div>

        {/* Average Visits/Year */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-orange-700">Avg Visits/Year</span>
            <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-orange-900">{analytics.averageVisitsPerYear}</p>
          <p className="text-xs text-orange-600 mt-1">Per patient</p>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Patient Retention */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-700">Patient Retention Rate</span>
            <span className="text-2xl">📈</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-slate-900">{analytics.patientRetentionRate}%</p>
          </div>
          <div className="mt-3 w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(analytics.patientRetentionRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">Patients with 2+ visits</p>
        </div>

        {/* Active Patients */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-700">Active Patients</span>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{analytics.activePatients.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Visits in last 3 months</p>
        </div>

        {/* Inactive Patients */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-700">Inactive Patients</span>
            <span className="text-2xl">⏸️</span>
          </div>
          <p className="text-3xl font-bold text-orange-600">{analytics.inactivePatients.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">No visits in last 6 months</p>
        </div>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Growth Chart */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly Patient Growth</h3>
          <div className="space-y-3">
            {analytics.monthlyGrowth.slice(-6).map((month, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-20 text-xs text-slate-600 font-medium">{month.month}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all"
                        style={{ width: `${(month.totalPatients / analytics.totalPatients) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-16 text-right">
                      {month.totalPatients}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    +{month.newPatients} new
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Visiting Patients */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Visiting Patients</h3>
          <div className="space-y-3">
            {analytics.topVisitingPatients.slice(0, 5).map((patient, idx) => (
              <div key={patient.patientId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{patient.patientName}</p>
                    <p className="text-xs text-slate-500">
                      Last visit: {patient.lastVisit ? formatDate(patient.lastVisit) : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-800">{patient.visitCount}</p>
                  <p className="text-xs text-slate-500">visits</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demographic Distribution */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Gender Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.demographicDistribution.gender).map(([gender, count]) => {
              const percentage = (count / analytics.totalPatients) * 100
              return (
                <div key={gender}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{gender}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Age Groups */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Age Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.demographicDistribution.ageGroups)
              .sort((a, b) => b[1] - a[1])
              .map(([ageGroup, count]) => {
                const percentage = (count / analytics.totalPatients) * 100
                return (
                  <div key={ageGroup}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{ageGroup}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

