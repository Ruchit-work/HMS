'use client'

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore"
import { Appointment } from "@/types/patient"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"

interface DashboardStats {
  todayAppointments: number
  pendingWhatsAppBookings: number
  totalPatientsToday: number
  pendingBilling: number
  completedAppointments: number
}

interface RecentActivity {
  id: string
  type: 'appointment' | 'whatsapp_booking' | 'billing' | 'completion'
  message: string
  timestamp: string
  priority: 'high' | 'medium' | 'low'
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  timestamp: string
  read: boolean
}

interface DashboardOverviewProps {
  onTabChange?: (tab: "patients" | "doctors" | "appointments" | "book-appointment" | "admit-requests" | "billing" | "whatsapp-bookings") => void
}

export default function DashboardOverview({ onTabChange }: DashboardOverviewProps) {
  const { activeHospitalId } = useMultiHospital()
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    pendingWhatsAppBookings: 0,
    totalPatientsToday: 0,
    pendingBilling: 0,
    completedAppointments: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeHospitalId) return
    
    let unsubscribeAppointments: (() => void) | null = null

    const setupRealtimeListeners = () => {
      // Set up real-time listener for all appointments - use hospital-scoped collection
      const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
      
      unsubscribeAppointments = onSnapshot(appointmentsRef, (snapshot) => {
        // Recalculate stats with new data
        const today = new Date().toISOString().split('T')[0]
        const allAppointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        
        // Today's appointments (excluding WhatsApp pending)
        const todayAppointments = allAppointments.filter(doc => {
          const data = doc as any
          return data.appointmentDate === today && 
                 data.status !== "whatsapp_pending" && 
                 !data.whatsappPending
        })

        // Pending WhatsApp bookings
        const whatsappPending = allAppointments.filter(doc => {
          const data = doc as any
          return data.whatsappPending === true || data.status === "whatsapp_pending"
        })

        // Pending billing (appointments with remaining amount > 0 OR unpaid status)
        const pendingBilling = allAppointments.filter(doc => {
          const data = doc as any
          const hasRemainingAmount = (data.remainingAmount || 0) > 0
          const isUnpaid = data.paymentStatus !== "paid" && !data.paidAt && (data.paymentAmount || 0) <= 0
          return (hasRemainingAmount || isUnpaid) && data.status === "confirmed"
        })

        // Completed appointments today
        const completedToday = todayAppointments.filter(doc => 
          (doc as any).status === "completed"
        )

        // Unique patients today
        const uniquePatients = new Set(
          todayAppointments.map(doc => (doc as any).patientId || (doc as any).patientUid)
        )

        setStats({
          todayAppointments: todayAppointments.length,
          pendingWhatsAppBookings: whatsappPending.length,
          totalPatientsToday: uniquePatients.size,
          pendingBilling: pendingBilling.length,
          completedAppointments: completedToday.length
        })

        // Update recent activity
        updateRecentActivity(allAppointments)
        
        setLoading(false)
      }, (error) => {
        console.error("Error in appointments listener:", error)
        setLoading(false)
      })
    }

    setupRealtimeListeners()
    fetchNotifications() // Notifications are generated based on stats, so fetch them separately

    // Cleanup function
    return () => {
      if (unsubscribeAppointments) {
        unsubscribeAppointments()
      }
    }
  }, [])

  const updateRecentActivity = (allAppointments: any[]) => {
    const activities: RecentActivity[] = []
    
    // Sort by creation time and take recent ones
    const recentAppointments = allAppointments
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)
    
    recentAppointments.forEach(doc => {
      const data = doc as any
      const createdAt = new Date(data.createdAt || Date.now())
      
      if (data.whatsappPending || data.status === "whatsapp_pending") {
        activities.push({
          id: doc.id,
          type: 'whatsapp_booking',
          message: `New WhatsApp booking from ${data.patientName || 'Unknown'}`,
          timestamp: createdAt.toISOString(),
          priority: 'high'
        })
      } else if (data.status === "completed") {
        activities.push({
          id: doc.id,
          type: 'completion',
          message: `Appointment completed for ${data.patientName}`,
          timestamp: createdAt.toISOString(),
          priority: 'low'
        })
      } else if ((data.remainingAmount || 0) > 0) {
        activities.push({
          id: doc.id,
          type: 'billing',
          message: `Pending payment ₹${data.remainingAmount} for ${data.patientName}`,
          timestamp: createdAt.toISOString(),
          priority: 'medium'
        })
      } else {
        activities.push({
          id: doc.id,
          type: 'appointment',
          message: `New appointment booked for ${data.patientName}`,
          timestamp: createdAt.toISOString(),
          priority: 'medium'
        })
      }
    })

    // Sort by timestamp (newest first) and take top 8
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setRecentActivity(activities.slice(0, 8))
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchStats(),
        fetchRecentActivity(),
        fetchNotifications()
      ])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!activeHospitalId) return
    
    const today = new Date().toISOString().split('T')[0]
    const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")

    // Today's appointments
    const todayQuery = query(
      appointmentsRef,
      where("appointmentDate", "==", today)
    )
    const todaySnapshot = await getDocs(todayQuery)
    const todayAppointments = todaySnapshot.docs.filter(doc => {
      const data = doc.data()
      return data.status !== "whatsapp_pending" && !data.whatsappPending
    })

    // Pending WhatsApp bookings
    const whatsappQuery = query(
      appointmentsRef,
      where("whatsappPending", "==", true)
    )
    const whatsappSnapshot = await getDocs(whatsappQuery)

    // Pending billing (appointments with remaining amount > 0)
    const allAppointments = await getDocs(appointmentsRef)
    const pendingBilling = allAppointments.docs.filter(doc => {
      const data = doc.data()
      return (data.remainingAmount || 0) > 0 && data.status === "confirmed"
    })

    // Completed appointments today
    const completedToday = todayAppointments.filter(doc => 
      doc.data().status === "completed"
    )

    // Unique patients today
    const uniquePatients = new Set(
      todayAppointments.map(doc => doc.data().patientId || doc.data().patientUid)
    )

    setStats({
      todayAppointments: todayAppointments.length,
      pendingWhatsAppBookings: whatsappSnapshot.size,
      totalPatientsToday: uniquePatients.size,
      pendingBilling: pendingBilling.length,
      completedAppointments: completedToday.length
    })
  }

  const fetchRecentActivity = async () => {
    if (!activeHospitalId) return
    
    const activities: RecentActivity[] = []
    
    // Recent appointments (last 10) - use hospital-scoped collection
    const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
    const recentAppointmentsQuery = query(
      appointmentsRef,
      orderBy("createdAt", "desc"),
      limit(10)
    )
    
    try {
      const recentSnapshot = await getDocs(recentAppointmentsQuery)
      recentSnapshot.docs.forEach(doc => {
        const data = doc.data()
        const createdAt = new Date(data.createdAt || Date.now())
        
        if (data.whatsappPending || data.status === "whatsapp_pending") {
          activities.push({
            id: doc.id,
            type: 'whatsapp_booking',
            message: `New WhatsApp booking from ${data.patientName || 'Unknown'}`,
            timestamp: createdAt.toISOString(),
            priority: 'high'
          })
        } else if (data.status === "completed") {
          activities.push({
            id: doc.id,
            type: 'completion',
            message: `Appointment completed for ${data.patientName}`,
            timestamp: createdAt.toISOString(),
            priority: 'low'
          })
        } else if ((data.remainingAmount || 0) > 0) {
          activities.push({
            id: doc.id,
            type: 'billing',
            message: `Pending payment ₹${data.remainingAmount} for ${data.patientName}`,
            timestamp: createdAt.toISOString(),
            priority: 'medium'
          })
        } else {
          activities.push({
            id: doc.id,
            type: 'appointment',
            message: `New appointment booked for ${data.patientName}`,
            timestamp: createdAt.toISOString(),
            priority: 'medium'
          })
        }
      })
    } catch (error) {
      console.error("Error fetching recent activities:", error)
    }

    // Sort by timestamp (newest first) and take top 8
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setRecentActivity(activities.slice(0, 8))
  }

  const fetchNotifications = async () => {
    // Generate notifications based on current data
    const notifs: Notification[] = []
    
    if (stats.pendingWhatsAppBookings > 0) {
      notifs.push({
        id: 'whatsapp-pending',
        title: 'WhatsApp Bookings Pending',
        message: `${stats.pendingWhatsAppBookings} WhatsApp bookings need your attention`,
        type: 'warning',
        timestamp: new Date().toISOString(),
        read: false
      })
    }

    if (stats.pendingBilling > 5) {
      notifs.push({
        id: 'billing-pending',
        title: 'Multiple Pending Payments',
        message: `${stats.pendingBilling} appointments have pending payments`,
        type: 'info',
        timestamp: new Date().toISOString(),
        read: false
      })
    }

    const now = new Date()
    const currentHour = now.getHours()
    if (currentHour >= 9 && currentHour <= 17 && stats.todayAppointments === 0) {
      notifs.push({
        id: 'no-appointments',
        title: 'No Appointments Today',
        message: 'No appointments scheduled for today yet',
        type: 'info',
        timestamp: new Date().toISOString(),
        read: false
      })
    }

    setNotifications(notifs)
  }

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'whatsapp_booking': return '💬'
      case 'appointment': return '📅'
      case 'billing': return '💰'
      case 'completion': return '✅'
      default: return '📋'
    }
  }

  const getActivityColor = (priority: RecentActivity['priority']) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50'
      case 'medium': return 'border-l-yellow-500 bg-yellow-50'
      case 'low': return 'border-l-green-500 bg-green-50'
      default: return 'border-l-gray-500 bg-gray-50'
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'error': return 'border-l-red-500 bg-red-50 text-red-800'
      case 'warning': return 'border-l-yellow-500 bg-yellow-50 text-yellow-800'
      case 'success': return 'border-l-green-500 bg-green-50 text-green-800'
      case 'info': return 'border-l-blue-500 bg-blue-50 text-blue-800'
      default: return 'border-l-gray-500 bg-gray-50 text-gray-800'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard Overview</h1>
            </div>
            <p className="text-gray-600">
              Welcome back! Here's your operational summary for {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg ">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700">Live Updates</span>
          </div>
        </div>
      </div>

      {/* Professional Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.todayAppointments}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">WhatsApp Bookings</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.pendingWhatsAppBookings}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">Patients Today</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalPatientsToday}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">Pending Billing</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.pendingBilling}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-2">Completed</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.completedAppointments}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button 
            onClick={() => onTabChange?.("book-appointment")}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 text-center">Book Appointment</span>
          </button>

          <button 
            onClick={() => onTabChange?.("patients")}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 text-center">Add Patient</span>
          </button>

          <button 
            onClick={() => onTabChange?.("whatsapp-bookings")}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 text-center">WhatsApp Bookings</span>
          </button>

          <button 
            onClick={() => onTabChange?.("billing")}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
          >
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 text-center">Billing</span>
          </button>
        </div>
      </div>

      {/* Professional Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Professional Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM11 17H7l4 4v-4zM13 3h5l-5-5v5zM7 3H3l4-4v4z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-600">{notifications.filter(n => !n.read).length} unread</span>
            </div>
          </div>
          
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM11 17H7l4 4v-4zM13 3h5l-5-5v5zM7 3H3l4-4v4z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">All caught up!</p>
              <p className="text-gray-400 text-sm mt-1">No notifications at the moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-l-4 p-4 rounded-r-lg ${getNotificationColor(notification.type)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{notification.title}</h4>
                      <p className="text-sm opacity-90 mt-1">{notification.message}</p>
                      <p className="text-xs opacity-75 mt-2">{formatTime(notification.timestamp)}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-current rounded-full ml-2 mt-1"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Professional Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No recent activity</p>
              <p className="text-gray-400 text-sm mt-1">Activity will appear here as it happens</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className={`border-l-4 p-3 rounded-r-lg ${getActivityColor(activity.priority)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getActivityIcon(activity.type)}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{activity.message}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatTime(activity.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
