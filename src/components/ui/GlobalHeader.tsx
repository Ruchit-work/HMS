"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { auth, db } from "@/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { useRouter, usePathname } from "next/navigation"
import { getUserData } from "@/utils/userHelpers"
import ConfirmDialog from "./ConfirmDialog"
import NotificationBadge from "./NotificationBadge"

export default function GlobalHeader() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [appointmentCount, setAppointmentCount] = useState(0)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Routes that don't need the header
  const noHeaderRoutes = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password"]
  const shouldShowHeader = !noHeaderRoutes.includes(pathname)

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
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

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
    }, (error) => {
      console.error("Error fetching appointments:", error)
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
    } catch (e) {
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
    { href: "/doctor-dashboard/about", label: "About" }
  ]

  const navLinks = isPatient ? patientLinks : doctorLinks

  return (
    <>
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-sm bg-white/95 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            href={isDoctor ? "/doctor-dashboard" : isPatient ? "/patient-dashboard" : "/"}
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
              <span className="font-bold text-base sm:text-lg">H</span>
            </div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800">
              HMS
            </h1>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
            {navLinks.map((link) => (
              <div key={link.href} className="relative">
                <Link 
                  href={link.href} 
                  className={`text-sm font-medium transition-colors whitespace-nowrap ${
                    pathname === link.href 
                      ? 'text-slate-800 border-b-2 border-slate-800' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
                {link.showBadge && isDoctor && appointmentCount > 0 && (
                  <NotificationBadge 
                    count={appointmentCount} 
                    size="sm" 
                    position="top-right"
                    className="translate-x-2 -translate-y-1"
                  />
                )}
              </div>
            ))}
          </nav>

          {/* Right Side: Mobile Menu Button + Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-all duration-300 hover:scale-105 active:scale-95"
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

            {/* Profile Button with Hover Dropdown */}
            <div 
              ref={userMenuRef}
              className="relative"
              onMouseEnter={() => setShowUserDropdown(true)}
            >
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:block font-medium">Profile</span>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      {showMobileMenu && (
        <div 
          ref={mobileMenuRef}
          className="lg:hidden border-t border-slate-200 bg-white shadow-lg animate-slide-down overflow-hidden"
        >
          <nav className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-1">
            {navLinks.map((link, index) => (
              <div key={link.href} className="relative">
                <Link
                  href={link.href}
                  onClick={handleNavClick}
                  className={`block px-4 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-sm animate-slide-in-right ${
                    pathname === link.href
                      ? 'bg-slate-100 text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {link.label}
                </Link>
                {link.showBadge && isDoctor && appointmentCount > 0 && (
                  <NotificationBadge 
                    count={appointmentCount} 
                    size="sm" 
                    position="top-right"
                    className="translate-x-2 -translate-y-1"
                  />
                )}
              </div>
            ))}
          </nav>
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


