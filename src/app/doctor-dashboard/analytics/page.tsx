"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import { query, where, getDocs } from "firebase/firestore"
import LoadingSpinner from "@/components/ui/StatusComponents"
import { Appointment } from "@/types/patient"
import Link from "next/link"

interface DoctorAnalytics {
  totalPatients: number
  newPatients: number
  returningPatients: number
  totalAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  noShowAppointments: number
  completionRate: number
  averageConsultationTime: number
  patientDemographics: {
    gender: Record<string, number>
    ageGroups: Record<string, number>
  }
  topVisitingPatients: Array<{
    patientId: string
    patientName: string
    visitCount: number
    lastVisit: string
  }>
  mostCommonDiagnoses: Array<{
    diagnosis: string
    count: number
    percentage: number
  }>
  mostPrescribedMedicines: Array<{
    medicine: string
    count: number
    percentage: number
  }>
  diagnosisTrends: Array<{
    month: string
    count: number
  }>
  peakHours: Array<{
    hour: number
    hour12: string
    count: number
  }>
  peakDays: Array<{
    day: string
    dayShort: string
    count: number
  }>
  averageWaitTime: number
  followUpRate: number
  recurringConditions: Array<{
    condition: string
    patientCount: number
  }>
  monthlyStats: Array<{
    month: string
    patients: number
    appointments: number
    completed: number
  }>
}

