'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/hospital-queries'
import LoadingSpinner from '@/components/ui/StatusComponents'

interface Appointment {
  id: string
  patientId: string
  doctorId?: string
  doctorName?: string
  appointmentDate: string
  appointmentTime?: string
  status: string
  paymentAmount?: number
  paymentStatus?: string
  createdBy?: string
  createdAt?: string
}

interface Patient {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  createdAt?: string
  createdBy?: string
}

interface Receptionist {
  id: string
  email: string
  firstName: string
  lastName: string
  hospitalId: string
}

interface ReceptionistAnalytics {
  receptionistId: string
  receptionistName: string
  receptionistEmail: string
  patientsAdded: number
  appointmentsBooked: number
  totalRevenue: number
  performanceScore: number
}

interface BookingRatio {
  whatsapp: {
    count: number
    percentage: number
  }
  receptionist: {
    count: number
    percentage: number
  }
  portal: {
    count: number
    percentage: number
  }
  manual: {
    count: number
    percentage: number
  }
}

export default function ReceptionistPerformanceAnalytics() {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()
  const [loading, setLoading] = useState(true)
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [receptionistAnalytics, setReceptionistAnalytics] = useState<ReceptionistAnalytics[]>([])
  const [totalPatientsByReceptionists, setTotalPatientsByReceptionists] = useState(0)
  const [totalAppointmentsByReceptionists, setTotalAppointmentsByReceptionists] = useState(0)
  const [bookingRatio, setBookingRatio] = useState<BookingRatio>({
    whatsapp: { count: 0, percentage: 0 },
    receptionist: { count: 0, percentage: 0 },
    portal: { count: 0, percentage: 0 },
    manual: { count: 0, percentage: 0 }
  })
  const [timeRange, setTimeRange] = useState<'30days' | '3months' | '6months' | '1year' | 'all'>('1year')

  useEffect(() => {
    if (!user || !activeHospitalId) return
    fetchReceptionistAnalytics()
  }, [user, activeHospitalId, timeRange])

  const fetchReceptionistAnalytics = async () => {
    if (!activeHospitalId) return
    
    try {
      setLoading(true)

      // Fetch all receptionists for this hospital
      const receptionistsRef = collection(db, 'receptionists')
      const receptionistsQuery = query(
        receptionistsRef,
        where('hospitalId', '==', activeHospitalId)
      )
      const receptionistsSnapshot = await getDocs(receptionistsQuery)
      const receptionistsList: Receptionist[] = receptionistsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Receptionist))
      setReceptionists(receptionistsList)

      // Fetch all patients
      const patientsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, 'patients'))
      const patients: Patient[] = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Patient))

      // Fetch all appointments
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

      // Filter by time range
      let filteredPatients = patients
      let filteredAppointments = appointments
      
      if (timeRange === '30days') {
        filteredPatients = patients.filter(p => {
          if (!p.createdAt) return false
          return new Date(p.createdAt) >= thirtyDaysAgo
        })
        filteredAppointments = appointments.filter(apt => {
          if (!apt.createdAt) return false
          return new Date(apt.createdAt) >= thirtyDaysAgo
        })
      } else if (timeRange === '3months') {
        filteredPatients = patients.filter(p => {
          if (!p.createdAt) return false
          return new Date(p.createdAt) >= threeMonthsAgo
        })
        filteredAppointments = appointments.filter(apt => {
          if (!apt.createdAt) return false
          return new Date(apt.createdAt) >= threeMonthsAgo
        })
      } else if (timeRange === '6months') {
        filteredPatients = patients.filter(p => {
          if (!p.createdAt) return false
          return new Date(p.createdAt) >= sixMonthsAgo
        })
        filteredAppointments = appointments.filter(apt => {
          if (!apt.createdAt) return false
          return new Date(apt.createdAt) >= sixMonthsAgo
        })
      } else if (timeRange === '1year') {
        filteredPatients = patients.filter(p => {
          if (!p.createdAt) return false
          return new Date(p.createdAt) >= oneYearAgo
        })
        filteredAppointments = appointments.filter(apt => {
          if (!apt.createdAt) return false
          return new Date(apt.createdAt) >= oneYearAgo
        })
      }

      // Calculate patients added by receptionists
      const patientsByReceptionists = filteredPatients.filter(p => 
        p.createdBy === 'receptionist'
      )
      setTotalPatientsByReceptionists(patientsByReceptionists.length)

      // Calculate appointments booked by receptionists
      const appointmentsByReceptionists = filteredAppointments.filter(apt => 
        apt.createdBy === 'receptionist'
      )
      setTotalAppointmentsByReceptionists(appointmentsByReceptionists.length)

      // Calculate booking ratio (WhatsApp vs Receptionist vs Portal)
      // WhatsApp bookings
      const whatsappBookings = filteredAppointments.filter(apt => 
        apt.createdBy === 'whatsapp' || apt.createdBy === 'whatsapp_flow'
      )
      // Receptionist bookings
      const receptionistBookings = filteredAppointments.filter(apt => 
        apt.createdBy === 'receptionist'
      )
      // Patient portal bookings (createdBy === 'patient' or missing/undefined when booked by patient)
      const portalBookings = filteredAppointments.filter(apt =>
        apt.createdBy === 'patient' || (!apt.createdBy && apt.patientId) // Portal bookings may not have createdBy set
      )
      // Manual bookings = Receptionist + Portal
      const manualBookings = [...receptionistBookings, ...portalBookings]
      const totalBookings = filteredAppointments.length
      
      setBookingRatio({
        whatsapp: {
          count: whatsappBookings.length,
          percentage: totalBookings > 0 ? (whatsappBookings.length / totalBookings) * 100 : 0
        },
        receptionist: {
          count: receptionistBookings.length,
          percentage: totalBookings > 0 ? (receptionistBookings.length / totalBookings) * 100 : 0
        },
        portal: {
          count: portalBookings.length,
          percentage: totalBookings > 0 ? (portalBookings.length / totalBookings) * 100 : 0
        },
        manual: {
          count: manualBookings.length,
          percentage: totalBookings > 0 ? (manualBookings.length / totalBookings) * 100 : 0
        }
      })

      // Calculate individual receptionist analytics
      // Note: Since we can't track which specific receptionist created what,
      // we'll show aggregate stats. In the future, we can enhance the data model
      // to include receptionistId in appointments/patients.
      const receptionistStats: ReceptionistAnalytics[] = receptionistsList.map(rec => {
        // For now, we'll show equal distribution or aggregate stats
        // This is a placeholder - ideally we'd track receptionistId in appointments/patients
        const avgPatientsPerReceptionist = receptionistsList.length > 0 
          ? patientsByReceptionists.length / receptionistsList.length 
          : 0
        const avgAppointmentsPerReceptionist = receptionistsList.length > 0
          ? appointmentsByReceptionists.length / receptionistsList.length
          : 0
        
        // Calculate revenue from appointments (approximate)
        const receptionistAppointments = appointmentsByReceptionists // All receptionist appointments
        const revenue = receptionistAppointments.reduce((sum, apt) => {
          return sum + (apt.paymentAmount || 0)
        }, 0) / receptionistsList.length // Divide equally for now

        // Performance score (weighted: 40% patients, 40% appointments, 20% revenue)
        const maxPatients = Math.max(...receptionistsList.map(() => avgPatientsPerReceptionist), 1)
        const maxAppointments = Math.max(...receptionistsList.map(() => avgAppointmentsPerReceptionist), 1)
        const maxRevenue = Math.max(...receptionistsList.map(() => revenue), 1)
        
        const performanceScore = (
          (avgPatientsPerReceptionist / maxPatients) * 40 +
          (avgAppointmentsPerReceptionist / maxAppointments) * 40 +
          (revenue / maxRevenue) * 20
        )

        return {
          receptionistId: rec.id,
          receptionistName: `${rec.firstName} ${rec.lastName}`,
          receptionistEmail: rec.email,
          patientsAdded: Math.round(avgPatientsPerReceptionist),
          appointmentsBooked: Math.round(avgAppointmentsPerReceptionist),
          totalRevenue: Math.round(revenue),
          performanceScore: Math.round(performanceScore)
        }
      }).sort((a, b) => b.performanceScore - a.performanceScore)

      setReceptionistAnalytics(receptionistStats)
    } catch (error) {
      console.error('Error fetching receptionist analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || hospitalLoading || loading) {
    return <LoadingSpinner message="Loading receptionist analytics..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Receptionist Performance Analytics</h2>
          <p className="text-sm text-slate-600 mt-1">Track staff performance and booking metrics</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="30days">Last 30 Days</option>
          <option value="3months">Last 3 Months</option>
          <option value="6months">Last 6 Months</option>
          <option value="1year">Last 1 Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total Receptionists</p>
              <p className="text-3xl font-bold text-slate-800">{receptionists.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Patients Added</p>
              <p className="text-3xl font-bold text-slate-800">{totalPatientsByReceptionists}</p>
              <p className="text-xs text-slate-500 mt-1">By receptionists</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Appointments Booked</p>
              <p className="text-3xl font-bold text-slate-800">{totalAppointmentsByReceptionists}</p>
              <p className="text-xs text-slate-500 mt-1">By receptionists</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Portal Bookings</p>
              <p className="text-3xl font-bold text-slate-800">{bookingRatio.portal.count}</p>
              <p className="text-xs text-slate-500 mt-1">{bookingRatio.portal.percentage.toFixed(1)}% of total</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💻</span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Ratio Chart */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Booking Source Distribution</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">WhatsApp Bookings</span>
              <span className="text-sm font-semibold text-slate-900">
                {bookingRatio.whatsapp.count} ({bookingRatio.whatsapp.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all"
                style={{ width: `${bookingRatio.whatsapp.percentage}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Receptionist Bookings</span>
              <span className="text-sm font-semibold text-slate-900">
                {bookingRatio.receptionist.count} ({bookingRatio.receptionist.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-orange-500 to-orange-600 h-4 rounded-full transition-all"
                style={{ width: `${bookingRatio.receptionist.percentage}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Patient Portal Bookings</span>
              <span className="text-sm font-semibold text-slate-900">
                {bookingRatio.portal.count} ({bookingRatio.portal.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all"
                style={{ width: `${bookingRatio.portal.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Staff Performance Leaderboard */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Staff Performance Leaderboard</h3>
        {receptionistAnalytics.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No receptionist data available for the selected time range.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receptionistAnalytics.map((rec, idx) => (
              <div 
                key={rec.receptionistId} 
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    idx === 0 ? 'bg-yellow-500' : 
                    idx === 1 ? 'bg-slate-400' : 
                    idx === 2 ? 'bg-amber-600' : 
                    'bg-slate-300'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{rec.receptionistName}</p>
                    <p className="text-xs text-slate-500">{rec.receptionistEmail}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-right">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Patients</p>
                    <p className="font-semibold text-slate-800">{rec.patientsAdded}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Appointments</p>
                    <p className="font-semibold text-slate-800">{rec.appointmentsBooked}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Revenue</p>
                    <p className="font-semibold text-slate-800">₹{rec.totalRevenue.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Score</p>
                    <p className="font-semibold text-slate-800">{rec.performanceScore}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note about data tracking */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Currently, individual receptionist tracking is limited. To see per-receptionist metrics, 
          we need to enhance the data model to include <code className="bg-blue-100 px-1 rounded">receptionistId</code> in 
          appointments and patient records. Currently showing aggregate statistics.
        </p>
      </div>
    </div>
  )
}

