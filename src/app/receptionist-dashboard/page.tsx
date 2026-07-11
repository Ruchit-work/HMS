'use client'

import { useEffect, useState, useCallback } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, query, where, onSnapshot } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { isAppointmentVisibleToReceptionist } from "@/utils/appointments/appointmentSource"
import { useRouter } from "next/navigation"
import Notification from "@/components/ui/feedback/Notification"
import { useNotificationBadge } from "@/hooks/useNotificationBadge"
import ReceptionistTabPanels, {
  prefetchReceptionistTab,
  type ReceptionistTab,
} from "@/app/receptionist-dashboard/components/ReceptionistTabPanels"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"
import {
  LayoutDashboard, Users, Stethoscope, CalendarDays, BedDouble,
  ReceiptText, MessageCircle, FolderOpen, CalendarPlus,
  LogOut, Menu, X, Building2, ChevronDown
} from "lucide-react"

type ActiveTab = ReceptionistTab

const TAB_TITLES: Record<ActiveTab, string> = {
  dashboard: "Dashboard",
  patients: "Patients",
  doctors: "Doctors",
  appointments: "Appointments",
  "admit-requests": "IPD Admissions",
  billing: "Billing",
  "whatsapp-bookings": "WhatsApp Bookings",
  "book-appointment": "Book Appointment",
  documents: "Documents",
}

function getGreetingTime(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return "Good morning"
  if (h >= 12 && h < 17) return "Good afternoon"
  if (h >= 17 && h < 21) return "Good evening"
  return "Good night"
}

