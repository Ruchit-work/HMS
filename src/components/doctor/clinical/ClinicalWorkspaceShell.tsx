"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/firebase/config"
import { onSnapshot, query, where } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"
import NotificationBadge from "@/components/ui/feedback/NotificationBadge"
import { useNotificationBadge } from "@/hooks/useNotificationBadge"
import {
  getActiveDoctorNavId,
  getDoctorNavSections,
  getDoctorPageMeta,
  type DoctorNavId,
} from "@/app/doctor-dashboard/doctorNavConfig"
import {
  Home,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react"

const navIcons: Record<DoctorNavId, React.ReactNode> = {
  queue: <Stethoscope className="w-5 h-5 shrink-0" />,
  home: <Home className="w-5 h-5 shrink-0" />,
  inpatients: <Users className="w-5 h-5 shrink-0" />,
  settings: <Settings className="w-5 h-5 shrink-0" />,
  book: <Settings className="w-5 h-5 shrink-0" />,
  documents: <Settings className="w-5 h-5 shrink-0" />,
  analytics: <Settings className="w-5 h-5 shrink-0" />,
  profile: <Settings className="w-5 h-5 shrink-0" />,
  about: <Settings className="w-5 h-5 shrink-0" />,
}

export default function ClinicalWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth("doctor")
  const { activeHospitalId } = useMultiHospital()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [appointmentCount, setAppointmentCount] = useState(0)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const activeId = getActiveDoctorNavId(pathname || "")
  const appointmentsBadge = useNotificationBadge({
    badgeKey: "doctor-appointments",
    rawCount: appointmentCount,
    pathname: pathname || "",
  })

  useEffect(() => {
    if (!user?.uid || !activeHospitalId) {
      setAppointmentCount(0)
      return
    }

    const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
    const q = query(
      appointmentsRef,
      where("doctorId", "==", user.uid),
      where("status", "==", "confirmed")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAppointmentCount(snapshot.size)
    })

    return () => unsubscribe()
  }, [user?.uid, activeHospitalId])

  const displayName =
    user?.data?.firstName && user?.data?.lastName
      ? `Dr. ${user.data.firstName} ${user.data.lastName}`
      : user?.email?.split("@")[0] || "Doctor"

  const specialization =
    typeof user?.data?.specialization === "string" ? user.data.specialization : "Physician"

  const navSections = useMemo(() => getDoctorNavSections(), [])

  const performLogout = async () => {
    setLogoutLoading(true)
    try {
      await signOut(auth)
      window.location.href = "/auth/login?role=doctor"
    } finally {
      setLogoutLoading(false)
    }
  }

  const pageMeta = getDoctorPageMeta(pathname || "")

  return (
    <div className="clinical-workspace-shell hms-portal-shell">
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
          aria-label="Open menu"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5 gap-1">
            <span className="block w-5 h-0.5 bg-slate-600 rounded-full" />
            <span className="block w-5 h-0.5 bg-slate-600 rounded-full" />
            <span className="block w-5 h-0.5 bg-slate-600 rounded-full" />
          </div>
        </button>
      )}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`clinical-workspace-sidebar fixed inset-y-0 left-0 z-40 w-64 hms-sidebar flex flex-col transform transition-transform duration-300 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="hms-sidebar-header flex h-[76px] shrink-0 items-center justify-between px-5">
          <Link href="/doctor-dashboard/appointments" className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/15">
              <Stethoscope className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-slate-900 text-sm font-semibold truncate">Clinical Workspace</h1>
              <p className="text-slate-500 text-xs truncate">HMS Doctor Portal</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 flex flex-col pt-3 px-3 overflow-y-auto space-y-4">
          {navSections.map((section) => (
            <div key={section.title ?? "settings"}>
              {section.title && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
              )}
              <div className={`space-y-0.5 ${!section.title ? "mt-2 pt-2 border-t border-slate-200/80" : ""}`}>
                {section.items.map((item) => {
                  const isActive = activeId === item.id
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`shrink-0 ${
                            isActive ? "text-[var(--color-primary)]" : "text-slate-400"
                          }`}
                        >
                          {navIcons[item.id]}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.showBadge && appointmentsBadge.displayCount > 0 ? (
                        <NotificationBadge count={appointmentsBadge.displayCount} />
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200/80" ref={userMenuRef}>
          <div className="rounded-xl bg-white/60 border border-slate-200/80 px-3 py-3">
            <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{specialization}</p>
            <div className="mt-2 flex gap-2">
              <Link
                href="/doctor-dashboard/settings"
                className="flex-1 text-center text-xs font-medium text-slate-600 hover:text-slate-900 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Settings
              </Link>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex-1 text-center text-xs font-medium text-rose-600 hover:text-rose-800 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="clinical-workspace-topbar hms-sticky-header">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3">
            <div className="min-w-0 pl-10 lg:pl-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {pageMeta.subtitle}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 truncate">
                {pageMeta.label}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {appointmentCount > 0 && activeId !== "queue" && (
                <Link
                  href="/doctor-dashboard/appointments"
                  className="hidden sm:inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {appointmentCount} waiting
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 clinical-workspace-main">{children}</main>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={performLogout}
        title="Log out?"
        message="You will need to sign in again to access the clinical workspace."
        confirmText="Log out"
        cancelText="Stay"
        confirmLoading={logoutLoading}
      />
    </div>
  )
}
