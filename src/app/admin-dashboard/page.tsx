"use client"
import { fetchBranches } from "@/services/BranchService"

import { useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, onSnapshot } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { ConfirmDialog } from '@/shared/components'
import { useNotificationBadge } from "@/hooks/useNotificationBadge"
import { Notification } from '@/shared/components'
import { Appointment as AppointmentType } from "@/types/patient"
import { Branch } from "@/types/branch"
import { TabSkeleton } from '@/shared/components'
import AdminProtected from "@/features/auth/AdminProtected"
import AdminOverviewSkeleton from "@/features/admin/components/AdminOverviewSkeleton"

const PatientManagement = dynamic(() => import("@/features/admin/tabs/PatientManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const PatientAnalytics = dynamic(() => import("@/features/admin/tabs/PatientAnalytics"), {
  loading: () => <TabSkeleton variant="table" />,
})
const DoctorManagement = dynamic(() => import("@/features/admin/tabs/DoctorManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const AppoinmentManagement = dynamic(() => import("@/features/admin/tabs/AppoinmentManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const CampaignManagement = dynamic(() => import("@/features/admin/tabs/CampaignManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const BillingManagement = dynamic(() => import("@/features/admin/tabs/BillingManagement"), {
  loading: () => <TabSkeleton variant="billing" />,
})
const FinancialAnalytics = dynamic(() => import("@/features/admin/tabs/FinancialAnalytics"), {
  loading: () => <TabSkeleton variant="dashboard" />,
})
const HospitalManagement = dynamic(() => import("@/features/admin/tabs/HospitalManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const AdminAssignment = dynamic(() => import("@/features/admin/tabs/AdminAssignment"), {
  loading: () => <TabSkeleton variant="table" />,
})
const PlatformMonitoring = dynamic(() => import("@/features/admin/tabs/PlatformMonitoring"), {
  loading: () => <TabSkeleton variant="dashboard" />,
})
const SubscriptionCenter = dynamic(() => import("@/features/admin/tabs/SubscriptionCenter"), {
  loading: () => <TabSkeleton variant="dashboard" />,
})
const LiveActivityCenter = dynamic(() => import("@/features/admin/tabs/LiveActivityCenter"), {
  loading: () => <TabSkeleton variant="table" />,
})
const BusinessAnalytics = dynamic(() => import("@/features/admin/tabs/BusinessAnalytics"), {
  loading: () => <TabSkeleton variant="dashboard" />,
})
const StaffManagement = dynamic(() => import("@/features/admin/tabs/StaffManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const DoctorPerformanceAnalytics = dynamic(() => import("@/features/admin/tabs/DoctorPerformanceAnalytics"), {
  loading: () => <TabSkeleton variant="dashboard" />,
})
const ReceptionistPerformanceAnalytics = dynamic(
  () => import("@/features/admin/tabs/ReceptionistPerformanceAnalytics"),
  { loading: () => <TabSkeleton variant="dashboard" /> }
)
const BranchManagement = dynamic(() => import("@/features/admin/tabs/BranchManagement"), {
  loading: () => <TabSkeleton variant="table" />,
})
const AdminDashboardOverview = dynamic(() => import("@/features/admin/components/AdminDashboardOverview"), {
  loading: () => <AdminOverviewSkeleton />,
})
const PlatformCommandCenter = dynamic(() => import("@/features/admin/components/PlatformCommandCenter"), {
  loading: () => <AdminOverviewSkeleton />,
})
const AdminAccountPanel = dynamic(() => import("@/features/admin/components/AdminAccountPanel"), {
  loading: () => <TabSkeleton variant="form" />,
})
const GlobalSettingsCenter = dynamic(() => import("@/features/admin/tabs/GlobalSettingsCenter"), {
  loading: () => <TabSkeleton variant="form" />,
})
const HqTenantLens = dynamic(
  () => import("@/features/admin/hq").then((m) => ({ default: m.HqTenantLens })),
  { ssr: false }
)
const HqGlobalSearch = dynamic(
  () => import("@/features/admin/hq").then((m) => ({ default: m.HqGlobalSearch })),
  { ssr: false }
)
const HqGlobalSearchTrigger = dynamic(
  () => import("@/features/admin/hq").then((m) => ({ default: m.HqGlobalSearchTrigger })),
  { ssr: false }
)
import type { HqGlobalSearchNavigate } from "@/features/admin/hq"
import SidebarAccountButton from "@/features/admin/chrome/SidebarAccountButton"
import AdminPageHeader from "@/features/admin/chrome/AdminPageHeader"
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  ReceiptText,
  Megaphone,
  BarChart3,
  Building2,
  UserCog,
  Activity,
  CreditCard,
  Radio,
  Settings,
  GitBranch,
  UsersRound,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import SubTabNavigation from "@/features/admin/chrome/SubTabNavigation"
import {
  calculateAllTrends,
  calculateRevenue,
  calculateCommonConditions,
  calculateMostPrescribedMedicines,
  calculateRevenueTrend,
  calculateTopDepartments,
  formatLocalYmd,
  getPaidAmount,
  isPaidAppointment,
  isSameLocalDay,
  revenueDateKey,
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
  yesterdayRevenue: number;
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

/** Unified billing row from /api/admin/billing-records (admissions + appointments). */
type DashboardBillingRecord = {
  id: string
  type?: "admission" | "appointment"
  status?: string
  totalAmount?: number
  paidAt?: string | null
  generatedAt?: string
  hospitalId?: string | null
  branchId?: string | null
  paymentMethod?: string | null
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function isPaidBillingInRange(
  record: DashboardBillingRecord,
  start: Date,
  end: Date,
  hospitalId?: string | null,
  branchId?: string
) {
  if (String(record.status || "").toLowerCase() !== "paid") return false
  if (!record.paidAt) return false
  if (hospitalId && record.hospitalId && record.hospitalId !== hospitalId) return false
  if (branchId && branchId !== "all") {
    // Keep unassigned branch bills visible (same rule as appointments)
    if (record.branchId && record.branchId !== branchId) return false
  }
  const paidAt = new Date(record.paidAt)
  if (Number.isNaN(paidAt.getTime())) return false
  return paidAt >= start && paidAt <= end
}

function sumBillingCollection(
  records: DashboardBillingRecord[],
  start: Date,
  end: Date,
  hospitalId?: string | null,
  branchId?: string
) {
  return records
    .filter((r) => isPaidBillingInRange(r, start, end, hospitalId, branchId))
    .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0)
}

const TAB_IDS = [
  "overview",
  "patients",
  "doctors",
  "campaigns",
  "appointments",
  "billing",
  "analytics",
  "hospitals",
  "admins",
  "monitoring",
  "subscriptions",
  "activity",
  "branches",
  "staff",
  "account",
] as const
type AdminTabId = (typeof TAB_IDS)[number]
const isAdminTabId = (value: string): value is AdminTabId =>
  (TAB_IDS as readonly string[]).includes(value)

const TAB_META: Record<AdminTabId, { title: string; description: string }> = {
  overview: { title: "Hospital Command Center", description: "Busy status, critical patients, capacity, revenue, and bottlenecks at a glance" },
  patients: { title: "Patient Management", description: "Manage patient records and information" },
  doctors: { title: "Doctor Management", description: "Manage doctor profiles and schedules" },
  campaigns: { title: "Campaigns", description: "Outreach library, automation, and performance" },
  appointments: { title: "Appointment Management", description: "Monitor and manage all appointments" },
  billing: { title: "Revenue & Analytics", description: "Comprehensive revenue analytics, billing records, and financial insights" },
  analytics: { title: "Analytics Hub", description: "Unified analytics dashboard – patient, financial, and doctor performance insights" },
  hospitals: { title: "Tenant Management", description: "SaaS customer directory — plans, health, usage, and lifecycle for every hospital on the platform" },
  admins: { title: "Tenant Administrators", description: "Provision customer admins and assign them to hospital tenants" },
  monitoring: { title: "Platform Monitoring", description: "Infrastructure health, latency, incidents, and probe logs across Harmony services" },
  subscriptions: { title: "Subscription Center", description: "Plans, renewals, revenue trends, and entitlement lifecycle for every hospital tenant" },
  activity: { title: "Live Activity Center", description: "Real-time platform activity feed sorted by severity — hospitals, clinical, billing, messaging, and ops" },
  branches: { title: "Branch Management", description: "Multi-site operations · capacity · staffing control" },
  staff: { title: "Staff Management", description: "Workforce directory · roles · shifts · access control" },
  account: { title: "My Account", description: "View your profile and update your login password" },
}

function getTabMeta(tab: AdminTabId, isSuperAdmin: boolean, tenantName?: string | null) {
  if (!isSuperAdmin) return TAB_META[tab]

  if (tab === "overview") {
    return {
      title: "Platform Command Center",
      description: "Fleet health, entitlements, and operators across every hospital on Harmony HMS",
    }
  }

  if (tab === "account") {
    return {
      title: "Global Settings",
      description: "Platform, branding, integrations, security, roles, and feature flags — organized HQ configuration",
    }
  }

  if (tab === "analytics") {
    return {
      title: "Business Analytics",
      description: "SaaS KPIs — MRR, ARR, growth, renewals, churn, plan mix, and hospital usage across the fleet",
    }
  }

  const inspectTabs: AdminTabId[] = ["patients", "doctors", "appointments", "billing"]
  if (inspectTabs.includes(tab)) {
    const lens = tenantName ? ` · ${tenantName}` : ""
    const base = TAB_META[tab]
    return {
      title: `Inspect${lens}`,
      description: `${base.title} for the selected tenant — platform HQ inspection mode`,
    }
  }

  return TAB_META[tab]
}

export default function AdminDashboard() {
  const [userData, setUserData] = useState<UserData | null>(null)
  // Store raw data (unfiltered) for client-side filtering
  const [rawPatients, setRawPatients] = useState<any[]>([])
  const [rawAppointments, setRawAppointments] = useState<AppointmentType[]>([])
  const [rawBillingRecords, setRawBillingRecords] = useState<DashboardBillingRecord[]>([])
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
    yesterdayRevenue: 0,
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
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview")
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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
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

  // Protect route — admins only; wrong roles redirect via useAuth('admin')
  const { user, loading: authLoading } = useAuth("admin")
  const { activeHospitalId, activeHospital, loading: hospitalLoading, userHospitals, isSuperAdmin, hasMultipleHospitals, setActiveHospital } = useMultiHospital()
  const analyticsEnabled = (activeHospital as any)?.enableAnalytics === true
  const branchManagementEnabled = (activeHospital as any)?.multipleBranchesEnabled !== false
  const router = useRouter()

  // Sync activeTab with URL (limited set)
  useEffect(() => {
    if (!tabFromUrl) return
    if (isAdminTabId(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    } else if (tabFromUrl === "receptionists" || tabFromUrl === "pharmacists") {
      setActiveTab("staff")
      setStaffSubTab(tabFromUrl)
    }
  }, [tabFromUrl, setStaffSubTab])

  // Super Admin global search (⌘K / Ctrl+K)
  useEffect(() => {
    if (!isSuperAdmin) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setGlobalSearchOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isSuperAdmin])

  const handleGlobalSearchNavigate = async (target: HqGlobalSearchNavigate) => {
    try {
      if (target.hospitalId && target.hospitalId !== activeHospitalId) {
        await setActiveHospital(target.hospitalId)
      }
    } catch {
      /* still navigate */
    }
    if (isAdminTabId(target.tab)) {
      setActiveTab(target.tab)
    }
    setSidebarOpen(false)
  }

  // If there is no authenticated user (e.g. after logout + browser back),
  // immediately redirect to the admin login page and render nothing here.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login?role=admin")
    }
  }, [authLoading, user, router])

  // Fetch branches on mount
  useEffect(() => {
    const loadBranches = async () => {
      if (!activeHospitalId) return
      
      try {
        const result = await fetchBranches(activeHospitalId)

        if (result.success) {
          setBranches(result.branches.map((b: Branch) => ({ id: b.id, name: b.name })))
        } else {

        }
      } catch {

      }
    }

    void loadBranches()
  }, [activeHospitalId])

  // Reset analytics sub-tabs and tab when analytics is disabled for hospital
  useEffect(() => {
    if (isSuperAdmin) return
    if (!analyticsEnabled) {
      if (patientSubTab === "analytics") setPatientSubTab("all")
      if (billingSubTab === "analytics") setBillingSubTab("all")
      if (activeTab === "analytics") setActiveTab("overview")
    }
  }, [analyticsEnabled, isSuperAdmin])

  const fetchDashboardData = async () => {
    if (!user || !activeHospitalId) return

    try {
      setLoading(true)

      // Get admin user data (graceful fallback if document is missing)
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
      } else {
        setUserData({
          id: user.uid,
          name: (user.data?.firstName as string) || user.email || "Admin",
          email: user.email || "",
          role: user.role || "admin",
        })
      }

      // Load hospital-scoped collections in parallel (same data, faster wall-clock)
      const [patientsSnapshot, doctorsSnapshot, appointmentsSnapshot] = await Promise.all([
        getDocs(getHospitalCollection(activeHospitalId, "patients")),
        getDocs(getHospitalCollection(activeHospitalId, "doctors")),
        getDocs(getHospitalCollection(activeHospitalId, "appointments")),
      ])

      const allPatients = patientsSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      })) as any[]
      
      // Store raw data for client-side filtering
      setRawPatients(allPatients)

      const totalDoctors = doctorsSnapshot.size

      const allAppointments = appointmentsSnapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      } as AppointmentType))
      
      // Store raw data for client-side filtering
      setRawAppointments(allAppointments)

      const todayKey = formatLocalYmd(new Date())
      const todaySample = allAppointments
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          appointmentDate: a.appointmentDate,
          dateKey: revenueDateKey(a) || null,
          status: a.status,
          paymentStatus: a.paymentStatus,
          paymentAmount: a.paymentAmount,
          totalConsultationFee: a.totalConsultationFee,
        }))

      if (process.env.NODE_ENV === "development") {
        console.info("[admin-dashboard] raw fetch", {
          hospitalId: activeHospitalId,
          patients: allPatients.length,
          doctors: totalDoctors,
          appointments: allAppointments.length,
          todayKey,
          todayAppointments: allAppointments.filter((a) => isSameLocalDay(a.appointmentDate)).length,
          sample: todaySample,
        })
      }

      // Calculate basic stats for initialization (filtered stats calculated in useMemo)
      const totalPatients = allPatients.length
      const totalAppointments = allAppointments.length
      const completedAppointments = allAppointments.filter(apt => apt.status === "completed").length
      const pendingAppointments = allAppointments.filter(apt => apt.status === "confirmed" || (apt as any).status === 'resrescheduled').length

      // Today's appointments — local YYYY-MM-DD (same rule as receptionist dashboard)
      const todayAppointments = allAppointments.filter(apt =>
        isSameLocalDay(apt.appointmentDate)
      ).length

      // Get recent appointments (last 5) — isolated so index/orderBy failures don't wipe dashboard data
      let recent: AppointmentType[] = []
      try {
        const recentAppointmentsQuery = query(
          getHospitalCollection(activeHospitalId, "appointments"),
          orderBy("createdAt", "desc"),
          limit(5)
        )
        const recentSnapshot = await getDocs(recentAppointmentsQuery)
        recent = recentSnapshot.docs.map(docSnap => ({ 
          id: docSnap.id, 
          ...docSnap.data() 
        } as AppointmentType))
      } catch (recentErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[admin-dashboard] recent appointments query failed; using client sort fallback", recentErr)
        }
        recent = [...allAppointments]
          .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
          .slice(0, 5)
      }

      // Calculate trends and analytics using utility functions
      const trends = calculateAllTrends(allAppointments)
      const commonConditions = calculateCommonConditions(allAppointments)
      const mostPrescribedMedicines = calculateMostPrescribedMedicines(allAppointments)
      const revenueTrend = calculateRevenueTrend(allAppointments)
      const topDepartments = calculateTopDepartments(allAppointments)

      // Unified billing (admission discharge + appointment payments) — same source as Reception Billing
      let billingRecords: DashboardBillingRecord[] = []
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          const token = await currentUser.getIdToken()
          const billingRes = await fetch("/api/admin/billing-records", {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
          if (billingRes.ok) {
            const billingData = await billingRes.json().catch(() => ({}))
            billingRecords = Array.isArray(billingData?.records) ? billingData.records : []
          } else if (process.env.NODE_ENV === "development") {
            console.warn("[admin-dashboard] billing-records fetch failed", billingRes.status)
          }
        }
      } catch (billingErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[admin-dashboard] billing-records error", billingErr)
        }
      }
      setRawBillingRecords(billingRecords)

      const todayStart = startOfLocalDay()
      const todayEnd = endOfLocalDay()
      const yesterdayStart = startOfLocalDay(new Date(Date.now() - 86400000))
      const yesterdayEnd = endOfLocalDay(new Date(Date.now() - 86400000))
      const weekStart = startOfLocalDay(new Date(Date.now() - 6 * 86400000))
      const monthStart = startOfLocalDay(new Date(Date.now() - 29 * 86400000))

      const appointmentTodayRevenue = allAppointments
        .filter((a) => isPaidAppointment(a) && revenueDateKey(a) === todayKey)
        .reduce((s, a) => s + getPaidAmount(a), 0)

      // Prefer unified billing totals (includes admission card settlements like ₹82,502)
      const billingTodayRevenue = sumBillingCollection(
        billingRecords,
        todayStart,
        todayEnd,
        activeHospitalId
      )
      const billingYesterdayRevenue = sumBillingCollection(
        billingRecords,
        yesterdayStart,
        yesterdayEnd,
        activeHospitalId
      )
      const billingWeeklyRevenue = sumBillingCollection(
        billingRecords,
        weekStart,
        todayEnd,
        activeHospitalId
      )
      const billingMonthlyRevenue = sumBillingCollection(
        billingRecords,
        monthStart,
        todayEnd,
        activeHospitalId
      )
      const billingTotalRevenue = billingRecords
        .filter((r) => String(r.status || "").toLowerCase() === "paid")
        .filter((r) => !r.hospitalId || r.hospitalId === activeHospitalId)
        .reduce((s, r) => s + Number(r.totalAmount || 0), 0)

      const todayRevenue = billingRecords.length > 0 ? billingTodayRevenue : appointmentTodayRevenue
      const yesterdayRevenue = billingRecords.length > 0 ? billingYesterdayRevenue : 0
      const weeklyRevenue =
        billingRecords.length > 0 ? billingWeeklyRevenue : calculateRevenue(allAppointments, 7)
      const monthlyRevenue =
        billingRecords.length > 0 ? billingMonthlyRevenue : calculateRevenue(allAppointments, 30)
      const totalRevenue =
        billingRecords.length > 0 ? billingTotalRevenue : calculateRevenue(allAppointments, Infinity)

      const activeDoctorsToday = new Set(
        allAppointments
          .filter((a) => isSameLocalDay(a.appointmentDate) && a.doctorId)
          .map((a) => a.doctorId)
      ).size

      if (process.env.NODE_ENV === "development") {
        console.info("[admin-dashboard] processed stats", {
          todayKey,
          todayAppointments,
          appointmentTodayRevenue,
          billingTodayRevenue,
          todayRevenue,
          yesterdayRevenue,
          billingRecords: billingRecords.length,
          paidTodaySample: billingRecords
            .filter((r) => isPaidBillingInRange(r, todayStart, todayEnd, activeHospitalId))
            .map((r) => ({
              id: r.id,
              type: r.type,
              totalAmount: r.totalAmount,
              paidAt: r.paidAt,
              method: r.paymentMethod,
            })),
          activeDoctorsToday,
          totalRevenue,
          weeklyRevenue,
          monthlyRevenue,
        })
      }

      setStats({
        totalPatients,
        totalDoctors,
        totalAppointments,
        todayAppointments,
        todayRevenue,
        yesterdayRevenue,
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

    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[admin-dashboard] fetchDashboardData failed", err)
      }
      setNotification({ 
        type: "error", 
        message: "Failed to load dashboard data" 
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || authLoading || hospitalLoading) return

    if (!activeHospitalId) {
      setLoading(false)
      return
    }

    fetchDashboardData()
    const cleanup = setupRealtimeBadgeListeners()
    return () => {
      if (cleanup) cleanup()
    }
  }, [user, activeHospitalId, hospitalLoading, authLoading])
  // Note: selectedBranchId removed - filtering happens client-side via useMemo below

  // Filter data and recalculate stats based on selectedBranchId
  const filteredStats = useMemo(() => {
    // Filter patients by branch (keep unassigned visible)
    let filteredPatients = rawPatients
    if (selectedBranchId !== "all") {
      filteredPatients = rawPatients.filter((p: any) => {
        const branch = p.defaultBranchId
        if (branch == null || branch === "") return true
        return branch === selectedBranchId
      })
    }

    // Filter appointments by branch (keep unassigned / legacy visible)
    let filteredAppointments = rawAppointments
    if (selectedBranchId !== "all") {
      filteredAppointments = rawAppointments.filter((apt) => {
        const branch = apt.branchId
        if (branch == null || branch === "") return true
        return branch === selectedBranchId
      })
    }

    // Recalculate all stats from filtered data
    const totalPatients = filteredPatients.length
    const totalAppointments = filteredAppointments.length
    const completedAppointments = filteredAppointments.filter(apt => apt.status === "completed").length
    const pendingAppointments = filteredAppointments.filter(apt => apt.status === "confirmed" || (apt as any).status === 'resrescheduled').length

    // Today's appointments
    const todayKey = formatLocalYmd(new Date())
    const todayAppointments = filteredAppointments.filter(apt =>
      isSameLocalDay(apt.appointmentDate)
    ).length

    const todayStart = startOfLocalDay()
    const todayEnd = endOfLocalDay()
    const yesterdayStart = startOfLocalDay(new Date(Date.now() - 86400000))
    const yesterdayEnd = endOfLocalDay(new Date(Date.now() - 86400000))
    const weekStart = startOfLocalDay(new Date(Date.now() - 6 * 86400000))
    const monthStart = startOfLocalDay(new Date(Date.now() - 29 * 86400000))

    const appointmentTodayRevenue = filteredAppointments
      .filter((a) => isPaidAppointment(a) && revenueDateKey(a) === todayKey)
      .reduce((s, a) => s + getPaidAmount(a), 0)

    const useBilling = rawBillingRecords.length > 0
    const todayRevenue = useBilling
      ? sumBillingCollection(rawBillingRecords, todayStart, todayEnd, activeHospitalId, selectedBranchId)
      : appointmentTodayRevenue
    const yesterdayRevenue = useBilling
      ? sumBillingCollection(rawBillingRecords, yesterdayStart, yesterdayEnd, activeHospitalId, selectedBranchId)
      : 0
    const weeklyRevenue = useBilling
      ? sumBillingCollection(rawBillingRecords, weekStart, todayEnd, activeHospitalId, selectedBranchId)
      : calculateRevenue(filteredAppointments, 7)
    const monthlyRevenue = useBilling
      ? sumBillingCollection(rawBillingRecords, monthStart, todayEnd, activeHospitalId, selectedBranchId)
      : calculateRevenue(filteredAppointments, 30)
    const totalRevenue = useBilling
      ? rawBillingRecords
          .filter((r) => String(r.status || "").toLowerCase() === "paid")
          .filter((r) => !r.hospitalId || !activeHospitalId || r.hospitalId === activeHospitalId)
          .filter((r) => {
            if (selectedBranchId === "all") return true
            if (!r.branchId) return true
            return r.branchId === selectedBranchId
          })
          .reduce((s, r) => s + Number(r.totalAmount || 0), 0)
      : calculateRevenue(filteredAppointments, Infinity)

    const activeDoctorsToday = new Set(
      filteredAppointments
        .filter((a) => isSameLocalDay(a.appointmentDate) && a.doctorId)
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
      yesterdayRevenue,
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
  }, [rawPatients, rawAppointments, rawBillingRecords, selectedBranchId, stats.totalDoctors, activeHospitalId])

  // Use filtered stats for display
  const displayStats = filteredStats

  // Filter recent appointments by branch
  const filteredRecentAppointments = useMemo(() => {
    if (selectedBranchId === "all") {
      return recentAppointments
    }
    return recentAppointments.filter((apt) => apt.branchId === selectedBranchId)
  }, [recentAppointments, selectedBranchId])

  // Filter all appointments by branch (for overview analytics).
  // Include unassigned branch docs (null/empty) so WhatsApp/legacy records remain visible —
  // same visibility rule reception uses for unassigned appointments.
  const filteredAppointmentsForOverview = useMemo(() => {
    if (selectedBranchId === "all") return rawAppointments
    return rawAppointments.filter((apt) => {
      const branch = apt.branchId
      if (branch == null || branch === "") return true
      return branch === selectedBranchId
    })
  }, [rawAppointments, selectedBranchId])

  const filteredPatientsForOverview = useMemo(() => {
    if (selectedBranchId === "all") return rawPatients
    return rawPatients.filter((p: any) => {
      const branch = p.defaultBranchId
      if (branch == null || branch === "") return true
      return branch === selectedBranchId
    })
  }, [rawPatients, selectedBranchId])

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

  // Real-time listener for refund requests (tenant-scoped)
  useEffect(() => {
    if (!user || !activeHospitalId) return

    const refundQuery = query(
      collection(db, 'refund_requests'),
      where('status', '==', 'pending'),
      where('hospitalId', '==', activeHospitalId),
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
  }, [user, activeHospitalId])
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

  // Unauthenticated or redirecting users are handled by useAuth('admin')
  if (authLoading || !user) {
    return (
      <div className="hms-portal-shell min-h-screen bg-slate-50">
        <div className="lg:ml-64">
          <main className="hms-page min-w-0 p-4 sm:p-6">
            <AdminOverviewSkeleton />
          </main>
        </div>
      </div>
    )
  }

  // Authenticated admin — load dashboard data; never block forever on missing profile doc
  if (hospitalLoading || loading) {
    return (
      <AdminProtected allowedRoles={["admin"]}>
        <div className="hms-portal-shell">
          <div className="lg:ml-64">
            <header className="px-4 sm:px-6 lg:px-6 pt-4 pb-0">
              <AdminPageHeader
                title={isSuperAdmin ? "Platform Command Center" : "Hospital Command Center"}
                description={
                  isSuperAdmin
                    ? "Loading platform fleet snapshot…"
                    : "Loading operational status…"
                }
              />
            </header>
            <main className="hms-page min-w-0">
              <AdminOverviewSkeleton />
            </main>
          </div>
        </div>
      </AdminProtected>
    )
  }

  const resolvedUserData: UserData = userData ?? {
    id: user.uid,
    name: user.email || "Admin",
    email: user.email || "",
    role: user.role || "admin",
  }

  return (
    <AdminProtected allowedRoles={["admin"]}>
      <div className="hms-portal-shell">
      {/* Mobile Menu Button - Only show when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
      )}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — matches receptionist rx-sidebar */}
      <aside
        className={`rx-sidebar fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-cyan-600 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {isSuperAdmin ? "Harmony HMS" : "HMS"}
              </p>
              <p className="text-xs text-slate-400 leading-tight">
                {isSuperAdmin ? "SaaS platform owner" : "Admin Portal"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {isSuperAdmin ? (
            <>
              <div className="px-3 mb-1">
                <button
                  type="button"
                  onClick={() => { setActiveTab("overview"); setSidebarOpen(false) }}
                  className={`rx-nav-item ${activeTab === "overview" ? "rx-nav-item--active" : ""}`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Command Center</span>
                </button>
              </div>

              <div className="rx-nav-group mt-3">
                <span className="rx-nav-group-label">Platform control</span>
                <div className="space-y-0.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("hospitals"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "hospitals" ? "rx-nav-item--active" : ""}`}
                  >
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>Tenants</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("admins"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "admins" ? "rx-nav-item--active" : ""}`}
                  >
                    <UserCog className="w-4 h-4 shrink-0" />
                    <span>Tenant Admins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("monitoring"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "monitoring" ? "rx-nav-item--active" : ""}`}
                  >
                    <Activity className="w-4 h-4 shrink-0" />
                    <span>Monitoring</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("subscriptions"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "subscriptions" ? "rx-nav-item--active" : ""}`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>Subscriptions</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("analytics"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "analytics" ? "rx-nav-item--active" : ""}`}
                  >
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span>Business Analytics</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("activity"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "activity" ? "rx-nav-item--active" : ""}`}
                  >
                    <Radio className="w-4 h-4 shrink-0" />
                    <span>Activity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("account"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "account" ? "rx-nav-item--active" : ""}`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Global Settings</span>
                  </button>
                </div>
              </div>

              <div className="rx-nav-group mt-4">
                <span className="rx-nav-group-label">Inspect tenant</span>
                {activeHospital?.name && (
                  <p className="px-2 pt-1 pb-0.5 text-[10px] font-medium text-slate-400 truncate">
                    Lens: {activeHospital.name}
                  </p>
                )}
                <div className="space-y-0.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "patients" ? "rx-nav-item--active" : ""}`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Inspect · Patients</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "doctors" ? "rx-nav-item--active" : ""}`}
                  >
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    <span>Inspect · Doctors</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "appointments" ? "rx-nav-item--active" : ""}`}
                  >
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>Inspect · Appointments</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("billing"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "billing" ? "rx-nav-item--active" : ""}`}
                  >
                    <ReceiptText className="w-4 h-4 shrink-0" />
                    <span>Inspect · Billing</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="px-3 mb-1">
                <button
                  type="button"
                  onClick={() => { setActiveTab("overview"); setSidebarOpen(false) }}
                  className={`rx-nav-item ${activeTab === "overview" ? "rx-nav-item--active" : ""}`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                  {overviewBadge.displayCount > 0 && (
                    <span className="rx-nav-badge rx-nav-badge--blue ml-auto">
                      {overviewBadge.displayCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="rx-nav-group mt-3">
                <span className="rx-nav-group-label">Operations</span>
                <div className="space-y-0.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "patients" ? "rx-nav-item--active" : ""}`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Patients</span>
                    {patientsBadge.displayCount > 0 && (
                      <span className="rx-nav-badge rx-nav-badge--blue ml-auto">
                        {patientsBadge.displayCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "doctors" ? "rx-nav-item--active" : ""}`}
                  >
                    <Stethoscope className="w-4 h-4 shrink-0" />
                    <span>Doctors</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab("campaigns"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "campaigns" ? "rx-nav-item--active" : ""}`}
                  >
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span>Campaigns</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "appointments" ? "rx-nav-item--active" : ""}`}
                  >
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>Appointments</span>
                    {appointmentsBadge.displayCount > 0 && (
                      <span className="rx-nav-badge rx-nav-badge--amber ml-auto">
                        {appointmentsBadge.displayCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab("billing"); setSidebarOpen(false) }}
                    className={`rx-nav-item ${activeTab === "billing" ? "rx-nav-item--active" : ""}`}
                  >
                    <ReceiptText className="w-4 h-4 shrink-0" />
                    <span>Revenue & Analytics</span>
                    {billingBadge.displayCount > 0 && (
                      <span className="rx-nav-badge rx-nav-badge--red ml-auto">
                        {billingBadge.displayCount}
                      </span>
                    )}
                  </button>

                  {analyticsEnabled && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab("analytics"); setSidebarOpen(false) }}
                      className={`rx-nav-item ${activeTab === "analytics" ? "rx-nav-item--active" : ""}`}
                    >
                      <BarChart3 className="w-4 h-4 shrink-0" />
                      <span>Analytics Hub</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="rx-nav-group mt-4">
                <span className="rx-nav-group-label">Management</span>
                <div className="space-y-0.5 mt-1.5">
                  {branchManagementEnabled && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab("branches"); setSidebarOpen(false) }}
                      className={`rx-nav-item ${activeTab === "branches" ? "rx-nav-item--active" : ""}`}
                    >
                      <GitBranch className="w-4 h-4 shrink-0" />
                      <span>Branches</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("staff")
                      setStaffSubTab("receptionists")
                      setSidebarOpen(false)
                    }}
                    className={`rx-nav-item ${activeTab === "staff" ? "rx-nav-item--active" : ""}`}
                  >
                    <UsersRound className="w-4 h-4 shrink-0" />
                    <span>Staff</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </nav>

        {/* User / sign-out */}
        <div className="border-t border-slate-200 p-3 shrink-0">
          <SidebarAccountButton
            active={activeTab === "account"}
            onClick={() => { setActiveTab("account"); setSidebarOpen(false) }}
            displayName={resolvedUserData.firstName || resolvedUserData.name || "Admin"}
            roleLabel={isSuperAdmin ? "Platform Super Admin" : "Administrator"}
            initial={resolvedUserData.firstName?.charAt(0) || resolvedUserData.email.charAt(0).toUpperCase()}
          />
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Standard Admin Page Header */}
        <header className={!sidebarOpen ? "pl-12 sm:pl-14 lg:pl-0" : undefined}>
          <AdminPageHeader
            title={getTabMeta(activeTab, isSuperAdmin, activeHospital?.name).title}
            description={getTabMeta(activeTab, isSuperAdmin, activeHospital?.name).description}
            chromeOnly={
              isSuperAdmin &&
              [
                "overview",
                "hospitals",
                "admins",
                "monitoring",
                "subscriptions",
                "activity",
                "account",
                "analytics",
              ].includes(activeTab)
            }
            dense={
              activeTab === "campaigns" ||
              activeTab === "branches" ||
              activeTab === "staff" ||
              activeTab === "hospitals" ||
              activeTab === "admins" ||
              activeTab === "monitoring" ||
              activeTab === "subscriptions" ||
              activeTab === "activity" ||
              activeTab === "account" ||
              (isSuperAdmin && activeTab === "analytics") ||
              (isSuperAdmin && activeTab === "overview")
            }
            controls={
              <>
                {isSuperAdmin && (
                  <HqGlobalSearchTrigger onClick={() => setGlobalSearchOpen(true)} />
                )}
                {isSuperAdmin && hasMultipleHospitals && (
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tenant</label>
                    <select
                      value={activeHospitalId || ""}
                      onChange={async (e) => {
                        const hospitalId = e.target.value
                        if (hospitalId) {
                          try {
                            await setActiveHospital(hospitalId)
                            setNotification({ type: "success", message: "Active tenant switched" })
                          } catch (err: any) {
                            setNotification({ type: "error", message: err?.message || "Failed to switch tenant" })
                          }
                        }
                      }}
                      className="hq-ds-input hq-ds-input--lg min-w-[180px]"
                    >
                      {userHospitals.map((hospital) => (
                        <option key={hospital.id} value={hospital.id}>
                          {hospital.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {branches.length > 0 && branchManagementEnabled && (
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Branch</label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="hq-ds-input hq-ds-input--lg min-w-[160px]"
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
              </>
            }
          />
        </header>

        {/* Content Area */}
        <main className="hms-page min-w-0">
          {isSuperAdmin &&
            ["patients", "doctors", "appointments", "billing"].includes(activeTab) && (
              <HqTenantLens tenantName={activeHospital?.name}>
                {hasMultipleHospitals && (
                  <select
                    value={activeHospitalId || ""}
                    onChange={async (e) => {
                      const hospitalId = e.target.value
                      if (hospitalId) {
                        try {
                          await setActiveHospital(hospitalId)
                        } catch (err: any) {
                          setNotification({
                            type: "error",
                            message: err?.message || "Failed to switch tenant",
                          })
                        }
                      }
                    }}
                    className="hq-ds-input h-8 min-w-[10rem]"
                  >
                    {userHospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </option>
                    ))}
                  </select>
                )}
              </HqTenantLens>
            )}

          {activeTab === "overview" && (
            isSuperAdmin ? (
              <PlatformCommandCenter
                setActiveTab={(tab) => setActiveTab(tab)}
                setSidebarOpen={setSidebarOpen}
                onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
              />
            ) : (
              <AdminDashboardOverview
                displayStats={displayStats}
                trendView={trendView}
                setTrendView={setTrendView}
                filteredAppointments={filteredAppointmentsForOverview}
                filteredPatients={filteredPatientsForOverview}
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
            )
          )}
          {activeTab === "branches" && !isSuperAdmin && (
            branchManagementEnabled ? (
              <div className="hms-content-card rounded-xl p-2.5 sm:p-3">
                <BranchManagement
                  selectedBranchId={selectedBranchId}
                  onBranchFilterChange={setSelectedBranchId}
                  kpi={{
                    doctors: displayStats.totalDoctors,
                    staff: null,
                    todayAppointments: displayStats.todayAppointments,
                    todayRevenue: displayStats.todayRevenue,
                  }}
                />
              </div>
            ) : (
              <div className="camp-crm-empty rounded-xl border border-dashed border-slate-200 bg-white py-10">
                <p className="camp-crm-empty-title">Single-branch mode</p>
                <p className="camp-crm-empty-desc">
                  Multi-branch control is disabled for this hospital. Contact Super Admin to enable it.
                </p>
              </div>
            )
          )}

          {activeTab === "patients" && (
            <div className="hms-content-card rounded-2xl">
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
            <div className="hms-content-card rounded-2xl p-6">
              <DoctorManagement selectedBranchId={selectedBranchId} />
            </div>
          )}

          {activeTab === "campaigns" && !isSuperAdmin && (
            <div className="hms-content-card rounded-xl p-3 sm:p-3.5">
              <CampaignManagement selectedBranchId={selectedBranchId} branches={branches} />
            </div>
          )}

          {activeTab === "appointments" && (
            <div className="hms-content-card rounded-2xl p-6">
              <AppoinmentManagement selectedBranchId={selectedBranchId} />
            </div>
          )}

          {activeTab === "billing" && (
            <div className="hms-content-card rounded-2xl">
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
            <div className="hms-content-card rounded-xl p-2.5 sm:p-3">
              <StaffManagement
                selectedBranchId={selectedBranchId}
                doctorCount={displayStats.totalDoctors}
                initialRoleFilter={staffSubTab === "pharmacists" ? "pharmacist" : "all"}
              />
            </div>
          )}

          {activeTab === "analytics" && isSuperAdmin && <BusinessAnalytics />}

          {activeTab === "analytics" && !isSuperAdmin && (
            <div className="hms-content-card rounded-2xl">
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
                      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-6 border border-cyan-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-cyan-800">Patient Analytics</span>
                          <div className="w-10 h-10 bg-cyan-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-cyan-700 mt-2">Demographics, trends, seasonal diseases, area distribution</p>
                        <button
                          onClick={() => setAnalyticsSubTab("patients")}
                          className="mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800 underline"
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

                      <div className="bg-gradient-to-br from-cyan-50 to-teal-100 rounded-xl p-6 border border-cyan-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-cyan-800">Doctor Performance</span>
                          <div className="w-10 h-10 bg-cyan-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-cyan-700 mt-2">Patient count, revenue, consultation time, peak hours</p>
                        <button
                          onClick={() => setAnalyticsSubTab("doctors")}
                          className="mt-4 text-xs font-semibold text-cyan-700 hover:text-cyan-800 underline"
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
                          className="text-left p-4 bg-cyan-50 hover:bg-cyan-100 rounded-lg border border-cyan-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">👥</span>
                            <span className="font-semibold text-cyan-800">Patient Analytics</span>
                          </div>
                          <p className="text-xs text-cyan-700">View patient demographics, trends, and insights</p>
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
                          className="text-left p-4 bg-cyan-50 hover:bg-cyan-100 rounded-lg border border-cyan-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">👨‍⚕️</span>
                            <span className="font-semibold text-cyan-900">Doctor Performance</span>
                          </div>
                          <p className="text-xs text-cyan-700">Doctor metrics and performance analytics</p>
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

          {activeTab === "hospitals" && <HospitalManagement />}

          {activeTab === "admins" && <AdminAssignment />}

          {activeTab === "monitoring" && isSuperAdmin && <PlatformMonitoring />}

          {activeTab === "subscriptions" && isSuperAdmin && <SubscriptionCenter />}

          {activeTab === "activity" && isSuperAdmin && <LiveActivityCenter />}

          {activeTab === "account" && user?.email && (
            isSuperAdmin ? (
              <GlobalSettingsCenter
                userEmail={user.email}
                displayName={resolvedUserData.firstName || resolvedUserData.name || "Admin"}
                onNotify={(type, message) => setNotification({ type, message })}
                onNavigate={(tab) => {
                  if (isAdminTabId(tab)) {
                    setActiveTab(tab)
                    setSidebarOpen(false)
                  }
                }}
              />
            ) : (
              <AdminAccountPanel
                userEmail={user.email}
                displayName={resolvedUserData.firstName || resolvedUserData.name || "Admin"}
                isSuperAdmin={isSuperAdmin}
                onNotify={(type, message) => setNotification({ type, message })}
              />
            )
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

      {isSuperAdmin && (
        <HqGlobalSearch
          open={globalSearchOpen}
          onClose={() => setGlobalSearchOpen(false)}
          onNavigate={handleGlobalSearchNavigate}
          preferredHospitalId={activeHospitalId}
        />
      )}
      
      </div>
    </AdminProtected>
  )
}