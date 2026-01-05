'use client'

import { useState, useEffect } from 'react'
import { getDocs } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/hospital-queries'
import LoadingSpinner from '@/components/ui/StatusComponents'

interface Appointment {
  id: string
  patientId: string
  doctorId?: string
  doctorName?: string
  doctorSpecialization?: string
  appointmentDate: string
  appointmentTime?: string
  status: string
  paymentAmount?: number
  totalConsultationFee?: number
  paymentStatus?: string
  createdBy?: string
}

interface DoctorAnalytics {
  doctorId: string
  doctorName: string
  doctorSpecialization: string
  totalPatientsSeen: number
  revenueContribution: number
  averageConsultationTime: number
  peakActiveHours: Array<{
    hour: number
    hour12: string
    appointmentCount: number
  }>
  appointmentVsWalkInRatio: {
    appointments: number
    walkIns: number
    appointmentPercentage: number
    walkInPercentage: number
  }
  availabilityDays: number
}

export default function DoctorPerformanceAnalytics({ selectedBranchId = "all" }: { selectedBranchId?: string } = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()
  const [loading, setLoading] = useState(true)
  const [doctorAnalytics, setDoctorAnalytics] = useState<DoctorAnalytics[]>([])
  const [timeRange, setTimeRange] = useState<'30days' | '3months' | '6months' | '1year' | 'all'>('1year')

  useEffect(() => {
    if (!user || !activeHospitalId) return
    fetchDoctorAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeHospitalId, timeRange, selectedBranchId])

  const formatHour12 = (hour: number): string => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  const fetchDoctorAnalytics = async () => {
    if (!activeHospitalId) return
    
    try {
      setLoading(true)

      // Fetch all appointments - use hospital-scoped collection
      const appointmentsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, 'appointments'))
      let appointments: Appointment[] = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))

      // Filter by branch if selected
      if (selectedBranchId !== "all") {
        appointments = appointments.filter((apt: any) => apt.branchId === selectedBranchId)
      }

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
          new Date(apt.appointmentDate) >= thirtyDaysAgo
        )
      } else if (timeRange === '3months') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.appointmentDate) >= threeMonthsAgo
        )
      } else if (timeRange === '6months') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.appointmentDate) >= sixMonthsAgo
        )
      } else if (timeRange === '1year') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.appointmentDate) >= oneYearAgo
        )
      }

      // Calculate doctor analytics
      const doctorDataMap: Record<string, {
        doctorId: string
        doctorName: string
        doctorSpecialization: string
        appointments: Appointment[]
        uniquePatients: Set<string>
        revenue: number
        hourCounts: Record<number, number>
        appointmentCount: number
        walkInCount: number
        uniqueDays: Set<string>
        totalConsultationTime: number
        consultationCount: number
      }> = {}

      filteredAppointments.forEach(apt => {
        if (apt.doctorId && apt.doctorName) {
          if (!doctorDataMap[apt.doctorId]) {
            doctorDataMap[apt.doctorId] = {
              doctorId: apt.doctorId,
              doctorName: apt.doctorName,
              doctorSpecialization: apt.doctorSpecialization || 'General',
              appointments: [],
              uniquePatients: new Set(),
              revenue: 0,
              hourCounts: {},
              appointmentCount: 0,
              walkInCount: 0,
              uniqueDays: new Set(),
              totalConsultationTime: 0,
              consultationCount: 0
            }
          }

          const doctorData = doctorDataMap[apt.doctorId]
          doctorData.appointments.push(apt)
          
          if (apt.patientId) {
            doctorData.uniquePatients.add(apt.patientId)
          }

          const revenue = apt.paymentAmount || apt.totalConsultationFee || 0
          if (revenue > 0 && apt.paymentStatus !== 'cancelled' && apt.status !== 'cancelled') {
            doctorData.revenue += revenue
          }

          if (apt.appointmentTime) {
            const timeParts = apt.appointmentTime.split(':')
            if (timeParts.length >= 1) {
              const hour = parseInt(timeParts[0], 10)
              if (!isNaN(hour) && hour >= 0 && hour <= 23) {
                doctorData.hourCounts[hour] = (doctorData.hourCounts[hour] || 0) + 1
              }
            }
          }

          if (apt.createdBy === 'receptionist') {
            doctorData.walkInCount++
          } else {
            doctorData.appointmentCount++
          }

          if (apt.appointmentDate) {
            doctorData.uniqueDays.add(apt.appointmentDate)
          }

          if (apt.status === 'completed') {
            doctorData.totalConsultationTime += 20
            doctorData.consultationCount++
          } else if (apt.status === 'confirmed') {
            doctorData.totalConsultationTime += 15
            doctorData.consultationCount++
          }
        }
      })

      const analytics = Object.values(doctorDataMap).map(doctorData => {
        const peakActiveHours = Object.entries(doctorData.hourCounts)
          .map(([hourStr, count]) => ({
            hour: parseInt(hourStr, 10),
            hour12: formatHour12(parseInt(hourStr, 10)),
            appointmentCount: count
          }))
          .sort((a, b) => b.appointmentCount - a.appointmentCount)
          .slice(0, 3)

        const averageConsultationTime = doctorData.consultationCount > 0
          ? Math.round(doctorData.totalConsultationTime / doctorData.consultationCount)
          : 0

        const totalAppointments = doctorData.appointmentCount + doctorData.walkInCount
        const appointmentVsWalkInRatio = {
          appointments: doctorData.appointmentCount,
          walkIns: doctorData.walkInCount,
          appointmentPercentage: totalAppointments > 0 
            ? (doctorData.appointmentCount / totalAppointments) * 100 
            : 0,
          walkInPercentage: totalAppointments > 0 
            ? (doctorData.walkInCount / totalAppointments) * 100 
            : 0
        }

        return {
          doctorId: doctorData.doctorId,
          doctorName: doctorData.doctorName,
          doctorSpecialization: doctorData.doctorSpecialization,
          totalPatientsSeen: doctorData.uniquePatients.size,
          revenueContribution: Math.round(doctorData.revenue),
          averageConsultationTime,
          peakActiveHours,
          appointmentVsWalkInRatio,
          availabilityDays: doctorData.uniqueDays.size
        }
      }).sort((a, b) => b.totalPatientsSeen - a.totalPatientsSeen)

      setDoctorAnalytics(analytics)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || hospitalLoading || loading) {
    return <LoadingSpinner message="Loading doctor analytics..." />
  }

  if (doctorAnalytics.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No doctor analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Doctor Performance Analytics</h2>
          <p className="text-sm text-slate-600 mt-1">Comprehensive doctor performance metrics</p>
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

      {/* Doctor Analytics Cards */}
      <div className="space-y-6">
        {doctorAnalytics.map((doctor, idx) => (
          <div
            key={doctor.doctorId}
            className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-6 border border-slate-200 shadow-sm"
          >
            {/* Doctor Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {doctor.doctorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{doctor.doctorName}</h4>
                    <p className="text-sm text-slate-600">{doctor.doctorSpecialization}</p>
                  </div>
                </div>
              </div>
              {idx < 3 && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                  #{idx + 1}
                </span>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Total Patients Seen */}
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-1">Total Patients</p>
                <p className="text-2xl font-bold text-blue-600">{doctor.totalPatientsSeen}</p>
                <p className="text-xs text-slate-500 mt-1">Unique patients</p>
              </div>

              {/* Revenue Contribution */}
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-1">Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{doctor.revenueContribution.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">Total contribution</p>
              </div>

              {/* Average Consultation Time */}
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-1">Avg Consultation</p>
                <p className="text-2xl font-bold text-purple-600">{doctor.averageConsultationTime}</p>
                <p className="text-xs text-slate-500 mt-1">minutes</p>
              </div>

              {/* Availability Days */}
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-1">Availability</p>
                <p className="text-2xl font-bold text-orange-600">{doctor.availabilityDays}</p>
                <p className="text-xs text-slate-500 mt-1">days active</p>
              </div>
            </div>

            {/* Peak Active Hours */}
            {doctor.peakActiveHours.length > 0 && (
              <div className="mb-6">
                <h5 className="text-sm font-semibold text-slate-700 mb-3">Peak Active Hours</h5>
                <div className="flex flex-wrap gap-2">
                  {doctor.peakActiveHours.map((hourData, hourIdx) => (
                    <div
                      key={hourIdx}
                      className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-indigo-700">
                          {hourData.hour12}
                        </span>
                        <span className="text-xs text-slate-600">
                          ({hourData.appointmentCount} {hourData.appointmentCount === 1 ? 'appt' : 'appts'})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appointment vs Walk-in Ratio */}
            <div>
              <h5 className="text-sm font-semibold text-slate-700 mb-3">Appointment vs Walk-in Ratio</h5>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-700">Appointments</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">
                      {doctor.appointmentVsWalkInRatio.appointments}
                    </span>
                    <span className="text-xs text-slate-600 ml-2">
                      ({doctor.appointmentVsWalkInRatio.appointmentPercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${doctor.appointmentVsWalkInRatio.appointmentPercentage}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-700">Walk-ins</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">
                      {doctor.appointmentVsWalkInRatio.walkIns}
                    </span>
                    <span className="text-xs text-slate-600 ml-2">
                      ({doctor.appointmentVsWalkInRatio.walkInPercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${doctor.appointmentVsWalkInRatio.walkInPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

