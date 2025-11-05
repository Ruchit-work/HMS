"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
import { Appointment as AppointmentType } from "@/types/patient"
import PatientManagement from "./PatientManagement"
import DoctorManagement from "./DoctorManagement"
import AppoinmentManagement from "./AppoinmentManagement"
import CampaignManagement from "./CampaignManagement"
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
  appointmentsByDay: { date: string; count: number }[];
  commonConditions: { condition: string; count: number }[];
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
    appointmentsByDay: [],
    commonConditions: []
  })
  const [recentAppointments, setRecentAppointments] = useState<AppointmentType[]>([])
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "patients" | "doctors" | "campaigns" | "appointments" | "reports">("overview")
  const [showRecentAppointments, setShowRecentAppointments] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)

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
      const pendingAppointments = allAppointments.filter(apt => apt.status === "confirmed").length

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

      // Calculate appointments by day (last 7 days)
      const appointmentsByDay = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const count = allAppointments.filter(apt => 
          apt.appointmentDate === dateStr
        ).length
        appointmentsByDay.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
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
        appointmentsByDay,
        commonConditions
      })

      setRecentAppointments(recent)

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

  const handleRefresh = async () => {
    await fetchDashboardData()
    setNotification({ type: "success", message: "Dashboard data refreshed!" })
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.replace("/auth/login?role=admin")
    } catch (error) {
      console.error("Logout error:", error)
      setNotification({ 
        type: "error", 
        message: "Failed to logout. Please try again." 
      })
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
                   "Reports & Analytics"}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  {activeTab === "overview" ? "Hospital management system overview" :
                   activeTab === "patients" ? "Manage patient records and information" :
                   activeTab === "doctors" ? "Manage doctor profiles and schedules" :
                   activeTab === "campaigns" ? "Create, publish, and manage promotional campaigns" :
                   activeTab === "appointments" ? "Monitor and manage all appointments" :
                   "View detailed reports and analytics"}
                </p>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <button
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
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
                {/* Appointments by Day - Line Chart */}
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Appointments Trend (Last 7 Days)</h3>
                  <div className="h-48 sm:h-64 relative">
                    <svg className="w-full h-full" viewBox="0 0 400 200">
                      {/* Grid lines */}
                      <defs>
                        <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      
                      {/* Y-axis labels */}
                      {(() => {
                        const maxCount = Math.max(...stats.appointmentsByDay.map(d => d.count), 1)
                        const yLabels = []
                        for (let i = 0; i <= 4; i++) {
                          const value = Math.round((maxCount * i) / 4)
                          yLabels.push(
                            <text key={i} x="10" y={180 - (i * 40)} className="text-xs fill-gray-500" textAnchor="start">
                              {value}
                            </text>
                          )
                        }
                        return yLabels
                      })()}
                      
                      {/* Line chart */}
                      {stats.appointmentsByDay.length > 0 && (() => {
                        const maxCount = Math.max(...stats.appointmentsByDay.map(d => d.count), 1)
                        const points = stats.appointmentsByDay.map((day, index) => {
                          const x = 60 + (index * 50)
                          const y = 180 - ((day.count / maxCount) * 160)
                          return `${x},${y}`
                        }).join(' ')
                        
                        return (
                          <>
                            {/* Line */}
                            <polyline
                              points={points}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {/* Data points */}
                            {stats.appointmentsByDay.map((day, index) => {
                              const x = 60 + (index * 50)
                              const y = 180 - ((day.count / maxCount) * 160)
                              return (
                                <g key={index}>
                                  <circle cx={x} cy={y} r="4" fill="#3b82f6" />
                                  <circle cx={x} cy={y} r="8" fill="#3b82f6" fillOpacity="0.2" />
                                  {/* Tooltip */}
                                  <text x={x} y={y - 15} className="text-xs fill-gray-700" textAnchor="middle">
                                    {day.count}
                                  </text>
                                </g>
                              )
                            })}
                          </>
                        )
                      })()}
                      
                      {/* X-axis labels */}
                      {stats.appointmentsByDay.map((day, index) => (
                        <text key={index} x={60 + (index * 50)} y="195" className="text-xs fill-gray-500" textAnchor="middle">
                          {day.date.split(' ')[0]}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Common Conditions - Bar Chart */}
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Common Patient Conditions</h3>
                  <div className="h-48 sm:h-64 relative">
                    {stats.commonConditions.length > 0 ? (
                      <svg className="w-full h-full" viewBox="0 0 400 200">
                        {/* Grid lines */}
                        <defs>
                          <pattern id="barGrid" width="40" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f3f4f4" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#barGrid)" />
                        
                        {/* Y-axis labels */}
                        {(() => {
                          const maxCount = Math.max(...stats.commonConditions.map(c => c.count), 1)
                          const yLabels = []
                          for (let i = 0; i <= 4; i++) {
                            const value = Math.round((maxCount * i) / 4)
                            yLabels.push(
                              <text key={i} x="10" y={180 - (i * 40)} className="text-xs fill-gray-500" textAnchor="start">
                                {value}
                              </text>
                            )
                          }
                          return yLabels
                        })()}
                        
                        {/* Bars */}
                        {stats.commonConditions.map((condition, index) => {
                          const maxCount = Math.max(...stats.commonConditions.map(c => c.count), 1)
                          const barHeight = (condition.count / maxCount) * 160
                          const barWidth = 30
                          const x = 50 + (index * 45)
                          const y = 180 - barHeight
                          
                          return (
                            <g key={index}>
                              {/* Bar */}
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                fill="#10b981"
                                rx="2"
                                className="transition-all duration-500 ease-out"
                              />
                              {/* Bar value */}
                              <text x={x + barWidth/2} y={y - 5} className="text-xs fill-gray-700" textAnchor="middle">
                                {condition.count}
                              </text>
                              {/* X-axis label */}
                              <text x={x + barWidth/2} y="195" className="text-xs fill-gray-500" textAnchor="middle">
                                {condition.condition.length > 8 ? condition.condition.substring(0, 8) + '...' : condition.condition}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    ) : (
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
                                "bg-red-100 text-red-800"
                              }`}>
                                {appointment.status}
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Management</h2>
              <PatientManagement />
            </div>
          )}

          {activeTab === "doctors" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Doctor Management</h2>
              <DoctorManagement />
            </div>
          )}

          {activeTab === "campaigns" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaigns</h2>
              <CampaignManagement />
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Appointment Management</h2>
              <AppoinmentManagement />
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
      </div>
    </AdminProtected>
  )
}