export default function ReceptionistDashboard() {
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard")
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(new Set(["dashboard"]))
  const [patientSubTab, setPatientSubTab] = useState<"all" | "analytics">("all")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState<string>("")
  const [bookSubOpen, setBookSubOpen] = useState(false)
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing")
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [newAppointmentsCount, setNewAppointmentsCount] = useState(0)
  const [, setNewPatientsCount] = useState(0)
  const [pendingBillingCount, setPendingBillingCount] = useState(0)
  const [admitRequestsCount, setAdmitRequestsCount] = useState(0)
  const [whatsappPendingCount, setWhatsappPendingCount] = useState(0)
  const [billingFocusQuery, setBillingFocusQuery] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState("")

  const router = useRouter()
  const { user, loading: authLoading, error: authError, timedOut: authTimedOut } = useAuth("receptionist")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()
  const [receptionistBranchId, setReceptionistBranchId] = useState<string | null>(null)

  const appointmentsBadge = useNotificationBadge({
    badgeKey: "receptionist-appointments",
    rawCount: newAppointmentsCount,
    activeTab,
  })
  const admitRequestsBadge = useNotificationBadge({
    badgeKey: "receptionist-admit-requests",
    rawCount: admitRequestsCount,
    activeTab,
  })
  const billingBadge = useNotificationBadge({
    badgeKey: "receptionist-billing",
    rawCount: pendingBillingCount,
    activeTab,
  })
  const whatsappBadge = useNotificationBadge({
    badgeKey: "receptionist-whatsapp-bookings",
    rawCount: whatsappPendingCount,
    activeTab,
  })

  // Clock
  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      )
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const recepDoc = await getDoc(doc(db, "receptionists", user.uid))
        if (recepDoc.exists()) {
          const data = recepDoc.data() as Record<string, unknown>
          setUserName((data.firstName as string) || "Receptionist")
        } else {
          setUserName("Receptionist")
        }
      } catch {
        setUserName("Receptionist")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const refreshWhatsappPendingCount = useCallback(async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) { setWhatsappPendingCount(0); return }
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/whatsapp-bookings", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      })
      if (!res.ok) { setWhatsappPendingCount(0); return }
      const data = await res.json().catch(() => ({}))
      const appointments = Array.isArray(data?.appointments) ? data.appointments : []
      setWhatsappPendingCount(appointments.length)
    } catch {
      setWhatsappPendingCount(0)
    }
  }, [])

  const setupRealtimeBadgeListeners = useCallback(() => {
    if (!activeHospitalId) return () => {}

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const appointmentsQuery = query(
      getHospitalCollection(activeHospitalId, "appointments"),
      where("appointmentDate", ">=", todayStart.toISOString().split("T")[0]),
      where("appointmentDate", "<", todayEnd.toISOString().split("T")[0])
    )

    const unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
      let docs = snapshot.docs.filter((d) => {
        const data = d.data()
        return data.status === "confirmed" || data.status === "whatsapp_pending"
      })
      if (receptionistBranchId) {
        docs = docs.filter((d) =>
          isAppointmentVisibleToReceptionist(d.data(), receptionistBranchId)
        )
      }
      setNewAppointmentsCount(docs.length)
    })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const patientsQuery = query(
      getHospitalCollection(activeHospitalId, "patients"),
      where("createdAt", ">=", sevenDaysAgo.toISOString())
    )
    const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
      setNewPatientsCount(snapshot.size)
    })

    // Pending billing: hospital-scoped appointments, then client-side branch visibility
    // (Firestore where branchId == X would hide doctor-created appointments on other branches)
    const billingQuery = query(
      getHospitalCollection(activeHospitalId, "appointments"),
      where("status", "in", ["completed", "confirmed"]),
      where("paymentStatus", "in", ["pending", "unpaid"])
    )
    const unsubscribeBilling = onSnapshot(billingQuery, (snapshot) => {
      const count = snapshot.docs.filter((d) =>
        isAppointmentVisibleToReceptionist(d.data(), receptionistBranchId)
      ).length
      setPendingBillingCount(count)
    })

    const admitRequestsQuery = query(
      getHospitalCollection(activeHospitalId, "admission_requests"),
      where("status", "==", "pending")
    )
    const unsubscribeAdmitRequests = onSnapshot(admitRequestsQuery, (snapshot) => {
      setAdmitRequestsCount(snapshot.size)
    })

    return () => {
      unsubscribeAppointments()
      unsubscribePatients()
      unsubscribeBilling()
      unsubscribeAdmitRequests()
    }
  }, [activeHospitalId, receptionistBranchId])

  useEffect(() => {
    if (!activeHospitalId || hospitalLoading) return
    const unsubscribe = setupRealtimeBadgeListeners()
    refreshWhatsappPendingCount()
    const interval = setInterval(refreshWhatsappPendingCount, 30_000)
    return () => {
      if (unsubscribe) unsubscribe()
      clearInterval(interval)
    }
  }, [activeHospitalId, hospitalLoading, setupRealtimeBadgeListeners, refreshWhatsappPendingCount])

  useEffect(() => {
    const fetchReceptionistBranch = async () => {
      if (!user) return
      try {
        const receptionistDoc = await getDoc(doc(db, "receptionists", user.uid))
        if (receptionistDoc.exists()) {
          const data = receptionistDoc.data()
          setReceptionistBranchId(data.branchId || null)
        }
      } catch {}
    }
    if (user) fetchReceptionistBranch()
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false)
      router.replace("/auth/login?role=receptionist")
    }
  }, [authLoading, router, user])

  const handleLogout = async () => {
    try {
      setLogoutLoading(true)
      await signOut(auth)
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = "/auth/login?role=receptionist"
    } catch {
      setNotification({ type: "error", message: "Failed to logout. Please try again." })
      setLogoutLoading(false)
      setLogoutConfirmOpen(false)
    }
  }

  const navigate = (tab: ActiveTab) => {
    setActiveTab(tab)
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
    setSidebarOpen(false)
  }

  const isShellReady = Boolean(
    user &&
    !authLoading &&
    !authError &&
    !authTimedOut &&
    !hospitalLoading &&
    activeHospitalId &&
    !loading
  )

  // Prefetch default tab on mount
  useEffect(() => {
    prefetchReceptionistTab("dashboard")
  }, [])

  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  if (!authLoading && !user) return null

  const displayName = userName || "Receptionist"
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="rx-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
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
              <p className="text-sm font-semibold text-slate-900 leading-tight">HMS</p>
              <p className="text-xs text-slate-400 leading-tight">Reception Portal</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {/* Dashboard */}
          <div className="px-3 mb-1">
            <button
              onClick={() => navigate("dashboard")}
              onMouseEnter={() => prefetchReceptionistTab("dashboard")}
              className={`rx-nav-item ${activeTab === "dashboard" ? "rx-nav-item--active" : ""}`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </button>
          </div>

          {/* Operations group */}
          <div className="rx-nav-group mt-3">
            <span className="rx-nav-group-label">Operations</span>
            <div className="space-y-0.5 mt-1.5">
              <button
                onClick={() => navigate("patients")}
                onMouseEnter={() => prefetchReceptionistTab("patients")}
                className={`rx-nav-item ${activeTab === "patients" ? "rx-nav-item--active" : ""}`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Patients</span>
              </button>

              <button
                onClick={() => navigate("appointments")}
                onMouseEnter={() => prefetchReceptionistTab("appointments")}
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
                onClick={() => navigate("admit-requests")}
                onMouseEnter={() => prefetchReceptionistTab("admit-requests")}
                className={`rx-nav-item ${activeTab === "admit-requests" ? "rx-nav-item--active" : ""}`}
              >
                <BedDouble className="w-4 h-4 shrink-0" />
                <span>IPD Admissions</span>
                {admitRequestsBadge.displayCount > 0 && (
                  <span className="rx-nav-badge rx-nav-badge--blue ml-auto">
                    {admitRequestsBadge.displayCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate("billing")}
                onMouseEnter={() => prefetchReceptionistTab("billing")}
                className={`rx-nav-item ${activeTab === "billing" ? "rx-nav-item--active" : ""}`}
              >
                <ReceiptText className="w-4 h-4 shrink-0" />
                <span>Billing</span>
                {billingBadge.displayCount > 0 && (
                  <span className="rx-nav-badge rx-nav-badge--red ml-auto">
                    {billingBadge.displayCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate("doctors")}
                onMouseEnter={() => prefetchReceptionistTab("doctors")}
                className={`rx-nav-item ${activeTab === "doctors" ? "rx-nav-item--active" : ""}`}
              >
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span>Doctors</span>
              </button>
            </div>
          </div>

          {/* Workspace group */}
          <div className="rx-nav-group mt-4">
            <span className="rx-nav-group-label">Workspace</span>
            <div className="space-y-0.5 mt-1.5">
              <button
                onClick={() => navigate("whatsapp-bookings")}
                onMouseEnter={() => prefetchReceptionistTab("whatsapp-bookings")}
                className={`rx-nav-item ${activeTab === "whatsapp-bookings" ? "rx-nav-item--active" : ""}`}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>WhatsApp Bookings</span>
                {whatsappBadge.displayCount > 0 && (
                  <span className="rx-nav-badge rx-nav-badge--amber ml-auto">
                    {whatsappBadge.displayCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate("documents")}
                onMouseEnter={() => prefetchReceptionistTab("documents")}
                className={`rx-nav-item ${activeTab === "documents" ? "rx-nav-item--active" : ""}`}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span>Documents</span>
              </button>
            </div>
          </div>

          {/* Quick actions group */}
          <div className="rx-nav-group mt-4">
            <span className="rx-nav-group-label">Quick Actions</span>
            <div className="mt-1.5">
              <button
                onClick={() => {
                  if (!bookSubOpen) navigate("book-appointment")
                  setBookSubOpen(!bookSubOpen)
                }}
                onMouseEnter={() => prefetchReceptionistTab("book-appointment")}
                className={`rx-nav-item rx-nav-item--cta ${
                  activeTab === "book-appointment" ? "rx-nav-item--active rx-nav-item--cta" : ""
                }`}
              >
                <CalendarPlus className="w-4 h-4 shrink-0" />
                <span>Book Appointment</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 ml-auto transition-transform duration-200 ${
                    bookSubOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {bookSubOpen && (
                <div className="ml-5 pl-3 mt-1 space-y-0.5 border-l border-slate-200">
                  <button
                    onClick={() => {
                      navigate("book-appointment")
                      setPatientMode("existing")
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "book-appointment" && patientMode === "existing"
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Existing Patient
                  </button>
                  <button
                    onClick={() => {
                      navigate("book-appointment")
                      setPatientMode("new")
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "book-appointment" && patientMode === "new"
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    New Patient
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* User / sign-out */}
        <div className="border-t border-slate-200 p-3 shrink-0">
          <div className="flex items-center gap-2.5 px-1.5 py-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-cyan-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-400">Receptionist</p>
            </div>
          </div>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Compact sticky header */}
        <header className="rx-header">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 truncate">
              {TAB_TITLES[activeTab]}
            </h1>
          </div>

          {/* Greeting + Date/Time (desktop) */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {getGreetingTime()}, {displayName}
            </span>
            <span className="w-px h-3 bg-slate-200" />
            <span className="text-xs text-slate-400 tabular-nums">
              {dateStr} · {currentTime}
            </span>
          </div>
        </header>

        {/* Tab content — sidebar/header stay mounted; panels cached after first visit */}
        <main className="rx-page space-y-5">
          {(authError || authTimedOut) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-sm font-semibold text-amber-800">
                {authTimedOut ? "Authentication timed out." : "Authentication error."}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                {authError || "Please refresh the page or sign in again."}
              </p>
              <button
                type="button"
                onClick={() => router.replace("/auth/login?role=receptionist")}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Return to Login
              </button>
            </div>
          ) : (
          <ReceptionistTabPanels
            activeTab={activeTab}
            visitedTabs={visitedTabs}
            isShellReady={isShellReady}
            receptionistBranchId={receptionistBranchId}
            userName={displayName}
            patientSubTab={patientSubTab}
            onPatientSubTabChange={setPatientSubTab}
            patientMode={patientMode}
            onPatientModeChange={setPatientMode}
            billingFocusQuery={billingFocusQuery}
            onBillingFocusHandled={() => setBillingFocusQuery(null)}
            onNotification={(payload) => setNotification(payload)}
            onTabChange={(tab) => navigate(tab)}
            onOpenBilling={(admissionId) => {
              setBillingFocusQuery(admissionId)
              navigate("billing")
            }}
            onWhatsappPendingCountChange={setWhatsappPendingCount}
          />
          )}
        </main>
      </div>

      {/* Global notifications */}
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
        message="Logging out will return you to the receptionist login screen."
        confirmText="Logout"
        cancelText="Stay signed in"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
        confirmLoading={logoutLoading}
      />
    </div>
  )
}
