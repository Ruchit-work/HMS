"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { auth } from "@/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { useRouter, usePathname } from "next/navigation"
import { getUserData } from "@/utils/userHelpers"

export default function GlobalHeader() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Routes that don't need the header
  const noHeaderRoutes = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password"]
  const shouldShowHeader = !noHeaderRoutes.includes(pathname)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const data = await getUserData(currentUser.uid)
        if (data) {
          setUserData(data)
        }
        setUser(currentUser)
      } else {
        setUser(null)
        setUserData(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

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

  if (!shouldShowHeader) {
    return null
  }

  if (!user || !userData) {
    return null
  }

  const isDoctor = userData.role === "doctor"
  const isPatient = userData.role === "patient"

  const patientLinks = [
    { href: "/patient-dashboard", label: "Home" },
    { href: "/patient-dashboard/book-appointment", label: "Book Appointment" },
    { href: "/patient-dashboard/doctors", label: "Doctors" },
    { href: "/patient-dashboard/services", label: "Services" },
    { href: "/patient-dashboard/facilities", label: "Facilities" },
    { href: "/patient-dashboard/appointments", label: "Appointments" },
    { href: "/patient-dashboard/about", label: "About & Support" }
  ]

  const doctorLinks = [
    { href: "/doctor-dashboard", label: "Home" },
    { href: "/doctor-dashboard/appointments", label: "Appointments" },
    { href: "/doctor-dashboard/about", label: "About" }
  ]

  const navLinks = isPatient ? patientLinks : doctorLinks

  return (
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
              <Link 
                key={link.href}
                href={link.href} 
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  pathname === link.href 
                    ? 'text-slate-800 border-b-2 border-slate-800' 
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {link.label}
              </Link>
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

            {/* Profile Button */}
            <button
              onClick={handleEditProfile}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:block font-medium">Profile</span>
            </button>
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
              <Link
                key={link.href}
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
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
