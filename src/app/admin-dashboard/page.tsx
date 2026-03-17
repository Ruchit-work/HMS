"use client"

import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, onSnapshot } from "firebase/firestore"
import { signOut } from "firebase/auth"
import NotificationBadge from "@/components/ui/feedback/NotificationBadge"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"
import { useNotificationBadge } from "@/hooks/useNotificationBadge"
import Notification from "@/components/ui/feedback/Notification"
import { Appointment as AppointmentType } from "@/types/patient"
import { Branch } from "@/types/branch"
import PatientManagement from "./Tabs/PatientManagement"
import PatientAnalytics from "./Tabs/PatientAnalytics"
import DoctorManagement from "./Tabs/DoctorManagement"
import AppoinmentManagement from "./Tabs/AppoinmentManagement"
import CampaignManagement from "./Tabs/CampaignManagement"
import BillingManagement from "./Tabs/BillingManagement"
import FinancialAnalytics from "./Tabs/FinancialAnalytics"
import HospitalManagement from "./Tabs/HospitalManagement"
import AdminAssignment from "./Tabs/AdminAssignment"
import ReceptionistManagement from "./Tabs/ReceptionistManagement"
import PharmacistManagement from "./Tabs/PharmacistManagement"
import DoctorPerformanceAnalytics from "./Tabs/DoctorPerformanceAnalytics"
import ReceptionistPerformanceAnalytics from "./Tabs/ReceptionistPerformanceAnalytics"
import BranchManagement from "./Tabs/BranchManagement"
import PharmacyManagement from "./Tabs/PharmacyManagement"
import { PharmacyPortalProvider } from "@/contexts/PharmacyPortalContext"
import AdminProtected from "@/components/AdminProtected"
import AdminDashboardOverview from "./components/AdminDashboardOverview"
import TabButton from "@/components/admin/TabButton"
import AdminPageHeader from "@/components/admin/AdminPageHeader"
import SubTabNavigation from "@/components/admin/SubTabNavigation"
import {
  calculateAllTrends,
  calculateRevenue,
  calculateCommonConditions,
  calculateMostPrescribedMedicines,
  calculateRevenueTrend,
  calculateTopDepartments
} from "@/utils/analytics/dashboardCalculations"
import type { TrendPoint } from "@/utils/analytics/dashboardCalculations"
import type { RevenueTrendPoint } from "@/utils/analytics/dashboardCalculations"

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
  todayRevenue: number;
  completedAppointments: number;
  pendingAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  activeDoctorsToday: number;
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
  mostPrescribedMedicines: Array<{
    medicineName: string;
    prescriptionCount: number;
    percentage: number;
  }>;
  revenueTrend: {
    weekly: RevenueTrendPoint[];
    monthly: RevenueTrendPoint[];
    yearly: RevenueTrendPoint[];
  };
  topDepartments: Array<{ department: string; count: number }>;
}