export default function DoctorAnalyticsPage() {
  const { user, loading: authLoading } = useAuth("doctor")
  const { activeHospitalId } = useMultiHospital()
  const [analytics, setAnalytics] = useState<DoctorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month")

  const fetchAnalytics = useCallback(async () => {
    if (!user?.uid || !activeHospitalId) return

    try {
      setLoading(true)
      const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
      
      const now = new Date()
      let startDate: Date
      switch (dateRange) {
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3)
          startDate = new Date(now.getFullYear(), quarter * 3, 1)
          break
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }

      const appointmentsQuery = query(
        appointmentsRef,
        where("doctorId", "==", user.uid)
      )
      
      const snapshot = await getDocs(appointmentsQuery)
      const allAppointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[]
      
      allAppointments.sort((a, b) => {
        const dateA = new Date(a.appointmentDate).getTime()
        const dateB = new Date(b.appointmentDate).getTime()
        return dateB - dateA
      })

      const filteredAppointments = allAppointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate)
        return aptDate >= startDate
      })

      const uniquePatients = new Set(filteredAppointments.map(apt => apt.patientId))
      const completedAppts = filteredAppointments.filter(apt => apt.status === "completed")
      const cancelledAppts = filteredAppointments.filter(apt => apt.status === "cancelled")
      const noShowAppts = filteredAppointments.filter(apt => apt.status === "not_attended")

      const patientVisitCount: Record<string, { name: string; count: number; lastVisit: string }> = {}
      const diagnosisCount: Record<string, number> = {}
      const medicineCount: Record<string, number> = {}
      const hourCount: Record<number, number> = {}
      const dayCount: Record<string, number> = {}
      const monthlyData: Record<string, { patients: Set<string>; appointments: number; completed: number }> = {}

      filteredAppointments.forEach(apt => {
        if (apt.patientId) {
          if (!patientVisitCount[apt.patientId]) {
            patientVisitCount[apt.patientId] = {
              name: apt.patientName || "Unknown",
              count: 0,
              lastVisit: apt.appointmentDate
            }
          }
          patientVisitCount[apt.patientId].count++
          if (apt.appointmentDate > patientVisitCount[apt.patientId].lastVisit) {
            patientVisitCount[apt.patientId].lastVisit = apt.appointmentDate
          }
        }

        if (apt.finalDiagnosis && Array.isArray(apt.finalDiagnosis)) {
          apt.finalDiagnosis.forEach((diag: string) => {
            diagnosisCount[diag] = (diagnosisCount[diag] || 0) + 1
          })
        }
        if (apt.customDiagnosis) {
          diagnosisCount[apt.customDiagnosis] = (diagnosisCount[apt.customDiagnosis] || 0) + 1
        }

        if (apt.medicine) {
          // Parse medicine text - it can be formatted text with emojis, dosages, etc.
          // Extract medicine names from formatted prescription text
          const medicineText = apt.medicine
          
          // Try to extract medicine names from formatted text (e.g., "*1️⃣ Medicine Name 25mg*")
          const medicineNamePattern = /\*[1-9]️⃣\s+([^*]+?)(?:\s+\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap))?\*/g
          const matches = [...medicineText.matchAll(medicineNamePattern)]
          
          if (matches.length > 0) {
            // Extract medicine names from formatted text
            matches.forEach(match => {
              let medicineName = match[1].trim()
              // Remove brackets, dosages, and clean up
              medicineName = medicineName
                .replace(/\[.*?\]/g, '') // Remove brackets
                .replace(/\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap)/gi, '') // Remove dosages
                .replace(/\s*-\s*/g, ' ') // Replace dashes with spaces
                .replace(/\s+/g, ' ') // Remove extra spaces
                .trim()
              
              if (medicineName) {
                // Normalize medicine name (capitalize first letter of each word)
                const normalizedName = medicineName
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')
                medicineCount[normalizedName] = (medicineCount[normalizedName] || 0) + 1
              }
            })
          } else {
            // Fallback: try comma-separated or newline-separated
            const medicines = medicineText
              .split(/[,\n]/)
              .map(m => {
                let name = m.trim()
                // Remove common prefixes and clean up
                name = name
                  .replace(/^\*[1-9]️⃣\s*/, '') // Remove emoji prefixes
                  .replace(/\*.*?\*/g, '') // Remove bold markers
                  .replace(/\[.*?\]/g, '') // Remove brackets
                  .replace(/\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap)/gi, '') // Remove dosages
                  .replace(/•.*/g, '') // Remove bullet points and everything after
                  .replace(/\s*-\s*/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                
                // Normalize
                return name
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')
              })
              .filter(Boolean)
            
            medicines.forEach(med => {
              if (med) {
                medicineCount[med] = (medicineCount[med] || 0) + 1
              }
            })
          }
        }

        if (apt.appointmentTime) {
          const hour = parseInt(apt.appointmentTime.split(':')[0])
          hourCount[hour] = (hourCount[hour] || 0) + 1
        }

        const aptDate = new Date(apt.appointmentDate)
        const dayName = aptDate.toLocaleDateString('en-US', { weekday: 'long' })
        dayCount[dayName] = (dayCount[dayName] || 0) + 1

        const monthKey = aptDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            patients: new Set(),
            appointments: 0,
            completed: 0
          }
        }
        monthlyData[monthKey].appointments++
        if (apt.patientId) monthlyData[monthKey].patients.add(apt.patientId)
        if (apt.status === "completed") monthlyData[monthKey].completed++
      })

      const topPatients = Object.entries(patientVisitCount)
        .map(([patientId, data]) => ({
          patientId,
          patientName: data.name,
          visitCount: data.count,
          lastVisit: data.lastVisit
        }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 10)

      const totalDiagnoses = Object.values(diagnosisCount).reduce((a, b) => a + b, 0)
      const mostCommonDiagnoses = Object.entries(diagnosisCount)
        .map(([diagnosis, count]) => ({
          diagnosis,
          count,
          percentage: totalDiagnoses > 0 ? (count / totalDiagnoses) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const totalPrescriptions = Object.values(medicineCount).reduce((a, b) => a + b, 0)
      const mostPrescribedMedicines = Object.entries(medicineCount)
        .map(([medicine, count]) => ({
          medicine,
          count,
          percentage: totalPrescriptions > 0 ? (count / totalPrescriptions) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const peakHours = Object.entries(hourCount)
        .map(([hour, count]) => ({
          hour: parseInt(hour),
          hour12: formatHour12(parseInt(hour)),
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const peakDays = Object.entries(dayCount)
        .map(([day, count]) => ({
          day,
          dayShort: day.substring(0, 3),
          count
        }))
        .sort((a, b) => b.count - a.count)

      const monthlyStats = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          patients: data.patients.size,
          appointments: data.appointments,
          completed: data.completed
        }))
        .sort((a, b) => {
          const dateA = new Date(a.month)
          const dateB = new Date(b.month)
          return dateA.getTime() - dateB.getTime()
        })

      const patientAppointmentCount: Record<string, number> = {}
      filteredAppointments.forEach(apt => {
        if (apt.patientId) {
          patientAppointmentCount[apt.patientId] = (patientAppointmentCount[apt.patientId] || 0) + 1
        }
      })
      const returningPatientsCount = Object.values(patientAppointmentCount).filter(count => count > 1).length

      const followUpRate = uniquePatients.size > 0 
        ? (returningPatientsCount / uniquePatients.size) * 100 
        : 0

      const completionRate = filteredAppointments.length > 0
        ? (completedAppts.length / filteredAppointments.length) * 100
        : 0

      setAnalytics({
        totalPatients: uniquePatients.size,
        newPatients: uniquePatients.size - returningPatientsCount,
        returningPatients: returningPatientsCount,
        totalAppointments: filteredAppointments.length,
        completedAppointments: completedAppts.length,
        cancelledAppointments: cancelledAppts.length,
        noShowAppointments: noShowAppts.length,
        completionRate: Math.round(completionRate * 10) / 10,
        averageConsultationTime: 0,
        patientDemographics: {
          gender: {},
          ageGroups: {}
        },
        topVisitingPatients: topPatients,
        mostCommonDiagnoses: mostCommonDiagnoses,
        mostPrescribedMedicines: mostPrescribedMedicines,
        diagnosisTrends: monthlyStats.map(ms => ({
          month: ms.month,
          count: ms.completed
        })),
        peakHours,
        peakDays,
        averageWaitTime: 0,
        followUpRate: Math.round(followUpRate * 10) / 10,
        recurringConditions: [],
        monthlyStats
      })
    } catch {
    } finally {
      setLoading(false)
    }
  }, [user, activeHospitalId, dateRange])

  useEffect(() => {
    if (!user || !activeHospitalId) return
    fetchAnalytics()
  }, [user, activeHospitalId, dateRange, fetchAnalytics])

  const formatHour12 = (hour: number): string => {
    const period = hour >= 12 ? "PM" : "AM"
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${hour12} ${period}`
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading analytics..." />
  }

  if (!user || !analytics) {
    return null
  }

  const maxMonthValue = analytics.monthlyStats.length > 0 
    ? Math.max(...analytics.monthlyStats.map(s => s.appointments))
    : 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
                <p className="text-blue-100 text-lg">Comprehensive insights into your practice performance</p>
              </div>
              <Link
                href="/doctor-dashboard"
                className="btn-modern bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30"
              >
                ← Back to Dashboard
              </Link>
            </div>

            {/* Date Range Selector */}
            <div className="flex gap-2 flex-wrap">
              {(["week", "month", "quarter", "year"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    dateRange === range
                      ? "bg-white text-blue-600 shadow-lg scale-105"
                      : "bg-white/10 text-white/90 hover:bg-white/20 backdrop-blur-sm"
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Performance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-100 text-sm font-medium mb-1">Total Patients</p>
              <p className="text-4xl font-bold mb-2">{analytics.totalPatients}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                  {analytics.newPatients} new
                </span>
                <span className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                  {analytics.returningPatients} returning
                </span>
              </div>
            </div>
          </div>

          <div 
            className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-emerald-100 text-sm font-medium mb-1">Appointments</p>
              <p className="text-4xl font-bold mb-2">{analytics.totalAppointments}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2 backdrop-blur-sm">
                  <div 
                    className="bg-white h-2 rounded-full"
                    style={{ width: `${analytics.completionRate}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold">{analytics.completionRate}%</span>
              </div>
            </div>
          </div>

          <div 
            className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
              <p className="text-purple-100 text-sm font-medium mb-1">Follow-up Rate</p>
              <p className="text-4xl font-bold mb-2">{analytics.followUpRate}%</p>
              <p className="text-purple-100 text-xs">Patient retention</p>
            </div>
          </div>

          <div 
            className="bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <p className="text-red-100 text-sm font-medium mb-1">Cancellations</p>
              <p className="text-4xl font-bold mb-2">
                {analytics.cancelledAppointments + analytics.noShowAppointments}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                  {analytics.cancelledAppointments} cancelled
                </span>
                <span className="bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                  {analytics.noShowAppointments} no-show
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Common Diagnoses */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Most Common Diagnoses</h2>
                <p className="text-sm text-slate-500">Top conditions treated</p>
              </div>
            </div>
            {analytics.mostCommonDiagnoses.length > 0 ? (
              <div className="space-y-4">
                {analytics.mostCommonDiagnoses.map((item, index) => (
                  <div key={index} className="group">
                    <div className="flex items-center gap-4 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {item.diagnosis}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-slate-700 min-w-[60px] text-right">
                            {item.count} {item.count === 1 ? 'case' : 'cases'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-500 font-medium">No diagnosis data available</p>
                <p className="text-slate-400 text-sm mt-1">Data will appear as you complete appointments</p>
              </div>
            )}
          </div>

          {/* Most Prescribed Medicines */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Most Prescribed Medicines</h2>
                <p className="text-sm text-slate-500">Frequently used medications</p>
              </div>
            </div>
            {analytics.mostPrescribedMedicines.length > 0 ? (
              <div className="space-y-4">
                {analytics.mostPrescribedMedicines.map((item, index) => (
                  <div key={index} className="group">
                    <div className="flex items-center gap-4 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${
                        index === 0 ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 group-hover:text-green-600 transition-colors">
                          {item.medicine}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-green-500 to-emerald-600 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-slate-700 min-w-[60px] text-right">
                            {item.count}x
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p className="text-slate-500 font-medium">No prescription data available</p>
                <p className="text-slate-400 text-sm mt-1">Data will appear as you prescribe medicines</p>
              </div>
            )}
          </div>

          {/* Peak Hours with Visual Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Peak Activity Hours</h2>
                <p className="text-sm text-slate-500">Busiest times of day</p>
              </div>
            </div>
            {analytics.peakHours.length > 0 ? (
              <div className="space-y-4">
                {analytics.peakHours.map((item, index) => {
                  const maxCount = analytics.peakHours[0].count
                  const percentage = (item.count / maxCount) * 100
                  return (
                    <div key={index} className="group">
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-sm font-semibold text-slate-700">{item.hour12}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-pink-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                style={{ width: `${percentage}%` }}
                              >
                                {percentage > 15 && (
                                  <span className="text-xs font-bold text-white">{item.count}</span>
                                )}
                              </div>
                            </div>
                            {percentage <= 15 && (
                              <span className="text-sm font-bold text-slate-700 min-w-[40px] text-right">
                                {item.count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-500 font-medium">No time data available</p>
              </div>
            )}
          </div>

          {/* Peak Days with Visual Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Busiest Days</h2>
                <p className="text-sm text-slate-500">Appointments by weekday</p>
              </div>
            </div>
            {analytics.peakDays.length > 0 ? (
              <div className="space-y-4">
                {analytics.peakDays.map((item, index) => {
                  const maxCount = analytics.peakDays[0].count
                  const percentage = (item.count / maxCount) * 100
                  return (
                    <div key={index} className="group">
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-sm font-semibold text-slate-700">{item.dayShort}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                              <div
                                className="bg-gradient-to-r from-indigo-500 to-blue-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                style={{ width: `${percentage}%` }}
                              >
                                {percentage > 15 && (
                                  <span className="text-xs font-bold text-white">{item.count}</span>
                                )}
                              </div>
                            </div>
                            {percentage <= 15 && (
                              <span className="text-sm font-bold text-slate-700 min-w-[40px] text-right">
                                {item.count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-500 font-medium">No day data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Trends Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Monthly Trends</h2>
              <p className="text-sm text-slate-500">Performance over time</p>
            </div>
          </div>
          {analytics.monthlyStats.length > 0 ? (
            <div className="space-y-6">
              {/* Bar Chart Visualization */}
              <div className="flex items-end gap-2 h-64 pb-4 border-b border-slate-200">
                {analytics.monthlyStats.map((stat, index) => {
                  const height = (stat.appointments / maxMonthValue) * 100
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group">
                      <div className="w-full flex flex-col items-center gap-1 mb-2">
                        <div 
                          className="w-full bg-gradient-to-t from-teal-500 to-cyan-600 rounded-t-lg transition-all duration-500 hover:from-teal-600 hover:to-cyan-700 group-hover:shadow-lg"
                          style={{ height: `${height}%`, minHeight: '8px' }}
                        >
                          <div className="h-full w-full bg-white/20 rounded-t-lg"></div>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-slate-600 text-center mt-2 transform -rotate-45 origin-center whitespace-nowrap">
                        {stat.month.split(' ')[0]}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-8">{stat.appointments}</div>
                    </div>
                  )
                })}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-4 px-4 text-sm font-bold text-slate-700">Month</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-slate-700">Patients</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-slate-700">Appointments</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-slate-700">Completed</th>
                      <th className="text-right py-4 px-4 text-sm font-bold text-slate-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.monthlyStats.map((stat, index) => {
                      const completionRate = stat.appointments > 0 
                        ? Math.round((stat.completed / stat.appointments) * 100) 
                        : 0
                      return (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4">
                            <span className="font-semibold text-slate-900">{stat.month}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-slate-700 font-medium">{stat.patients}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-slate-700 font-medium">{stat.appointments}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-emerald-600 font-semibold">{stat.completed}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              completionRate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                              completionRate >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {completionRate}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-slate-500 font-medium">No trend data available</p>
            </div>
          )}
        </div>

        {/* Top Visiting Patients */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Top Visiting Patients</h2>
              <p className="text-sm text-slate-500">Most frequent patients</p>
            </div>
          </div>
          {analytics.topVisitingPatients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {analytics.topVisitingPatients.map((patient, index) => (
                <div 
                  key={patient.patientId} 
                  className="group p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl mb-3 shadow-md ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                      index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                      index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                      'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                    }`}>
                      {index < 3 ? '🏆' : index + 1}
                    </div>
                    <p className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {patient.patientName}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">
                        {patient.visitCount} {patient.visitCount === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Last: {new Date(patient.lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-slate-500 font-medium">No patient data available</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
