"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import { useRouter } from "next/navigation"
import { formatDateTime } from "@/utils/date"
import ConfirmDialog from "@/components/ui/ConfirmDialog"
import Notification from "@/components/ui/Notification"
import { Appointment as AppointmentType } from "@/types/patient"
import PatientManagement from "./Tabs/PatientManagement"
import DoctorManagement from "./Tabs/DoctorManagement"
import AppoinmentManagement from "./Tabs/AppoinmentManagement"
import CampaignManagement from "./Tabs/CampaignManagement"
import BillingManagement from "./Tabs/BillingManagement"
import AdminProtected from "@/components/AdminProtected"

interface UserData {
  id: string;
  name: string;
  firstName?: string;
  email: string;
  role: string;
}

interface DashboardStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  todayAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  appointmentTrends: {
    weekly: TrendPoint[];
    monthly: TrendPoint[];
    yearly: TrendPoint[];
  };
  appointmentTotals: {
    weekly: number;
    monthly: number;
    yearly: number;
  };
  commonConditions: { condition: string; count: number }[];
}

interface TrendPoint {
  label: string;
  fullLabel: string;
  count: number;
}

export default function AdminDashboard() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalDoctors: 0,
    totalAppointments: 0,
    todayAppointments: 0,
    completedAppointments: 0,
    pendingAppointments: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    appointmentTrends: {
      weekly: [],
      monthly: [],
      yearly: []
    },
    appointmentTotals: {
      weekly: 0,
      monthly: 0,
      yearly: 0
    },
    commonConditions: []
  })
  const [recentAppointments, setRecentAppointments] = useState<AppointmentType[]>([])
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "patients" | "doctors" | "campaigns" | "appointments" | "billing" | "reports">("overview")
  const [showRecentAppointments, setShowRecentAppointments] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [pendingRefunds, setPendingRefunds] = useState<any[]>([])
  const [loadingRefunds, setLoadingRefunds] = useState(false)
  const [trendView, setTrendView] = useState<"weekly" | "monthly" | "yearly">("weekly")
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  const trendData = stats.appointmentTrends[trendView] || []
  const trendTotal = stats.appointmentTotals[trendView] || 0
  const maxTrendCount = trendData.reduce((max, point) => Math.max(max, point.count), 0)
  const safeTrendCount = Math.max(maxTrendCount, 1)
  const chartPadding = { left: 60, right: 40, top: 20, bottom: 20 }
  const chartSize = { width: 400, height: 200 }
  const innerWidth = chartSize.width - chartPadding.left - chartPadding.right
  const innerHeight = chartSize.height - chartPadding.top - chartPadding.bottom
  const xStep = trendData.length > 1 ? innerWidth / (trendData.length - 1) : 0

  // Protect route - only allow admins
  const { user, loading: authLoading } = useAuth("admin")
  const router = useRouter()

  const fetchDashboardData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Get admin data
      const adminDoc = await getDoc(doc(db, "admins", user.uid))
      if (adminDoc.exists()) {
        const data = adminDoc.data() as UserData
        setUserData(data)
      }

      // Get all patients count
      const patientsSnapshot = await getDocs(collection(db, "patients"))
      const totalPatients = patientsSnapshot.size

      // Get all doctors count
      const doctorsSnapshot = await getDocs(collection(db, "doctors"))
      const totalDoctors = doctorsSnapshot.size

      // Get all appointments
      const appointmentsSnapshot = await getDocs(collection(db, "appointments"))
      const allAppointments = appointmentsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AppointmentType))

      const totalAppointments = allAppointments.length
      const completedAppointments = allAppointments.filter(apt => apt.status === "completed").length
      const pendingAppointments = allAppointments.filter(apt => apt.status === "confirmed" || (apt as any).status === 'resrescheduled').length

      // Today's appointments
      const today = new Date().toDateString()
      const todayAppointments = allAppointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      ).length

      // Calculate revenue
      const totalRevenue = allAppointments
        .filter(apt => apt.status === "completed")
        .reduce((sum, apt) => sum + (apt.paymentAmount || 0), 0)

      // Monthly revenue (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const monthlyRevenue = allAppointments
        .filter(apt => apt.status === "completed" && new Date(apt.appointmentDate) >= thirtyDaysAgo)
        .reduce((sum, apt) => sum + (apt.paymentAmount || 0), 0)

      // Weekly revenue (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const weeklyRevenue = allAppointments
        .filter(apt => apt.status === "completed" && new Date(apt.appointmentDate) >= sevenDaysAgo)
        .reduce((sum, apt) => sum + (apt.paymentAmount || 0), 0)

      // Get recent appointments (last 10)
      const recentAppointmentsQuery = query(
        collection(db, "appointments"),
        orderBy("createdAt", "desc"),
        limit(10)
      )
      const recentSnapshot = await getDocs(recentAppointmentsQuery)
      const recent = recentSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AppointmentType))

      // Aggregate appointments for trend views
      const parsedAppointments = allAppointments
        .map((apt) => {
          if (!apt.appointmentDate) return null
          const dt = new Date(apt.appointmentDate)
          if (Number.isNaN(dt.getTime())) return null
          dt.setHours(0, 0, 0, 0)
          return dt
        })
        .filter((value): value is Date => Boolean(value))

      const now = new Date()
      now.setHours(0, 0, 0, 0)

      // Weekly: current week (Mon-Sun)
      const weeklyTrend: TrendPoint[] = []
      let weeklyTotal = 0
      const startOfWeek = new Date(now)
      const dayOfWeek = startOfWeek.getDay() // Sun=0
      const distanceToMonday = (dayOfWeek + 6) % 7
      startOfWeek.setDate(startOfWeek.getDate() - distanceToMonday)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)

      for (let offset = 0; offset < 7; offset++) {
        const currentDay = new Date(startOfWeek)
        currentDay.setDate(startOfWeek.getDate() + offset)
        const nextDay = new Date(currentDay)
        nextDay.setDate(currentDay.getDate() + 1)
        const label = currentDay.toLocaleDateString("en-US", { weekday: "short" })
        const fullLabel = currentDay.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        const count = parsedAppointments.filter((dt) => dt >= currentDay && dt < nextDay).length
        weeklyTotal += count
        weeklyTrend.push({ label, fullLabel, count })
      }

      // Monthly: current month segmented into buckets
      const monthlyTrend: TrendPoint[] = []
      let monthlyTotal = 0
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      const bucketRanges: Array<[number, number]> = [
        [1, 5],
        [6, 10],
        [11, 15],
        [16, 20],
        [21, 25],
        [26, daysInMonth]
      ]

      bucketRanges.forEach(([startDay, endDay]) => {
        if (startDay > daysInMonth) {
          return
        }
        const adjustedEndDay = Math.min(endDay, daysInMonth)
        const bucketLabel = `${startDay}-${adjustedEndDay}`
        const startDate = new Date(currentYear, currentMonth, startDay)
        const endDate = new Date(currentYear, currentMonth, adjustedEndDay + 1)
        const count = parsedAppointments.filter((dt) => dt >= startDate && dt < endDate).length
        monthlyTotal += count
        monthlyTrend.push({
          label: bucketLabel,
          fullLabel: `${bucketLabel} ${startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
          count
        })
      })

      // Yearly: each month of current year
      const yearlyTrend: TrendPoint[] = []
      let yearlyTotal = 0
      for (let month = 0; month < 12; month++) {
        const startDate = new Date(currentYear, month, 1)
        const endDate = new Date(currentYear, month + 1, 1)
        const count = parsedAppointments.filter((dt) => dt >= startDate && dt < endDate).length
        yearlyTotal += count
        yearlyTrend.push({
          label: startDate.toLocaleDateString("en-US", { month: "short" }),
          fullLabel: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          count
        })
      }

      // Calculate common conditions from chief complaints
      const conditionCounts: { [key: string]: number } = {}
      allAppointments.forEach(apt => {
        const complaint = apt.chiefComplaint?.toLowerCase() || ''
        
        // Extract common conditions from complaints
        const conditions = [
          'fever', 'cough', 'headache', 'pain', 'cold', 'flu', 'diabetes', 'hypertension',
          'asthma', 'depression', 'anxiety', 'back pain', 'chest pain', 'stomach pain',
          'skin problem', 'allergy', 'infection', 'blood pressure', 'heart', 'lung',
          'kidney', 'liver', 'eye', 'ear', 'nose', 'throat', 'dental', 'mental health'
        ]
        
        conditions.forEach(condition => {
          if (complaint.includes(condition)) {
            conditionCounts[condition] = (conditionCounts[condition] || 0) + 1
          }
        })
      })

      const commonConditions = Object.entries(conditionCounts)
        .map(([condition, count]) => ({ condition, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8) // Top 8 conditions

      setStats({
        totalPatients,
        totalDoctors,
        totalAppointments,
        todayAppointments,
        completedAppointments,
        pendingAppointments,
        totalRevenue,
        monthlyRevenue,
        weeklyRevenue,
        appointmentTrends: {
          weekly: weeklyTrend,
          monthly: monthlyTrend,
          yearly: yearlyTrend
        },
        appointmentTotals: {
          weekly: weeklyTotal,
          monthly: monthlyTotal,
          yearly: yearlyTotal
        },
        commonConditions
      })

      setRecentAppointments(recent)

      // Load pending doctor schedule requests
      setLoadingRequests(true)
      const reqQuery = query(
        collection(db, 'doctor_schedule_requests'),
        where('status', '==', 'pending'),
        limit(20)
      )
      const reqSnap = await getDocs(reqQuery)
      const reqsRaw = reqSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      // Enrich with doctor name for easier verification
      const reqs = await Promise.all(reqsRaw.map(async (r) => {
        try {
          const dref = await getDoc(doc(db, 'doctors', String(r.doctorId)))
          const ddata = dref.exists() ? dref.data() as any : null
          return { ...r, doctorName: ddata ? `${ddata.firstName || ''} ${ddata.lastName || ''}`.trim() : r.doctorId }
        } catch {
          return { ...r, doctorName: r.doctorId }
        }
      }))
      setPendingRequests(reqs)
      setLoadingRequests(false)

      // Load pending refund requests
      setLoadingRefunds(true)
      const refundQ = query(
        collection(db, 'refund_requests'),
        where('status', '==', 'pending'),
        limit(50)
      )
      const refundSnap = await getDocs(refundQ)
      const refunds = refundSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      // enrich with patient and doctor names
      const refundsEnriched = await Promise.all(refunds.map(async (r) => {
        let patientName = r.patientId
        let doctorName = r.doctorId
        try {
          const p = await getDoc(doc(db, 'patients', String(r.patientId)))
          if (p.exists()) {
            const pd = p.data() as any
            patientName = `${pd.firstName || ''} ${pd.lastName || ''}`.trim() || r.patientId
          }
        } catch {}
        try {
          const dref = await getDoc(doc(db, 'doctors', String(r.doctorId)))
          if (dref.exists()) {
            const dd = dref.data() as any
            doctorName = `${dd.firstName || ''} ${dd.lastName || ''}`.trim() || r.doctorId
          }
        } catch {}
        return { ...r, patientName, doctorName }
      }))
      setPendingRefunds(refundsEnriched)
      setLoadingRefunds(false)

    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setNotification({ 
        type: "error", 
        message: "Failed to load dashboard data" 
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const handleRefresh = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    await fetchDashboardData()
    setNotification({ type: "success", message: "Dashboard data refreshed!" })
  }

  const approveRequest = async (request: any) => {
    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to approve requests")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch('/api/admin/approve-schedule-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId: request.id })
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        throw new Error(j?.error || 'Approval failed')
      }
      const data = await res.json()
      setPendingRequests(prev => prev.filter(r => r.id !== request.id))
      setNotification({ type: 'success', message: `Approved. Conflicts: ${data.conflicts}, awaiting: ${data.awaitingCount}, cancelled: ${data.cancelledCount}` })
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to approve request' })
    }
  }

  const rejectRequest = async (request: any) => {
    try {
      await updateDoc(doc(db, 'doctor_schedule_requests', request.id), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: user?.uid || null,
      })
      setPendingRequests(prev => prev.filter(r => r.id !== request.id))
      setNotification({ type: 'success', message: 'Request rejected.' })
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to reject request' })
    }
  }

  const approveRefund = async (refund: any) => {
    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to approve refunds")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch('/api/admin/approve-refund', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refundRequestId: refund.id })
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        throw new Error(j?.error || 'Failed to approve refund')
      }
      const data = await res.json()
      setPendingRefunds(prev => prev.filter(r => r.id !== refund.id))
      setNotification({ type: 'success', message: `Refund approved. Amount: ₹${data.amountRefunded || 0}` })
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to approve refund' })
    }
  }

  const handleLogout = async () => {
    try {
      setLogoutLoading(true)
      await signOut(auth)
      router.replace("/auth/login?role=admin")
    } catch (error) {
      console.error("Logout error:", error)
      setNotification({ 
        type: "error", 
        message: "Failed to logout. Please try again." 
      })
    } finally {
      setLogoutLoading(false)
      setLogoutConfirmOpen(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading admin dashboard..." />
  }

  if (!user || !userData) {
    return null
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-gray-50">
      {/* Mobile Menu Button - Only show when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white p-2.5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition-all duration-200"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5">
            <span className="block w-4 h-0.5 bg-gray-600"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
          </div>
        </button>
      )}

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">H</span>
            </div>
            <h1 className="text-white text-xl font-bold">HMS Admin</h1>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto text-white hover:text-purple-200 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="mt-8 px-4">
          <div className="space-y-2">
            <button
              onClick={() => {
                setActiveTab("overview")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "overview" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
              Dashboard Overview
            </button>
            
            <button
              onClick={() => {
                setActiveTab("patients")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "patients" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Patients
            </button>
            
            <button
              onClick={() => {
                setActiveTab("doctors")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "doctors" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Doctors
            </button>

            <button
              onClick={() => {
                setActiveTab("campaigns")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "campaigns" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 20l4-2a4 4 0 014 0l4 2 4-2a4 4 0 014 0l0 0" />
              </svg>
              Campaigns
            </button>
            
            <button
              onClick={() => {
                setActiveTab("appointments")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "appointments" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Appointments
            </button>
            
            <button
              onClick={() => {
                setActiveTab("billing")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "billing" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Billing & Payments
            </button>
            
            <button
              onClick={() => {
                setActiveTab("reports")
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "reports" 
                  ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" 
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports & Analytics
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
                  {activeTab === "overview" ? "Dashboard Overview" : 
                   activeTab === "patients" ? "Patient Management" :
                   activeTab === "doctors" ? "Doctor Management" :
                   activeTab === "campaigns" ? "Campaigns" :
                   activeTab === "appointments" ? "Appointment Management" :
                   activeTab === "billing" ? "Billing & Payments" :
                   "Reports & Analytics"}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  {activeTab === "overview" ? "Hospital management system overview" :
                   activeTab === "patients" ? "Manage patient records and information" :
                   activeTab === "doctors" ? "Manage doctor profiles and schedules" :
                   activeTab === "campaigns" ? "Create, publish, and manage promotional campaigns" :
                   activeTab === "appointments" ? "Monitor and manage all appointments" :
                   activeTab === "billing" ? "View billing records, payments, and revenue tracking" :
                   "View detailed reports and analytics"}
                </p>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 sm:gap-3 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">
                        {userData.firstName?.charAt(0) || userData.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {userData.firstName || "Admin"}
                      </p>
                      <p className="text-xs text-gray-500">Administrator</p>
                    </div>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* User Dropdown Menu */}
                  {showUserDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowUserDropdown(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">
                            {userData.firstName || "Admin"}
                          </p>
                          <p className="text-xs text-gray-500">{userData.email}</p>
                        </div>
                        <button
                          onClick={() => setLogoutConfirmOpen(true)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-100/70 active:bg-red-100 rounded-md transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Logout</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="p-4 sm:p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Total Patients</p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stats.totalPatients}</p>
                      <p className="text-xs text-green-600 mt-1">+12% from last month</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Total Doctors</p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stats.totalDoctors}</p>
                      <p className="text-xs text-green-600 mt-1">+3 new this month</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Today's Appointments</p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stats.todayAppointments}</p>
                      <p className="text-xs text-blue-600 mt-1">Active today</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">₹{stats.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-green-600 mt-1">+8% from last month</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Appointments Trend - Line Chart */}
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">Appointments Trend</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {trendView === "weekly" && "Current week's appointments by day"}
                        {trendView === "monthly" && "Current month's appointments grouped by date ranges"}
                        {trendView === "yearly" && "This year's appointments by month"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label htmlFor="trend-view" className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          View
                        </label>
                        <select
                          id="trend-view"
                          value={trendView}
                          onChange={(event) => setTrendView(event.target.value as "weekly" | "monthly" | "yearly")}
                          className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="weekly">This Week</option>
                          <option value="monthly">This Month</option>
                          <option value="yearly">This Year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="h-48 sm:h-64 relative">
                    {trendData.length > 0 && (
                      <div className="absolute right-6 top-4 bg-white/80 backdrop-blur-sm border border-blue-100 text-blue-600 rounded-md px-3 py-1 text-xs font-semibold z-10">
                        Total: {trendTotal}
                      </div>
                    )}
                    {trendData.length > 0 ? (
                      <svg className="w-full h-full" viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}>
                        {/* Grid lines */}
                        <defs>
                          <pattern id="appointmentsGrid" width="40" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#appointmentsGrid)" />
                        
                        {/* Y-axis labels */}
                        {Array.from({ length: 5 }).map((_, index) => {
                          const value = Math.round((safeTrendCount * index) / 4)
                          const y = chartSize.height - chartPadding.bottom - (innerHeight * index) / 4
                          return (
                            <text key={index} x="10" y={y} className="text-xs fill-gray-500" textAnchor="start">
                              {value}
                            </text>
                          )
                        })}
                        
                        {/* Line and points */}
                        {(() => {
                          const points = trendData.map((point, index) => {
                            const x = chartPadding.left + index * xStep
                            const y = chartSize.height - chartPadding.bottom - ((point.count / safeTrendCount) * innerHeight)
                            return `${x},${y}`
                          }).join(" ")

                          return (
                            <>
                              <polyline
                                points={points}
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {trendData.map((point, index) => {
                                const x = chartPadding.left + index * xStep
                                const y = chartSize.height - chartPadding.bottom - ((point.count / safeTrendCount) * innerHeight)
                                return (
                                  <g key={`${point.fullLabel}-${index}`}>
                                    <circle cx={x} cy={y} r="4" fill="#3b82f6" />
                                    <circle cx={x} cy={y} r="8" fill="#3b82f6" fillOpacity="0.2" />
                                    <text x={x} y={y - 15} className="text-xs fill-gray-700" textAnchor="middle">
                                      {point.count}
                                    </text>
                                    <title>{`${point.fullLabel}: ${point.count} appointments`}</title>
                                  </g>
                                )
                              })}
                            </>
                          )
                        })()}
                        
                        {/* X-axis labels */}
                        {trendData.map((point, index) => {
                          const x = chartPadding.left + index * xStep
                          return (
                            <text key={`${point.label}-${index}`} x={x} y={chartSize.height - 5} className="text-xs fill-gray-500" textAnchor="middle">
                              {point.label}
                            </text>
                          )
                        })}
                      </svg>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        No appointment data to display.
                      </div>
                    )}
                  </div>
                </div>

                {/* Common Conditions - Bar Chart */}
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Common Patient Conditions</h3>
                  <div className="h-72 sm:h-80">
                    {stats.commonConditions.length > 0 ? (() => {
                      const chartConditions = [...stats.commonConditions]

                      const sortedConditions = [...chartConditions].sort((a, b) => b.count - a.count)
                      const MAX_SLICES = 6
                      const primaryConditions = sortedConditions.slice(0, MAX_SLICES)
                      const remainingConditions = sortedConditions.slice(MAX_SLICES)

                      const displayConditions: (typeof chartConditions[number] & { isOther?: boolean; mergedConditions?: string[] })[] = [...primaryConditions]
                      if (remainingConditions.length > 0) {
                        const otherCount = remainingConditions.reduce((sum, condition) => sum + condition.count, 0)
                        if (otherCount > 0) {
                          displayConditions.push({
                            condition: "Other",
                            count: otherCount,
                            isOther: true,
                            mergedConditions: remainingConditions.map(c => c.condition)
                          })
                        }
                      }

                      const totalCount = displayConditions.reduce((sum, condition) => sum + condition.count, 0)
                      if (totalCount === 0) {
                        return (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <p className="text-sm">No condition data available</p>
                            </div>
                          </div>
                        )
                      }

                      const pieColors = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#ef4444", "#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#6b7280"]
                      const center = 110
                      const radius = 100

                      const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
                        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
                        return {
                          x: cx + r * Math.cos(angleInRadians),
                          y: cy + r * Math.sin(angleInRadians)
                        }
                      }

                      const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
                        const start = polarToCartesian(cx, cy, r, endAngle)
                        const end = polarToCartesian(cx, cy, r, startAngle)
                        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"

                        return [
                          "M", cx, cy,
                          "L", start.x, start.y,
                          "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
                          "Z"
                        ].join(" ")
                      }

                      let currentAngle = 0

                      return (
                        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-between gap-6 lg:gap-8 h-full">
                          <svg className="w-72 h-72 sm:w-80 sm:h-80" viewBox="0 0 220 220">
                            <circle cx={center} cy={center} r={radius} fill="#f1f5f9" />
                            {displayConditions.map((condition, index) => {
                              const value = condition.count
                              const sliceAngle = (value / totalCount) * 360
                              if (sliceAngle === 0) {
                                return null
                              }
                              const startAngle = currentAngle
                              const endAngle = currentAngle + sliceAngle
                              currentAngle = endAngle

                              const path = describeArc(center, center, radius, startAngle, endAngle)
                              const midAngle = startAngle + sliceAngle / 2
                              const labelPosition = polarToCartesian(center, center, radius * 0.6, midAngle)
                              const percentage = (value / totalCount) * 100

                              return (
                                <g key={condition.condition}>
                                  <path d={path} fill={pieColors[index % pieColors.length]} className="transition-transform duration-300 hover:scale-[1.02]" />
                                  <text
                                    x={labelPosition.x}
                                    y={labelPosition.y}
                                    className="text-[10px] fill-gray-800 font-semibold"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                  >
                                    {`${Math.round(percentage)}%`}
                                  </text>
                                </g>
                              )
                            })}
                          </svg>

                          <div className="w-full lg:w-56 space-y-1">
                            {displayConditions.map((condition, index) => {
                              const percentage = (condition.count / totalCount) * 100
                              return (
                                <div key={condition.condition} className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                                  />
                                  <p className="text-[11px] leading-tight text-slate-600">
                                    <span className="font-semibold text-slate-700">
                                      {condition.isOther
                                        ? `Other (${condition.mergedConditions?.length || 0} conditions)`
                                        : condition.condition.replace(/_/g, " ")}
                                    </span>{" "}
                                    {condition.count} {condition.count === 1 ? "patient" : "patients"} • {percentage.toFixed(1)}%
                                    {condition.isOther && condition.mergedConditions && condition.mergedConditions.length > 0 && (
                                      <span className="block text-[10px] text-slate-400 mt-0.5">
                                        {condition.mergedConditions.map(label => label.replace(/_/g, " ")).join(", ")}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })() : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <p className="text-sm">No condition data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Revenue Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">This Week</span>
                      <span className="font-semibold text-gray-900">₹{stats.weeklyRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">This Month</span>
                      <span className="font-semibold text-gray-900">₹{stats.monthlyRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">All Time</span>
                      <span className="font-semibold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointment Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Completed</span>
                      <span className="font-semibold text-green-600">{stats.completedAppointments}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Pending</span>
                      <span className="font-semibold text-orange-600">{stats.pendingAppointments}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="font-semibold text-gray-900">{stats.totalAppointments}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" onClick={() => {
                      setActiveTab("patients")
                      setSidebarOpen(false)
                    }}>
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium text-blue-800 text-sm sm:text-base">
                          Manage Patients 
                        </span>
                      </div>
                    </button>
                    <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors" onClick={() => {
                      setActiveTab("doctors")
                      setSidebarOpen(false)
                    }}>
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium text-green-800 text-sm sm:text-base">Manage Doctors</span>
                      </div>
                    </button>
                    <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors" onClick={() => {
                      setActiveTab("reports")
                      setSidebarOpen(false)
                    }}>
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="font-medium text-purple-800 text-sm sm:text-base">Generate Reports</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Doctor Schedule Requests (Approval) */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Doctor Leave Requests</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{pendingRequests.length} pending</span>
                </div>
                {loadingRequests ? (
                  <div className="text-sm text-gray-500">Loading requests…</div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-sm text-gray-500">No pending requests</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Doctor</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Submitted at</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Date(s)</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Reason(s)</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pendingRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm">
                              <div className="font-semibold text-gray-900">{req.doctorName || 'Unknown'}</div>
                              <div className="text-xs text-gray-500 font-mono">{req.doctorId}</div>
                            </td>
                            <td className="px-3 py-2 capitalize">{req.requestType}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{new Date(req.createdAt).toLocaleString()}</td>
                            <td className="px-3 py-2 align-top">
                              {Array.isArray(req.blockedDates) && req.blockedDates.length > 0 ? (
                                <div className="space-y-1">
                                  {req.blockedDates.map((bd: any, idx: number) => (
                                    <div key={idx} className="text-xs text-gray-800">
                                      {(bd?.date || '').toString()}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {Array.isArray(req.blockedDates) && req.blockedDates.length > 0 ? (
                                <div className="space-y-1">
                                  {req.blockedDates.map((bd: any, idx: number) => (
                                    <div key={idx} className="text-xs text-gray-800">
                                      {(bd?.reason || '').toString() || '—'}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => approveRequest(req)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => rejectRequest(req)}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs hover:bg-red-700"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Refund Requests (Approval) */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Refund Requests</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{pendingRefunds.length} pending</span>
                </div>
                {loadingRefunds ? (
                  <div className="text-sm text-gray-500">Loading refund requests…</div>
                ) : pendingRefunds.length === 0 ? (
                  <div className="text-sm text-gray-500">No pending refund requests</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Patient</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Doctor</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Amount</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Payment Method</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Requested At</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pendingRefunds.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-gray-900">{r.patientName || r.patientId}</div>
                              <div className="text-xs text-gray-500 font-mono">{r.patientId}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-gray-900">{r.doctorName || r.doctorId}</div>
                              <div className="text-xs text-gray-500 font-mono">{r.doctorId}</div>
                            </td>
                            <td className="px-3 py-2">₹{Number(r.paymentAmount || 0)}</td>
                            <td className="px-3 py-2 capitalize">{String(r.paymentMethod || '—')}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{new Date(r.createdAt).toLocaleString()}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => approveRefund(r)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700"
                                >
                                  Approve
                                </button>
                              </div>
                            </td>
                          </tr>)
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Appointments */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Appointments</h3>
                    <button
                      onClick={() => setShowRecentAppointments(!showRecentAppointments)}
                      className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <span>{showRecentAppointments ? 'Hide' : 'Show'}</span>
                      <svg 
                        className={`w-4 h-4 transition-transform duration-200 ${showRecentAppointments ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {showRecentAppointments && (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Doctor</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {recentAppointments.map((appointment) => (
                          <tr key={appointment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{appointment.patientName}</div>
                                <div className="text-sm text-gray-500">{appointment.patientEmail}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{appointment.doctorName}</div>
                                <div className="text-sm text-gray-500">{appointment.doctorSpecialization}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {new Date(appointment.appointmentDate).toLocaleDateString()}
                                </div>
                                <div className="text-sm text-gray-500">{appointment.appointmentTime}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                appointment.status === "completed" ? "bg-green-100 text-green-800" :
                                appointment.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                                (appointment as any).status === 'resrescheduled' ? "bg-purple-100 text-purple-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {(appointment as any).status === 'resrescheduled' ? 'rescheduled' : appointment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ₹{appointment.paymentAmount || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "patients" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Management</h2> */}
              <PatientManagement />
            </div>
          )}

          {activeTab === "doctors" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* <h2 className="text-xl font-semibold text-gray-900 mb-4">Doctor Management</h2> */}
              <DoctorManagement />
            </div>
          )}

          {activeTab === "campaigns" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaigns</h2> */}
              <CampaignManagement />
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* <h2 className="text-xl font-semibold text-gray-900 mb-4">Appointment Management</h2> */}
              <AppoinmentManagement />
            </div>
          )}

          {activeTab === "billing" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <BillingManagement />
            </div>
          )}

          {activeTab === "reports" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Reports & Analytics</h2>
              <p className="text-gray-600">Reports and analytics features will be implemented here.</p>
            </div>
          )}
        </main>
      </div>
      {/* Notification Toast */}
      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Sign out?"
        message="You'll be redirected to the login screen."
        confirmText="Logout"
        cancelText="Stay signed in"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
        confirmLoading={logoutLoading}
      />
      </div>
    </AdminProtected>
  )
}