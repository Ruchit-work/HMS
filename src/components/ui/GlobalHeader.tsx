"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { auth, db } from "@/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { useRouter, usePathname } from "next/navigation"
import { getUserData } from "@/utils/userHelpers"
import { ConfirmDialog } from "./Modals"
import NotificationBadge from "./NotificationBadge"
import { useNotificationBadge } from "@/hooks/useNotificationBadge"

export default function GlobalHeader() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [appointmentCount, setAppointmentCount] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Notification badge hook - automatically clear when appointments page is viewed
  const appointmentsBadge = useNotificationBadge({ 
    badgeKey: 'doctor-appointments', 
    rawCount: appointmentCount, 
    pathname 
  })

  // Routes that don't need the header
  const noHeaderRoutes = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password"]
  const shouldShowHeader = !noHeaderRoutes.includes(pathname)

  // Scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      setIsScrolled(scrollPosition > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Use the existing auth state from Firebase
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        // Only fetch data if we don't have it yet
        if (!userData) {
          const data = await getUserData(currentUser.uid)
          if (data) {
            setUserData(data)
          }
        }
      } else {
        setUser(null)
        setUserData(null)
        setAppointmentCount(0)
      }
    })

    return () => unsubscribe()
  }, [userData])

  // Set up real-time appointment listener for doctors
  useEffect(() => {
    if (!user?.uid || !userData?.role || userData.role !== 'doctor') {
      setAppointmentCount(0)
      return
    }

    const appointmentsRef = collection(db, "appointments")
    const q = query(
      appointmentsRef, 
      where("doctorId", "==", user.uid),
      where("status", "==", "confirmed")
    )
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const confirmedAppointments = snapshot.docs.filter(doc => {
        const data = doc.data()
        // Filter out WhatsApp pending appointments
        return data.status === "confirmed" && !data.whatsappPending
      })
      setAppointmentCount(confirmedAppointments.length)
    }, () => {
      setAppointmentCount(0)
    })

    return () => unsubscribe()
  }, [user?.uid, userData?.role])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // Don't close mobile menu if clicking the hamburger button or inside the menu
      if (showMobileMenu) {
        const isHamburgerButton = (target as Element).closest('[data-mobile-menu-button]')
        const isInsideMenu = mobileMenuRef.current && mobileMenuRef.current.contains(target)
        
        if (!isHamburgerButton && !isInsideMenu) {
          setShowMobileMenu(false)
        }
      }
    }

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMobileMenu])

  // Close user dropdown on outside click or Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!showUserDropdown) return
      const target = e.target as Node
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserDropdown(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [showUserDropdown])


  const handleEditProfile = () => {
    setShowMobileMenu(false)
    if (userData?.role === "doctor") {
      router.push("/doctor-dashboard/profile")
    } else {
      router.push("/patient-dashboard/profile")
    }
  }

  const handleNavClick = () => {
    setShowMobileMenu(false)
  }

  const handleLogoutConfirm = async () => {
    try {
      setLogoutLoading(true)
      await signOut(auth)
      setShowUserDropdown(false)
      const role = userData?.role
      if (role) {
        router.replace(`/auth/login?role=${role}`)
      } else {
        router.replace("/auth/login")
      }
    } catch {
      // optional: surface error feedback later
    } finally {
      setLogoutLoading(false)
      setShowLogoutConfirm(false)
    }
  }

  if (!shouldShowHeader) {
    return null
  }

  if (!user || !userData) {
    return null
  }

  const isDoctor = userData.role === "doctor"
  const isPatient = userData.role === "patient"

  type NavLink = {
    href: string
    label: string
    showBadge?: boolean
  }

  const patientLinks: NavLink[] = [
    { href: "/patient-dashboard", label: "Home" },
    { href: "/patient-dashboard/book-appointment", label: "Book Appointment" },
    { href: "/patient-dashboard/doctors", label: "Doctors" },
    { href: "/patient-dashboard/services", label: "Services" },
    { href: "/patient-dashboard/facilities", label: "Facilities" },
    { href: "/patient-dashboard/appointments", label: "Appointments" },
    { href: "/patient-dashboard/about", label: "About & Support" }
  ]

  const doctorLinks: NavLink[] = [
    { href: "/doctor-dashboard", label: "Home" },
    { href: "/doctor-dashboard/appointments", label: "Appointments", showBadge: true },
    { href: "/doctor-dashboard/documents", label: "Documents & Reports" },
    { href: "/doctor-dashboard/analytics", label: "Analytics" },
    { href: "/doctor-dashboard/about", label: "About" }
  ]

  const navLinks = isPatient ? patientLinks : doctorLinks

  return (
    <>
    <header 
      className={`fixed top-0 left-0 right-0 z-40 w-full rounded-none transition-all duration-300 ease-in-out ${
        isScrolled 
          ? 'bg-white/98 backdrop-blur-lg border-b border-slate-200/80 shadow-2xl py-2' 
          : 'bg-white/80 backdrop-blur-sm border-b border-slate-200/40 shadow-lg py-3'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Logo - Fixed width to prevent overlap */}
          <Link 
            href={isDoctor ? "/doctor-dashboard" : isPatient ? "/patient-dashboard" : "/"}
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-all duration-300 cursor-pointer flex-shrink-0"
          >
            <div className={`bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center text-white shadow-md transition-all duration-300 ${
              isScrolled ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-8 h-8 sm:w-10 sm:h-10'
            }`}>
              <span className={`font-bold transition-all duration-300 ${
                isScrolled ? 'text-base' : 'text-base sm:text-lg'
              }`}>H</span>
            </div>
            <h1 className={`font-bold text-slate-800 transition-all duration-300 whitespace-nowrap ${
              isScrolled ? 'text-base sm:text-lg lg:text-xl' : 'text-lg sm:text-xl lg:text-2xl'
            }`}>
              HMS
            </h1>
          </Link>
          
          {/* Desktop Navigation - Centered with proper spacing */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6 flex-1 justify-center mx-4">
            {navLinks.map((link) => (
              <div key={link.href} className="relative">
                <Link
                  href={link.href}
                  className={`text-sm xl:text-base font-medium transition-colors whitespace-nowrap relative pb-1 px-2 ${
                    pathname === link.href
                      ? "text-slate-800"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {link.label}
                  {/* Active underline */}
                  {pathname === link.href && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></span>
                  )}
                </Link>
                {/* Notification badge only for doctor */}
                {link.showBadge &&
                  isDoctor &&
                  appointmentsBadge.displayCount > 0 && (
                    <NotificationBadge
                      count={appointmentsBadge.displayCount}
                      size="sm"
                      position="top-right"
                      className="translate-x-2 -translate-y-1"
                    />
                  )}
              </div>
            ))}
          </nav>

          {/* Right Side: Mobile Menu Button + Profile & Logout - Fixed width */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={showMobileMenu ? "Close menu" : "Open menu"}
              data-mobile-menu-button
            >
              <div className="relative w-6 h-6">
                {/* Hamburger Icon */}
                <svg 
                  className={`absolute inset-0 w-6 h-6 text-slate-700 transition-all duration-300 ${
                    showMobileMenu ? 'opacity-0 rotate-180' : 'opacity-100 rotate-0'
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                
                {/* Close Icon */}
                <svg 
                  className={`absolute inset-0 w-6 h-6 text-slate-700 transition-all duration-300 ${
                    showMobileMenu ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-180'
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </button>

            {/* Profile Button with Click Dropdown */}
            <div 
              ref={userMenuRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:block font-medium text-sm sm:text-base">Profile</span>
                <svg className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${showUserDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-200">
                    <p className="text-sm font-semibold text-slate-900">
                      {userData.firstName || (user.email || '').split('@')[0]}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEditProfile}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>View Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false)
                      setShowLogoutConfirm(true)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-100/70 active:bg-red-100 rounded-md transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {/* MOBILE MENU */}
      {showMobileMenu && (
        <div
          ref={mobileMenuRef}
          className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-xl py-4 px-4 z-40"
        >
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleNavClick}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  {link.label}
                  {link.showBadge &&
                    isDoctor &&
                    appointmentsBadge.displayCount > 0 && (
                      <NotificationBadge
                        count={appointmentsBadge.displayCount}
                        size="sm"
                        position="top-right"
                      />
                    )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>

    <ConfirmDialog
      isOpen={showLogoutConfirm}
      title="Sign out?"
      message="You'll need to log in again to access the dashboard."
      confirmText="Logout"
      cancelText="Stay signed in"
      onConfirm={handleLogoutConfirm}
      onCancel={() => setShowLogoutConfirm(false)}
      confirmLoading={logoutLoading}
    />
    </>
  )
}