export default function AdminDashboard() {
  const [userData, setUserData] = useState<UserData | null>(null)
  // Store raw data (unfiltered) for client-side filtering
  const [rawPatients, setRawPatients] = useState<any[]>([])
  const [rawAppointments, setRawAppointments] = useState<AppointmentType[]>([])
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
    todayRevenue: 0,
    activeDoctorsToday: 0,
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
    commonConditions: [],
    mostPrescribedMedicines: [],
    revenueTrend: { weekly: [], monthly: [], yearly: [] },
    topDepartments: []
  })
  const [recentAppointments, setRecentAppointments] = useState<AppointmentType[]>([])
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState<"overview" | "patients" | "doctors" | "campaigns" | "appointments" | "billing" | "analytics" | "hospitals" | "admins" | "branches" | "staff">("overview")
  const [patientSubTab, setPatientSubTab] = useState<"all" | "analytics">("all")
  const [billingSubTab, setBillingSubTab] = useState<"all" | "analytics">("all")
  const [analyticsSubTab, setAnalyticsSubTab] = useState<"overview" | "patients" | "financial" | "doctors" | "receptionists">("overview")
  const [staffSubTab, setStaffSubTab] = useState<"receptionists" | "pharmacists">("receptionists")
  const [showRecentAppointments, setShowRecentAppointments] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [processingRefundId, setProcessingRefundId] = useState<string | null>(null)
  const [pendingRefunds, setPendingRefunds] = useState<any[]>([])
  const [newAppointmentsCount, setNewAppointmentsCount] = useState(0)
  const [newPatientsCount, setNewPatientsCount] = useState(0)
  const [pendingBillingCount, setPendingBillingCount] = useState(0)
  const [trendView, setTrendView] = useState<"weekly" | "monthly" | "yearly">("weekly")
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")

  // Notification badge hooks - automatically clear when panels are viewed
  const overviewBadge = useNotificationBadge({ 
    badgeKey: 'admin-overview', 
    rawCount: pendingRefunds.length, 
    activeTab 
  })
  const patientsBadge = useNotificationBadge({ 
    badgeKey: 'admin-patients', 
    rawCount: newPatientsCount, 
    activeTab 
  })
  const appointmentsBadge = useNotificationBadge({ 
    badgeKey: 'admin-appointments', 
    rawCount: newAppointmentsCount, 
    activeTab 
  })
  const billingBadge = useNotificationBadge({ 
    badgeKey: 'admin-billing', 
    rawCount: pendingBillingCount, 
    activeTab 
  })

  // Trend data will be calculated after displayStats is defined

  // Protect route - allow admins only (pharmacy users are redirected to /pharmacy)
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, activeHospital, loading: hospitalLoading, userHospitals, isSuperAdmin, hasMultipleHospitals, setActiveHospital } = useMultiHospital()
  const analyticsEnabled = (activeHospital as any)?.enableAnalytics === true
  const router = useRouter()

  // Sync activeTab with URL (limited set)
  useEffect(() => {
    if (!tabFromUrl) return
    if (["overview","patients","doctors","campaigns","appointments","billing","analytics","hospitals","admins","branches","staff"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl as any)
    } else if (tabFromUrl === "receptionists" || tabFromUrl === "pharmacists") {
      setActiveTab("staff")
      setStaffSubTab(tabFromUrl)
    }
  }, [tabFromUrl, setStaffSubTab])

  // If there is no authenticated user (e.g. after logout + browser back),
  // immediately redirect to the admin login page and render nothing here.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login?role=admin")
    }
  }, [authLoading, user, router])

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      if (!activeHospitalId) return
      
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {

          return
        }

        const token = await currentUser.getIdToken()
        if (!token) {

          return
        }

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        
        if (data.success && data.branches) {
          setBranches(data.branches.map((b: Branch) => ({ id: b.id, name: b.name })))
        } else {

        }
      } catch {

      }
    }

    fetchBranches()
  }, [activeHospitalId])

  // Reset analytics sub-tabs and tab when analytics is disabled for hospital
  useEffect(() => {
    if (!analyticsEnabled) {
      if (patientSubTab === "analytics") setPatientSubTab("all")
      if (billingSubTab === "analytics") setBillingSubTab("all")
      if (activeTab === "analytics") setActiveTab("overview")
    }
  }, [analyticsEnabled])

  const fetchDashboardData = async () => {
    if (!user || !activeHospitalId) return

    try {
      setLoading(true)

      // Get admin or pharmacy user data
      const adminDoc = await getDoc(doc(db, "admins", user.uid))
      if (adminDoc.exists()) {
        const data = adminDoc.data() as UserData
        setUserData(data)
      } else if (user.role === "pharmacy" && user.data) {
        const d = user.data as Record<string, unknown>
        setUserData({
          id: user.uid,
          name: [d.firstName, d.lastName].filter(Boolean).join(" ") || (user.email ?? ""),
          firstName: d.firstName as string | undefined,
          email: (user.email ?? d.email as string) || "",
          role: "pharmacy",
        })
      }

      // Get all patients count - use hospital-scoped collection
      const patientsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, "patients"))
      const allPatients = patientsSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      })) as any[]
      
      // Store raw data for client-side filtering
      setRawPatients(allPatients)

      // Get all doctors count - use hospital-scoped collection
      const doctorsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, "doctors"))
      const totalDoctors = doctorsSnapshot.size

      // Get all appointments - use hospital-scoped collection
      const appointmentsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, "appointments"))
      const allAppointments = appointmentsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AppointmentType))
      
      // Store raw data for client-side filtering
      setRawAppointments(allAppointments)

      // Calculate basic stats for initialization (filtered stats calculated in useMemo)
      const totalPatients = allPatients.length
      const totalAppointments = allAppointments.length
      const completedAppointments = allAppointments.filter(apt => apt.status === "completed").length
      const pendingAppointments = allAppointments.filter(apt => apt.status === "confirmed" || (apt as any).status === 'resrescheduled').length

      // Today's appointments
      const today = new Date().toDateString()
      const todayAppointments = allAppointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
      ).length

      // Calculate revenue using utility functions
      const totalRevenue = calculateRevenue(allAppointments, Infinity)
      const monthlyRevenue = calculateRevenue(allAppointments, 30)
      const weeklyRevenue = calculateRevenue(allAppointments, 7)

      // Get recent appointments (last 5) - use hospital-scoped collection
      const recentAppointmentsQuery = query(
        getHospitalCollection(activeHospitalId, "appointments"),
        orderBy("createdAt", "desc"),
        limit(5)
      )
      const recentSnapshot = await getDocs(recentAppointmentsQuery)
      const recent = recentSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AppointmentType))

      // Calculate trends and analytics using utility functions
      const trends = calculateAllTrends(allAppointments)
      const commonConditions = calculateCommonConditions(allAppointments)
      const mostPrescribedMedicines = calculateMostPrescribedMedicines(allAppointments)
      const revenueTrend = calculateRevenueTrend(allAppointments)
      const topDepartments = calculateTopDepartments(allAppointments)

      const todayDateStr = new Date().toDateString();
      const todayRevenue = allAppointments
        .filter((a) => a.status === 'completed' && new Date(a.appointmentDate).toDateString() === todayDateStr)
        .reduce((s, a) => s + (a.paymentAmount || 0), 0);
      const activeDoctorsToday = new Set(
        allAppointments
          .filter((a) => new Date(a.appointmentDate).toDateString() === todayDateStr && a.doctorId)
          .map((a) => a.doctorId)
      ).size;

      setStats({
        totalPatients,
        totalDoctors,
        totalAppointments,
        todayAppointments,
        todayRevenue,
        completedAppointments,
        pendingAppointments,
        totalRevenue,
        monthlyRevenue,
        weeklyRevenue,
        activeDoctorsToday,
        appointmentTrends: trends,
        appointmentTotals: trends.totals,
        commonConditions,
        mostPrescribedMedicines,
        revenueTrend,
        topDepartments
      })

      setRecentAppointments(recent)

    } catch {

      setNotification({ 
        type: "error", 
        message: "Failed to load dashboard data" 
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && activeHospitalId && !hospitalLoading) {
      fetchDashboardData()
      const cleanup = setupRealtimeBadgeListeners()
      return () => {
        if (cleanup) cleanup()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeHospitalId, hospitalLoading])
  // Note: selectedBranchId removed - filtering happens client-side via useMemo below

  // Filter data and recalculate stats based on selectedBranchId
  const filteredStats = useMemo(() => {
    // Filter patients by branch
    let filteredPatients = rawPatients
    if (selectedBranchId !== "all") {
      filteredPatients = rawPatients.filter((p: any) => p.defaultBranchId === selectedBranchId)
    }

    // Filter appointments by branch
    let filteredAppointments = rawAppointments
    if (selectedBranchId !== "all") {
      filteredAppointments = rawAppointments.filter((apt) => apt.branchId === selectedBranchId)
    }

    // Recalculate all stats from filtered data
    const totalPatients = filteredPatients.length
    const totalAppointments = filteredAppointments.length
    const completedAppointments = filteredAppointments.filter(apt => apt.status === "completed").length
    const pendingAppointments = filteredAppointments.filter(apt => apt.status === "confirmed" || (apt as any).status === 'resrescheduled').length

    // Today's appointments
    const today = new Date().toDateString()
    const todayAppointments = filteredAppointments.filter(apt => 
      new Date(apt.appointmentDate).toDateString() === today
    ).length

    // Calculate revenue and trends using utility functions
    const totalRevenue = calculateRevenue(filteredAppointments, Infinity)
    const monthlyRevenue = calculateRevenue(filteredAppointments, 30)
    const weeklyRevenue = calculateRevenue(filteredAppointments, 7)
    const todayDateStr = new Date().toDateString()
    const todayRevenue = filteredAppointments
      .filter((a) => a.status === 'completed' && new Date(a.appointmentDate).toDateString() === todayDateStr)
      .reduce((s, a) => s + (a.paymentAmount || 0), 0)
    const activeDoctorsToday = new Set(
      filteredAppointments
        .filter((a) => new Date(a.appointmentDate).toDateString() === todayDateStr && a.doctorId)
        .map((a) => a.doctorId)
    ).size
    const trends = calculateAllTrends(filteredAppointments)
    const commonConditions = calculateCommonConditions(filteredAppointments)
    const mostPrescribedMedicines = calculateMostPrescribedMedicines(filteredAppointments)
    const revenueTrend = calculateRevenueTrend(filteredAppointments)
    const topDepartments = calculateTopDepartments(filteredAppointments)

    return {
      totalPatients,
      totalDoctors: stats.totalDoctors,
      totalAppointments,
      todayAppointments,
      todayRevenue,
      completedAppointments,
      pendingAppointments,
      totalRevenue,
      monthlyRevenue,
      weeklyRevenue,
      activeDoctorsToday,
      appointmentTrends: trends,
      appointmentTotals: trends.totals,
      commonConditions,
      mostPrescribedMedicines,
      revenueTrend,
      topDepartments
    }
  }, [rawPatients, rawAppointments, selectedBranchId, stats.totalDoctors])

  // Use filtered stats for display
  const displayStats = filteredStats

  // Filter recent appointments by branch
  const filteredRecentAppointments = useMemo(() => {
    if (selectedBranchId === "all") {
      return recentAppointments
    }
    return recentAppointments.filter((apt) => apt.branchId === selectedBranchId)
  }, [recentAppointments, selectedBranchId])

  // Filter all appointments by branch (for overview analytics)
  const filteredAppointmentsForOverview = useMemo(() => {
    if (selectedBranchId === "all") return rawAppointments
    return rawAppointments.filter((apt) => apt.branchId === selectedBranchId)
  }, [rawAppointments, selectedBranchId])

  // Setup real-time listeners for badge counts
  const setupRealtimeBadgeListeners = () => {
    if (!activeHospitalId) return () => {}

    // Listen for new appointments (today's appointments)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const appointmentsQuery = query(
      getHospitalCollection(activeHospitalId, "appointments"),
      where("appointmentDate", ">=", todayStart.toISOString().split('T')[0]),
      where("appointmentDate", "<", todayEnd.toISOString().split('T')[0])
    )

    const unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
      const todayAppointments = snapshot.docs.filter(doc => {
        const data = doc.data()
        return data.status === "confirmed" || data.status === "whatsapp_pending"
      })
      setNewAppointmentsCount(todayAppointments.length)
    })

    // Listen for new patients (created in last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const patientsQuery = query(
      getHospitalCollection(activeHospitalId, "patients"),
      where("createdAt", ">=", sevenDaysAgo)
    )

    const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
      setNewPatientsCount(snapshot.size)
    })

    // Listen for pending billing (unpaid appointments)
    const billingQuery = query(
      getHospitalCollection(activeHospitalId, "appointments"),
      where("status", "==", "completed"),
      where("paymentStatus", "in", ["pending", "unpaid"])
    )

    const unsubscribeBilling = onSnapshot(billingQuery, (snapshot) => {
      setPendingBillingCount(snapshot.size)
    })

    // Return cleanup function
    return () => {
      unsubscribeAppointments()
      unsubscribePatients()
      unsubscribeBilling()
    }
  }

  // Real-time listener for refund requests
  useEffect(() => {
    if (!user) return

    const refundQuery = query(
      collection(db, 'refund_requests'),
      where('status', '==', 'pending'),
      limit(50)
    )
    
    const unsubscribeRefunds = onSnapshot(refundQuery, async (snapshot) => {
      const refunds = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      
      // Enrich with patient and doctor names
      const refundsEnriched = await Promise.all(refunds.map(async (r) => {
        let patientName = r.patientId
        let doctorName = r.doctorId
        try {
          const p = await getDoc(doc(db, 'patients', String(r.patientId)))
          if (p.exists()) {
            const pd = p.data() as any
            patientName = `${String(pd?.firstName ?? '')} ${String(pd?.lastName ?? '')}`.trim() || String(r.patientId)
          }
        } catch {}
        try {
          const dref = await getDoc(doc(db, 'doctors', String(r.doctorId)))
          if (dref.exists()) {
            const dd = dref.data() as any
            doctorName = `${String(dd?.firstName ?? '')} ${String(dd?.lastName ?? '')}`.trim() || String(r.doctorId)
          }
        } catch {}
        return { ...r, patientName, doctorName }
      }))
      
      setPendingRefunds(refundsEnriched)
    }, () => {

    })

    // Cleanup function
    return () => {
      unsubscribeRefunds()
    }
  }, [user])

  // Redirect super admins away from campaigns tab
  useEffect(() => {
    if (isSuperAdmin && activeTab === "campaigns") {
      setActiveTab("overview")
    }
  }, [isSuperAdmin, activeTab])

  const approveRefund = async (refund: any) => {
    setProcessingRefundId(refund.id)
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
    } finally {
      setProcessingRefundId(null)
    }
  }

  const handleLogout = async () => {
    try {
      setLogoutLoading(true)
      await signOut(auth)
      // Clear any cached data
      localStorage.clear()
      sessionStorage.clear()
      // Force redirect after sign out
      window.location.href = "/auth/login?role=admin"
    } catch {

      setNotification({ 
        type: "error", 
        message: "Failed to logout. Please try again." 
      })
      setLogoutLoading(false)
      setLogoutConfirmOpen(false)
    }
  }

  // While redirecting away for unauthenticated users, render nothing.
  if (!user) {
    return null
  }

  // When authenticated but data is still loading, show a neutral loading state.
  if (authLoading || hospitalLoading || loading || !userData) {
    return <LoadingSpinner message="Loading..." />
  }

  return (
    <AdminProtected allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile Menu Button - Only show when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white/95 backdrop-blur-xl p-2.5 rounded-lg shadow-lg border border-slate-200/50 hover:shadow-xl hover:bg-white transition-all duration-200"
        >
          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {sidebarOpen && (<div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />)}

      {/* Professional Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-slate-200/50 transform transition-all duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col`}>
        {/* Header */}
        <div className="relative h-20 px-6 bg-sky-100/90 bg-[radial-gradient(ellipse_90%_70%_at_70%_20%,rgba(14,165,233,0.25),transparent)] flex items-center justify-between overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 pointer-events-none" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/40 rounded-full"></div>
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/30 rounded-full"></div>
          
          <div className="relative flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-sky-200 shadow-sm">
              <svg className="w-6 h-6 text-sky-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-slate-900 text-lg font-bold drop-shadow-sm">HMS Admin</h1>
              <p className="text-slate-600 text-xs font-medium">Administrative Portal</p>
            </div>
          </div>
          
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 flex flex-col mt-4 px-3">
          <div className="flex-1 space-y-1">
            <TabButton
              id="overview"
              activeTab={activeTab}
              onClick={() => { setActiveTab("overview"); setSidebarOpen(false) }}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                </svg>
              }
              label="Dashboard Overview"
              badgeCount={overviewBadge.displayCount}
            />
            
            <TabButton
              id="patients"
              activeTab={activeTab}
              onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              label="Patients"
              badgeCount={patientsBadge.displayCount}
              badgeProps={{ size: "sm", color: "blue", animate: true }}
            />
            
            <TabButton
              id="doctors"
              activeTab={activeTab}
              onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="Doctors"
            />

            {!isSuperAdmin && (
              <TabButton
                id="campaigns"
                activeTab={activeTab}
                onClick={() => { setActiveTab("campaigns"); setSidebarOpen(false) }}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 20l4-2a4 4 0 014 0l4 2 4-2a4 4 0 014 0l0 0" />
                  </svg>
                }
                label="Campaigns"
              />
            )}

            <TabButton
              id="appointments"
              activeTab={activeTab}
              onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              label="Appointments"
              badgeCount={appointmentsBadge.displayCount}
              badgeProps={{ size: "sm", color: "orange", animate: true }}
            />
            
            <TabButton
              id="billing"
              activeTab={activeTab}
              onClick={() => { setActiveTab("billing"); setSidebarOpen(false) }}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              label="Revenue & Analytics"
              badgeCount={billingBadge.displayCount}
              badgeProps={{ size: "sm", color: "red", animate: true }}
            />

            {analyticsEnabled && (
              <TabButton
                id="analytics"
                activeTab={activeTab}
                onClick={() => { setActiveTab("analytics"); setSidebarOpen(false) }}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                label="Analytics Hub"
              />
            )}

            {isSuperAdmin && (
              <>
                <div className="border-t border-slate-300/30 my-2"></div>
                <div className="px-3 py-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Super Admin</p>
                </div>
                <TabButton
                  id="hospitals"
                  activeTab={activeTab}
                  onClick={() => { setActiveTab("hospitals"); setSidebarOpen(false) }}
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  }
                  label="Hospitals"
                />
                <TabButton
                  id="admins"
                  activeTab={activeTab}
                  onClick={() => { setActiveTab("admins"); setSidebarOpen(false) }}
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  }
                  label="Admin Assignment"
                />
              </>
            )}

            {/* Management section: Branches & Staff (hospital admins only for Staff) */}
            <div className="border-t border-slate-300/30 my-2"></div>
            <div className="px-3 py-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Management</p>
            </div>
            {/* Pharmacy tab removed from admin sidebar; pharmacy users use dedicated /pharmacy portal */}
            {!isSuperAdmin && (activeHospital as any)?.multipleBranchesEnabled !== false && (
              <TabButton
                id="branches"
                activeTab={activeTab}
                onClick={() => { setActiveTab("branches"); setSidebarOpen(false) }}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h6a2 2 0 012 2v10H5a2 2 0 01-2-2V7zm12 0h4a2 2 0 012 2v10h-6V9a2 2 0 012-2z" />
                  </svg>
                }
                label="Branches"
              />
            )}
            {!isSuperAdmin && (
              <TabButton
                id="staff"
                activeTab={activeTab}
                onClick={() => { setActiveTab("staff"); setStaffSubTab("receptionists"); setSidebarOpen(false) }}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                label="Staff"
              />
            )}
            
          </div>

          {/* Logout Section - Fixed at Bottom */}
          <div className="px-3 pb-3 mt-2">
            <div className="border-t border-slate-200 pt-2">
              {/* User Info */}
              <div className="flex items-center gap-2 px-1 py-1 mb-2">
                <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-xs">
                    {userData.firstName?.charAt(0) || userData.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{userData.firstName || "Admin"}</p>
                  <p className="text-xs text-slate-500">Administrator</p>
                </div>
              </div>
              
              {/* Logout Button */}
              <button 
                onClick={() => setLogoutConfirmOpen(true)}
                className="btn-modern btn-modern-danger btn-modern-sm w-full flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>

      </div>

      {/* Main Content */}
      <div className="lg:ml-72">
        {/* Standard Admin Page Header */}
        <header className={`px-4 sm:px-6 lg:px-6 pt-4 pb-0 ${!sidebarOpen ? 'pl-16 sm:pl-20 lg:pl-6' : ''}`}>
          <AdminPageHeader
            title={
              activeTab === "overview" ? "Dashboard Overview" :
              activeTab === "patients" ? "Patient Management" :
              activeTab === "doctors" ? "Doctor Management" :
              activeTab === "campaigns" ? "Campaigns" :
              activeTab === "appointments" ? "Appointment Management" :
              activeTab === "billing" ? "Revenue & Analytics" :
              activeTab === "analytics" ? "Analytics Hub" :
              activeTab === "hospitals" ? "Hospital Management" :
              activeTab === "admins" ? "Admin Assignment" :
              activeTab === "branches" ? "Branch Management" :
              activeTab === "staff" ? "Staff Management" :
              "Dashboard"
            }
            description={
              activeTab === "overview" ? "Hospital management system overview" :
              activeTab === "patients" ? "Manage patient records and information" :
              activeTab === "doctors" ? "Manage doctor profiles and schedules" :
              activeTab === "campaigns" ? "Create, publish, and manage promotional campaigns" :
              activeTab === "appointments" ? "Monitor and manage all appointments" :
              activeTab === "billing" ? "Comprehensive revenue analytics, billing records, and financial insights" :
              activeTab === "analytics" ? "Unified analytics dashboard – patient, financial, and doctor performance insights" :
              activeTab === "hospitals" ? "Create and manage hospitals in the system" :
              activeTab === "admins" ? "Create and assign admins to hospitals" :
              activeTab === "branches" ? "Create and manage branches for your hospital" :
              activeTab === "staff" ? "Create and manage receptionists & pharmacists for your hospital" :
              "Administrative dashboard"
            }
            controls={
              <>
                {isSuperAdmin && hasMultipleHospitals && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Hospital</label>
                    <select
                      value={activeHospitalId || ""}
                      onChange={async (e) => {
                        const hospitalId = e.target.value
                        if (hospitalId) {
                          try {
                            await setActiveHospital(hospitalId)
                            setNotification({ type: "success", message: "Hospital switched successfully" })
                          } catch (err: any) {
                            setNotification({ type: "error", message: err?.message || "Failed to switch hospital" })
                          }
                        }
                      }}
                      className="h-10 px-3 border border-slate-300 rounded-lg bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                    >
                      {userHospitals.map((hospital) => (
                        <option key={hospital.id} value={hospital.id}>
                          {hospital.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {branches.length > 0 && (activeHospital as any)?.multipleBranchesEnabled !== false && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Branch</label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="h-10 px-3 border border-slate-300 rounded-lg bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                    >
                      <option value="all">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(activeHospital as any)?.enablePharmacy && (
                  <Link
                    href="/pharmacy"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 h-10 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>Open Pharmacy Portal</span>
                  </Link>
                )}
              </>
            }
          />
        </header>

        {/* Content Area */}
        <main className="p-6">
          {activeTab === "overview" && (
            <AdminDashboardOverview
              displayStats={displayStats}
              trendView={trendView}
              setTrendView={setTrendView}
              filteredAppointments={filteredAppointmentsForOverview}
              branches={branches}
              selectedBranchId={selectedBranchId}
              filteredRecentAppointments={filteredRecentAppointments}
              showRecentAppointments={showRecentAppointments}
              setShowRecentAppointments={setShowRecentAppointments}
              pendingRefunds={pendingRefunds}
              onApproveRefund={approveRefund}
              processingRefundId={processingRefundId}
              setActiveTab={setActiveTab}
              setSidebarOpen={setSidebarOpen}
              overviewBadge={overviewBadge}
            />
          )}
          {activeTab === "branches" && !isSuperAdmin && (
            (activeHospital as any)?.multipleBranchesEnabled !== false ? (
              <BranchManagement />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                <p className="text-slate-600">This hospital has single-branch mode. Contact Super Admin to enable multiple branches.</p>
              </div>
            )
          )}

          {activeTab === "patients" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl">
              <SubTabNavigation
                tabs={[
                  { id: "all", label: "All Patients" },
                  ...(analyticsEnabled ? [{ id: "analytics" as const, label: "Analytics & Insights" }] : [])
                ]}
                activeTab={patientSubTab}
                onTabChange={setPatientSubTab}
              />
              <div className="p-6">
                {patientSubTab === "all" && <PatientManagement selectedBranchId={selectedBranchId} />}
                {patientSubTab === "analytics" && analyticsEnabled && <PatientAnalytics selectedBranchId={selectedBranchId} />}
              </div>
            </div>
          )}

          {activeTab === "doctors" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl p-6">
              <DoctorManagement selectedBranchId={selectedBranchId} />
            </div>
          )}

          {activeTab === "campaigns" && !isSuperAdmin && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl p-6">
              <CampaignManagement />
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl p-6">
              <AppoinmentManagement selectedBranchId={selectedBranchId} />
            </div>
          )}

          {activeTab === "billing" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl">
              <SubTabNavigation
                tabs={[
                  { id: "all", label: "All Records" },
                  ...(analyticsEnabled ? [{ id: "analytics" as const, label: "Financial Analytics" }] : [])
                ]}
                activeTab={billingSubTab}
                onTabChange={setBillingSubTab}
              />
              <div className="p-6">
                {billingSubTab === "all" && <BillingManagement selectedBranchId={selectedBranchId} />}
                {billingSubTab === "analytics" && analyticsEnabled && <FinancialAnalytics selectedBranchId={selectedBranchId} />}
              </div>
            </div>
          )}

          {activeTab === "staff" && !isSuperAdmin && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl">
              <SubTabNavigation
                tabs={[
                  { id: "receptionists", label: "Receptionists" },
                  { id: "pharmacists", label: "Pharmacists" },
                ]}
                activeTab={staffSubTab}
                onTabChange={setStaffSubTab}
              />
              <div className="p-6">
                {staffSubTab === "receptionists" && (
                  <ReceptionistManagement selectedBranchId={selectedBranchId} />
                )}
                {staffSubTab === "pharmacists" && (
                  <PharmacistManagement selectedBranchId={selectedBranchId} />
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl">
              <SubTabNavigation
                tabs={[
                  { id: "overview", label: "Overview" },
                  { id: "patients", label: "Patient Analytics" },
                  { id: "financial", label: "Financial Analytics" },
                  { id: "doctors", label: "Doctor Performance" },
                  { id: "receptionists", label: "Staff Performance" }
                ]}
                activeTab={analyticsSubTab}
                onTabChange={setAnalyticsSubTab}
              />
              <div className="p-6">
                {analyticsSubTab === "overview" && (
                  <div className="space-y-6">
                    {/* Quick Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">Patient Analytics</span>
                          <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">Demographics, trends, seasonal diseases, area distribution</p>
                        <button
                          onClick={() => setAnalyticsSubTab("patients")}
                          className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                        >
                          View Details →
                        </button>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-green-700">Financial Analytics</span>
                          <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-green-600 mt-2">Revenue prediction, seasonal changes, anomalies</p>
                        <button
                          onClick={() => setAnalyticsSubTab("financial")}
                          className="mt-4 text-xs font-semibold text-green-600 hover:text-green-700 underline"
                        >
                          View Details →
                        </button>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-700">Doctor Performance</span>
                          <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">Patient count, revenue, consultation time, peak hours</p>
                        <button
                          onClick={() => setAnalyticsSubTab("doctors")}
                          className="mt-4 text-xs font-semibold text-purple-600 hover:text-purple-700 underline"
                        >
                          View Details →
                        </button>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-orange-700">Staff Performance</span>
                          <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                            <span className="text-xl">👥</span>
                          </div>
                        </div>
                        <p className="text-xs text-orange-600 mt-2">Patients added, appointments booked, booking ratio, leaderboard</p>
                        <button
                          onClick={() => setAnalyticsSubTab("receptionists")}
                          className="mt-4 text-xs font-semibold text-orange-600 hover:text-orange-700 underline"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Navigation</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                          onClick={() => setAnalyticsSubTab("patients")}
                          className="text-left p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">👥</span>
                            <span className="font-semibold text-blue-800">Patient Analytics</span>
                          </div>
                          <p className="text-xs text-blue-600">View patient demographics, trends, and insights</p>
                        </button>

                        <button
                          onClick={() => setAnalyticsSubTab("financial")}
                          className="text-left p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">💰</span>
                            <span className="font-semibold text-green-800">Financial Analytics</span>
                          </div>
                          <p className="text-xs text-green-600">Revenue predictions and financial insights</p>
                        </button>

                        <button
                          onClick={() => setAnalyticsSubTab("doctors")}
                          className="text-left p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">👨‍⚕️</span>
                            <span className="font-semibold text-purple-800">Doctor Performance</span>
                          </div>
                          <p className="text-xs text-purple-600">Doctor metrics and performance analytics</p>
                        </button>

                        <button
                          onClick={() => setAnalyticsSubTab("receptionists")}
                          className="text-left p-4 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">👥</span>
                            <span className="font-semibold text-orange-800">Staff Performance</span>
                          </div>
                          <p className="text-xs text-orange-600">Receptionist metrics and booking analytics</p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {analyticsSubTab === "patients" && <PatientAnalytics selectedBranchId={selectedBranchId} />}
                {analyticsSubTab === "financial" && <FinancialAnalytics selectedBranchId={selectedBranchId} />}
                {analyticsSubTab === "doctors" && <DoctorPerformanceAnalytics selectedBranchId={selectedBranchId} />}
                {analyticsSubTab === "receptionists" && <ReceptionistPerformanceAnalytics selectedBranchId={selectedBranchId} />}
              </div>
            </div>
          )}

          {activeTab === "hospitals" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl p-6">
              <HospitalManagement />
            </div>
          )}

          {activeTab === "admins" && (
            <div className="bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl p-6">
              <AdminAssignment />
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