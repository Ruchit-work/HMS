"use client"

import { useState, useEffect, Suspense, useRef } from "react"
import Link from "next/link"
import { auth, db } from "@/firebase/config"
import { signInWithEmailAndPassword, type User } from "firebase/auth"
import { getDoc, doc, collection, getDocs, setDoc } from "firebase/firestore"
import { useRouter, useSearchParams } from "next/navigation"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"

type DashboardRole = "patient" | "doctor" | "admin" | "receptionist"
const STAFF_ROLES: DashboardRole[] = ["admin", "doctor", "receptionist"]

function LoginContent() {
  const searchParams = useSearchParams()
  const role = searchParams.get("role") as DashboardRole | null
  
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpError, setOtpError] = useState("")
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [pendingUser, setPendingUser] = useState<User | null>(null)
  const [, setPendingRole] = useState<DashboardRole | null>(null)
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null)
  const [pendingPhone, setPendingPhone] = useState<string>("")
  const router = useRouter()
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Protect route - redirect if already authenticated
  const { loading: checking } = usePublicRoute()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check if user is authenticated but needs MFA
  useEffect(() => {
    const checkMfaStatus = async () => {
      const currentUser = auth.currentUser
      if (!currentUser) {
        setIsCheckingAuth(false)
        return
      }

      // Check if user needs MFA
      try {
        const roleInfo = await determineUserRole(currentUser)
        if (roleInfo && STAFF_ROLES.includes(roleInfo.role)) {
          const tokenResult = await currentUser.getIdTokenResult(true)
          const authTime = tokenResult?.claims?.auth_time ? String(tokenResult.claims.auth_time) : null
          const mfaDoc = await getDoc(doc(db, "mfaSessions", currentUser.uid))
          const storedAuthTime = mfaDoc.exists() ? String(mfaDoc.data()?.authTime || "") : ""

          // If MFA is required but not completed, show MFA form
          if (!authTime || !storedAuthTime || storedAuthTime !== authTime) {
            // Get phone number from user data
            const userData = roleInfo.data
            const phone = userData?.phone || userData?.phoneNumber || ""
            if (phone) {
              setPendingUser(currentUser)
              setPendingRole(roleInfo.role)
              setPendingPhone(phone)
              setMfaRequired(true)
              // Auto-send OTP (defined later in file, but will be available when effect runs)
              setTimeout(() => {
                const sendOtp = async () => {
                  setOtpSending(true)
                  setOtpError("")
                  try {
                    const response = await fetch("/api/auth/send-otp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phoneNumber: phone }),
                    })
                    const data = await response.json().catch(() => ({}))
                    if (!response.ok) {
                      throw new Error(data?.error || "Failed to send OTP")
                    }
                    setSuccess("Security code sent successfully.")
                    setOtpCountdown(45)
                  } catch (err: any) {
                    setOtpError(err?.message || "Failed to send OTP")
                  } finally {
                    setOtpSending(false)
                  }
                }
                sendOtp()
              }, 100)
            }
          }
        }
      } catch {
        // If check fails, just continue with normal login
      }
      
      setIsCheckingAuth(false)
    }

    if (!checking) {
      checkMfaStatus()
    }
  }, [checking])

  // Handle pageshow event (back button) - re-check auth immediately
  useEffect(() => {
    const handlePageshow = () => {
      setIsCheckingAuth(true)
      // The usePublicRoute hook will handle the redirect
    }
    
    window.addEventListener('pageshow', handlePageshow)
    return () => window.removeEventListener('pageshow', handlePageshow)
  }, [])

  useEffect(() => {
    if (otpCountdown <= 0) return
    const interval = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [otpCountdown])

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])

  const maskPhoneNumber = (phone: string) => {
    if (!phone) return ""
    const clean = phone.replace(/\D/g, "")
    if (clean.length <= 4) return phone
    const lastFour = clean.slice(-4)
    return `**** **** ${lastFour}`
  }

  const determineUserRole = async (user: User) => {
    // Check users collection first (multi-hospital support)
    const userDoc = await getDoc(doc(db, "users", user.uid))
    let isSuperAdmin = false
    let hospitals: string[] = []
    let activeHospital: string | null = null

    if (userDoc.exists()) {
      const userData = userDoc.data()
      hospitals = userData?.hospitals || []
      activeHospital = userData?.activeHospital || null
      isSuperAdmin = userData?.role === "super_admin"
    }

    // Check admin collection first
    const adminDoc = await getDoc(doc(db, "admins", user.uid))
    if (adminDoc.exists()) {
      const adminData = adminDoc.data()
      // If super admin, redirect to super admin dashboard
      if (isSuperAdmin || adminData?.isSuperAdmin) {
        return { 
          role: "admin" as DashboardRole, 
          data: adminData, 
          redirect: "/admin-dashboard",
          isSuperAdmin: true,
          hospitals,
          activeHospital
        }
      }
      return { 
        role: "admin" as DashboardRole, 
        data: adminData, 
        redirect: "/admin-dashboard",
        hospitals: hospitals.length > 0 ? hospitals : (adminData?.hospitalId ? [adminData.hospitalId] : []),
        activeHospital: activeHospital || adminData?.hospitalId || null
      }
    }

    // Check doctor collection
    const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
    if (doctorDoc.exists()) {
      const doctorData = doctorDoc.data()
      if (doctorData.status === "pending") {
        throw new Error(
          "Your account is pending admin approval. Please wait for approval before logging in. You will be notified once your account is approved."
        )
      }
      return { 
        role: "doctor" as DashboardRole, 
        data: doctorData, 
        redirect: "/doctor-dashboard",
        hospitals: hospitals.length > 0 ? hospitals : (doctorData?.hospitalId ? [doctorData.hospitalId] : []),
        activeHospital: activeHospital || doctorData?.hospitalId || null
      }
    }

    // Check patient collection
    const patientDoc = await getDoc(doc(db, "patients", user.uid))
    if (patientDoc.exists()) {
      return { 
        role: "patient" as DashboardRole, 
        data: patientDoc.data(), 
        redirect: "/patient-dashboard",
        hospitals,
        activeHospital
      }
    }

    // Check receptionist collection
    const receptionistDoc = await getDoc(doc(db, "receptionists", user.uid))
    if (receptionistDoc.exists()) {
      const receptionistData = receptionistDoc.data()
      return {
        role: "receptionist" as DashboardRole,
        data: receptionistData,
        redirect: "/receptionist-dashboard",
        hospitals: hospitals.length > 0 ? hospitals : (receptionistData?.hospitalId ? [receptionistData.hospitalId] : []),
        activeHospital: activeHospital || receptionistData?.hospitalId || null
      }
    }

    return null
  }

  const checkAndRedirectWithHospital = async (roleInfo: any, user: User) => {
    // Determine redirect path first
    let redirectPath = roleInfo.redirect
    
    // Sync user document in users collection (for multi-hospital support)
    // This ensures super admin status and hospital associations are properly synced
    try {
      const userDocRef = doc(db, "users", user.uid)
      const userDoc = await getDoc(userDocRef)
      
      // If super admin, fetch all hospitals and sync to users collection
      if (roleInfo.isSuperAdmin) {
        const hospitalsSnapshot = await getDocs(collection(db, "hospitals"))
        const allHospitalIds = hospitalsSnapshot.docs
          .filter(doc => doc.data().status === "active")
          .map(doc => doc.id)
        
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || "",
          role: "super_admin",
          hospitals: allHospitalIds,
          activeHospital: roleInfo.activeHospital || (allHospitalIds.length > 0 ? allHospitalIds[0] : null),
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      } else if (!userDoc.exists() && roleInfo.role === "admin") {
        // Sync regular admin to users collection
        const adminData = roleInfo.data || {}
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || adminData.email || "",
          role: "admin",
          hospitals: roleInfo.hospitals || (adminData?.hospitalId ? [adminData.hospitalId] : []),
          activeHospital: roleInfo.activeHospital || adminData?.hospitalId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      }
    } catch {
      // Don't block login if sync fails
    }
    
    // For patients, check hospital selection
    if (roleInfo.role === "patient") {
      const hospitals = roleInfo.hospitals || []
      
      if (hospitals.length === 0) {
        // No hospitals - redirect to hospital selection (no countdown needed)
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        setSuccess("")
        router.replace("/hospital-selection?redirect=" + roleInfo.redirect)
        return
      } else if (hospitals.length === 1) {
        // One hospital - auto-select and continue
        const hospitalId = hospitals[0]
        if (!roleInfo.activeHospital || roleInfo.activeHospital !== hospitalId) {
          // Set active hospital
          try {
            const token = await user.getIdToken()
            await fetch("/api/user/select-hospital", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({ hospitalId }),
            })
            sessionStorage.setItem("activeHospitalId", hospitalId)
          } catch {
          }
        }
        redirectPath = roleInfo.redirect
      } else {
        // Multiple hospitals - check if activeHospital is set and valid
        const activeHospital = roleInfo.activeHospital
        if (activeHospital && hospitals.includes(activeHospital)) {
          // Valid active hospital - continue with countdown
          redirectPath = roleInfo.redirect
        } else {
          // No valid active hospital - redirect to selection (no countdown)
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          setSuccess("")
          router.replace("/hospital-selection?redirect=" + roleInfo.redirect)
          return
        }
      }
    }

    // For staff (admin/doctor/receptionist), they belong to one hospital - auto-select
    if (STAFF_ROLES.includes(roleInfo.role)) {
      const hospitals = roleInfo.hospitals || []
      if (hospitals.length > 0) {
        const hospitalId = hospitals[0] // Staff has one hospital
        if (!roleInfo.activeHospital || roleInfo.activeHospital !== hospitalId) {
          try {
            const token = await user.getIdToken()
            await fetch("/api/user/select-hospital", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({ hospitalId }),
            })
            sessionStorage.setItem("activeHospitalId", hospitalId)
          } catch {
          }
        }
      }
      redirectPath = roleInfo.redirect
    }

    // Start countdown with the determined redirect path immediately
    dispatchCountdownMessage("Login successful!", () => router.replace(redirectPath), 3)
  }

  const sendOtpCode = async (phoneOverride?: string) => {
    const phoneNumber = phoneOverride || pendingPhone
    if (!phoneNumber) {
      setOtpError("Phone number not found on file. Please contact an administrator.")
      return
    }
    setOtpSending(true)
    setOtpError("")
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send OTP. Please try again.")
      }
      setSuccess("Security code sent successfully.")
      setOtpCountdown(45)
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send OTP. Please try again.")
    } finally {
      setOtpSending(false)
    }
  }


  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingPhone || !pendingUser) {
      setOtpError("Session expired. Please sign in again.")
      await auth.signOut()
      setMfaRequired(false)
      return
    }

    setOtpError("")
    setOtpVerifying(true)
    try {
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: pendingPhone, otp: otpCode }),
      })
      const verifyData = await verifyResponse.json().catch(() => ({}))
      if (!verifyResponse.ok) {
        throw new Error(verifyData?.error || "Invalid OTP. Please try again.")
      }

      const tokenResult = await pendingUser.getIdTokenResult(true)
      const authTime = tokenResult?.claims?.auth_time ? String(tokenResult.claims.auth_time) : null
      if (!authTime) {
        throw new Error("Unable to validate this session. Please sign in again.")
      }

      const token = await pendingUser.getIdToken(true)
      const markResponse = await fetch("/api/auth/mark-mfa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ authTime }),
      })
      const markData = await markResponse.json().catch(() => ({}))
      if (!markResponse.ok) {
        throw new Error(markData?.error || "Failed to finalize verification. Please try again.")
      }

      setMfaRequired(false)
      setOtpCode("")
      setOtpCountdown(0)
      
      // Re-determine role after OTP verification and check hospitals
      const roleInfo = await determineUserRole(pendingUser)
      if (roleInfo) {
        await checkAndRedirectWithHospital(roleInfo, pendingUser)
      } else {
        // Clear any existing countdown
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
        }
        dispatchCountdownMessage("Login successful!", () =>
          router.replace(pendingRedirect || "/")
        , 3)
      }
    } catch (err: any) {
      const message = err?.message || "Failed to verify OTP. Please try again."
      setOtpError(message)
      if (message.toLowerCase().includes("sign in again")) {
        await auth.signOut()
        setMfaRequired(false)
      }
    } finally {
      setOtpVerifying(false)
    }
  }

  const handleCancelMfa = async () => {
    setMfaRequired(false)
    setPendingUser(null)
    setPendingRole(null)
    setPendingPhone("")
    setPendingRedirect(null)
    setOtpCode("")
    setOtpError("")
    setSuccess("")
    await auth.signOut()
  }

  const resolveIdentifierToEmail = async (input: string, roleHint: DashboardRole | null) => {
    if (!input.trim()) {
      throw new Error("Please enter your email address or phone number.")
    }
    if (input.includes("@")) {
      return input.trim().toLowerCase()
    }

    const response = await fetch("/api/auth/lookup-identifier", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: input,
        role: roleHint,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || "Unable to find an account for that phone number.")
    }

    if (!data?.email) {
      throw new Error("Account lookup failed. Please try your email address.")
    }

    return String(data.email).trim().toLowerCase()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)
    
    try {
      const loginEmail = await resolveIdentifierToEmail(identifier, role)
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password)
      const user = userCredential.user
      const roleInfo = await determineUserRole(user)

      if (!roleInfo) {
        setError("Account not found. Please sign up first.")
        await auth.signOut()
        setLoading(false)
        return
      }

      // Show loading complete
      setLoading(false)
      
      // Show success message immediately - this ensures it appears right away
      setSuccess("Login successful! Redirecting in 3...")
      
      // Check hospitals and redirect accordingly (this will update the countdown)
      // Use setTimeout to ensure the success message is rendered first
      setTimeout(async () => {
        await checkAndRedirectWithHospital(roleInfo, user)
      }, 100)
      return
    } catch (err) {
      const firebaseError = err as { code?: string; message?: string }
      let errorMessage = "Failed to sign in"
      
      switch (firebaseError.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          errorMessage = "Invalid email or password. Please check your credentials and try again."
          break
        case "auth/invalid-email":
          errorMessage = "Invalid email address. Please enter a valid email."
          break
        case "auth/user-disabled":
          errorMessage = "This account has been disabled. Please contact support."
          break
        case "auth/too-many-requests":
          errorMessage = "Too many failed login attempts. Please try again later."
          break
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your internet connection."
          break
        default:
          errorMessage = firebaseError.message || "Failed to sign in. Please try again."
      }
      if (!firebaseError.code && firebaseError.message) {
        errorMessage = firebaseError.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const dispatchCountdownMessage = (message: string, onComplete: () => void, seconds = 3) => {
    // Clear any existing countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    
    // Show message immediately
    setSuccess(`${message} Redirecting in ${seconds}...`)
    
    let remaining = seconds
    const interval = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setSuccess(`${message} Redirecting in ${remaining}...`)
      } else {
        clearInterval(interval)
        countdownIntervalRef.current = null
        // Clear success message before redirecting
        setSuccess("")
        // Small delay to ensure UI updates
        setTimeout(() => {
          onComplete()
        }, 100)
      }
    }, 1000)
    
    countdownIntervalRef.current = interval
  }

  if (checking || isCheckingAuth) {
    return <LoadingSpinner />
  }

  const otpMaskedPhone = pendingPhone ? maskPhoneNumber(pendingPhone) : ""

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
        <div className="w-full max-w-sm sm:max-w-md animate-fade-in">
          <div className="text-center mb-6">
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">H</span>
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-900">HMS</h1>
                <p className="text-xs text-slate-500 font-medium">Hospital Management System</p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 mb-4 py-4 border-y border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Secure Login</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg className="w-4 h-4 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
              </svg>
              <span className="font-medium">Encrypted</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 p-4 mb-6 rounded-xl shadow-lg animate-shake-fade-in">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce-in">
                  <span className="text-white text-lg font-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-semibold leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => setError("")}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Close error"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 mb-6 rounded-xl shadow-lg animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce-in">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-green-800 font-semibold leading-relaxed">{success}</p>
                </div>
                <button
                  onClick={() => setSuccess("")}
                  className="flex-shrink-0 text-green-400 hover:text-green-600 transition-colors"
                  aria-label="Close success message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* Login Form */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl">
            {!mfaRequired ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address or Phone Number
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                      placeholder={
                        role === "doctor"
                          ? "doctor@hospital.com / +91 98765 43210"
                          : role === "admin"
                          ? "admin@hospital.com / +91 98765 43210"
                          : role === "receptionist"
                          ? "receptionist@hospital.com / +91 98765 43210"
                          : role === "patient"
                          ? "patient@email.com / 9876543210"
                          : "Email or phone"
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Password
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg
                      focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200
                      bg-white text-slate-900 placeholder:text-slate-400
                      transition-all duration-200"
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-modern btn-modern-success w-full"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-700 font-semibold mb-1">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-600">
                    Enter the 6-digit security code we sent to{" "}
                    <span className="font-semibold">{otpMaskedPhone}</span> to verify your identity.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Security Code
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center tracking-widest text-2xl py-3 border-2 border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 bg-white text-slate-900 transition-all duration-200"
                    placeholder="••••••"
                    required
                  />
                </div>

                {otpError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{otpError}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => sendOtpCode()}
                    disabled={otpSending || otpCountdown > 0}
                    className="text-cyan-600 font-semibold disabled:opacity-50"
                  >
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : otpSending ? "Sending..." : "Resend Code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelMfa}
                    className="text-slate-500 hover:text-slate-700 transition-colors font-medium"
                  >
                    Cancel &amp; sign out
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={otpVerifying || otpCode.length !== 6}
                  className="btn-modern btn-modern-success w-full"
                >
                  {otpVerifying ? "Verifying..." : "Verify & Continue"}
                </button>
              </form>
            )}
          
          {/* Sign Up Link - Only show for patient and doctor (admin and receptionist signup is disabled) */}
          {(role === "patient" || role === "doctor" || !role) && (
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Don&apos;t have an account?{" "}
                <a 
                  href={role ? `/auth/signup?role=${role}` : "/auth/signup?role=patient"} 
                  className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  Create {role === "doctor" ? "doctor" : 
                          role === "patient" ? "patient" :
                          "account"}
                </a>
              </p>
            </div>
          )}

            {/* Info Box for Admin/Receptionist - No signup available */}
            {(role === "admin" || role === "receptionist") && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Need an account?
                    </p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      {role === "admin" 
                        ? "Admin accounts are created by system administrators. Please contact your IT department or system administrator for access."
                        : "Receptionist accounts are created by administrators. Please contact your supervisor or system administrator for access."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test Credentials Table */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider text-center mb-3">
              Test Credentials
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg text-left text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-2 border-b border-gray-200 text-slate-700 font-semibold">Email ID</th>
                    <th className="px-2 py-2 border-b border-gray-200 text-slate-700 font-semibold">Password</th>
                    <th className="px-2 py-2 border-b border-gray-200 text-slate-700 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Patient1@gmail.com"); setPassword("Patient1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Patient1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Patient1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Patient</td>
                  </tr>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Doctor1@gmail.com"); setPassword("Doctor1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Doctor1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Doctor1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Doctor</td>
                  </tr>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Admin1@gmail.com"); setPassword("Admin1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Admin1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Admin1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Super Admin</td>
                  </tr>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Receptionist1@gmail.com"); setPassword("Receptionist1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Receptionist1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Receptionist1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Receptionist (Bardoli)</td>
                  </tr>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Navsari1@gmail.com"); setPassword("Navsari1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Navsari1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Navsari1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Receptionist (Navsari)</td>
                  </tr>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Surat1@gmail.com"); setPassword("Surat1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Surat1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Surat1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600 border-b border-gray-100">Receptionist (Surat)</td>
                  </tr>
                  <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => { setIdentifier("Sardar1@gmail.com"); setPassword("Sardar1@gmail.com"); }}>
                    <td className="px-2 py-2 text-slate-600">Sardar1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600">Sardar1@gmail.com</td>
                    <td className="px-2 py-2 text-slate-600">Admin</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-4 text-slate-500 font-medium">Trusted by healthcare professionals</span>
            </div>
          </div>

          {/* Footer Trust Badges */}
          <div className="flex items-center justify-center gap-8 text-slate-400">
            <div className="text-center">
              <div className="text-2xl mb-1">🏥</div>
              <p className="text-xs font-medium">Certified</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🔐</div>
              <p className="text-xs font-medium">Secure</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">✅</div>
              <p className="text-xs font-medium">Verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Healthcare Imagery & Info */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700 p-12 items-start justify-center relative overflow-hidden">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-white max-w-lg pt-8">
          <div className="mb-8">
            <div className="inline-block p-4 bg-white/20 backdrop-blur-sm rounded-2xl mb-6">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Your Health, Our Priority
            </h2>
            <p className="text-cyan-100 text-lg leading-relaxed">
              Access secure, professional healthcare management. Connect with trusted doctors, 
              manage appointments, and take control of your wellness journey.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <div>
                <p className="font-semibold">Easy Appointment Booking</p>
                <p className="text-sm text-cyan-100">Schedule with top doctors in seconds</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <div>
                <p className="font-semibold">Secure & Private</p>
                <p className="text-sm text-cyan-100">Your data protected with encryption</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <div>
                <p className="font-semibold">24/7 Access</p>
                <p className="text-sm text-cyan-100">Manage your health anytime, anywhere</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading login page..." />}>
      <LoginContent />
    </Suspense>
  )
}

// Force dynamic rendering to prevent prerender errors
export const dynamic = 'force-dynamic'