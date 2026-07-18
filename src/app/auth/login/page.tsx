"use client"

import { useState, useEffect, Suspense, useRef } from "react"
import Link from "next/link"
import { auth, db } from "@/firebase/config"
import { signInWithEmailAndPassword, type User } from "firebase/auth"
import { getDoc, doc, collection, getDocs, setDoc } from "firebase/firestore"
import { useRouter, useSearchParams } from "next/navigation"
import { usePublicRoute, seedUserRoleCache } from "@/shared/hooks/useAuth"
import { useDeferredVisible } from "@/shared/hooks/useDeferredVisible"
import { LoadingSpinner } from '@/shared/components'
import { Button } from '@/shared/components'

type DashboardRole = "patient" | "doctor" | "admin" | "receptionist" | "pharmacy"
const STAFF_ROLES: DashboardRole[] = ["admin", "doctor", "receptionist", "pharmacy"]

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
  const [yatharthOpen, setYatharthOpen] = useState(false)
  const [jivandeepOpen, setJivandeepOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [redirectBanner, setRedirectBanner] = useState<{
    title: string
    helperText: string
    welcomeLine: string
    secondsLeft: number
  } | null>(null)
  const router = useRouter()
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const redirectStartedRef = useRef(false)
  const pendingRedirectPathRef = useRef<string | null>(null)
  
  // Protect route - redirect if already authenticated
  const { loading: checking } = usePublicRoute()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const showAuthGate = useDeferredVisible(checking || isCheckingAuth, 400)

  // Warm dashboard route compile while user is still on the login page (dev cold compile is slow)
  useEffect(() => {
    const roleToPath: Record<string, string> = {
      admin: "/admin-dashboard",
      doctor: "/doctor-dashboard",
      patient: "/patient-dashboard",
      receptionist: "/receptionist-dashboard",
      pharmacy: "/pharmacy",
    }
    const preferred = role ? roleToPath[role] : null
    if (preferred) {
      router.prefetch(preferred)
    }
    const allPaths = Object.values(roleToPath)
    const idleId = window.setTimeout(() => {
      for (const path of allPaths) {
        if (path !== preferred) router.prefetch(path)
      }
    }, 800)
    return () => window.clearTimeout(idleId)
  }, [role, router])

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
    // Parallel Firestore reads — previously sequential (~5–7s for non-admin roles)
    const [userDoc, adminDoc, doctorDoc, patientDoc, receptionistDoc, pharmacistDoc] =
      await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "admins", user.uid)),
        getDoc(doc(db, "doctors", user.uid)),
        getDoc(doc(db, "patients", user.uid)),
        getDoc(doc(db, "receptionists", user.uid)),
        getDoc(doc(db, "pharmacists", user.uid)),
      ])

    let isSuperAdmin = false
    let hospitals: string[] = []
    let activeHospital: string | null = null

    if (userDoc.exists()) {
      const userData = userDoc.data()
      hospitals = userData?.hospitals || []
      activeHospital = userData?.activeHospital || null
      isSuperAdmin = userData?.role === "super_admin"
    }

    // Check admin collection first (same priority as before)
    if (adminDoc.exists()) {
      const adminData = adminDoc.data()
      if (isSuperAdmin || adminData?.isSuperAdmin) {
        return {
          role: "admin" as DashboardRole,
          data: adminData,
          redirect: "/admin-dashboard",
          isSuperAdmin: true,
          hospitals,
          activeHospital,
        }
      }
      return {
        role: "admin" as DashboardRole,
        data: adminData,
        redirect: "/admin-dashboard",
        hospitals: hospitals.length > 0 ? hospitals : (adminData?.hospitalId ? [adminData.hospitalId] : []),
        activeHospital: activeHospital || adminData?.hospitalId || null,
      }
    }

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
        activeHospital: activeHospital || doctorData?.hospitalId || null,
      }
    }

    if (patientDoc.exists()) {
      return {
        role: "patient" as DashboardRole,
        data: patientDoc.data(),
        redirect: "/patient-dashboard",
        hospitals,
        activeHospital,
      }
    }

    if (receptionistDoc.exists()) {
      const receptionistData = receptionistDoc.data()
      return {
        role: "receptionist" as DashboardRole,
        data: receptionistData,
        redirect: "/receptionist-dashboard",
        hospitals:
          hospitals.length > 0
            ? hospitals
            : receptionistData?.hospitalId
              ? [receptionistData.hospitalId]
              : [],
        activeHospital: activeHospital || receptionistData?.hospitalId || null,
      }
    }

    if (pharmacistDoc.exists()) {
      const pharmacistData = pharmacistDoc.data()
      return {
        role: "pharmacy" as DashboardRole,
        data: pharmacistData,
        redirect: "/pharmacy",
        hospitals:
          hospitals.length > 0
            ? hospitals
            : pharmacistData?.hospitalId
              ? [pharmacistData.hospitalId]
              : [],
        activeHospital: activeHospital || pharmacistData?.hospitalId || null,
      }
    }

    return null
  }

  const checkAndRedirectWithHospital = async (roleInfo: any, user: User) => {
    // Determine redirect path first
    let redirectPath = roleInfo.redirect

    // Seed auth cache so dashboard useAuth skips another multi-collection scan
    seedUserRoleCache(
      user.uid,
      roleInfo.role === "pharmacy" ? "pharmacy" : roleInfo.role,
      (roleInfo.data || {}) as Record<string, unknown>
    )

    // Prefetch destination immediately so Next can compile during countdown (dev cold start)
    pendingRedirectPathRef.current = redirectPath
    try {
      router.prefetch(redirectPath)
    } catch {
      // ignore prefetch errors
    }
    dispatchRedirectBanner(
      () => router.replace(pendingRedirectPathRef.current || roleInfo.redirect),
      3,
      getWelcomeLine(roleInfo)
    )
    
      // Sync user document in users collection (for multi-hospital support)
      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)
      
      // If pharmacy role, sync to users collection
      if (roleInfo.role === "pharmacy" && !userDoc.exists()) {
        const pharmaData = roleInfo.data || {}
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email || pharmaData.email || "",
          role: "pharmacy",
          hospitals: roleInfo.hospitals || (pharmaData?.hospitalId ? [pharmaData.hospitalId] : []),
          activeHospital: roleInfo.activeHospital || pharmaData?.hospitalId || null,
          firstName: pharmaData?.firstName,
          lastName: pharmaData?.lastName,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      }
      // If super admin, fetch all hospitals and sync to users collection
      else if (roleInfo.isSuperAdmin) {
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
      } else if (
        roleInfo.role === "doctor" ||
        roleInfo.role === "receptionist" ||
        roleInfo.role === "pharmacy" ||
        roleInfo.role === "admin"
      ) {
        // Ensure hospital membership is on users doc (required by Firestore rules + MultiHospitalContext)
        const hospitals =
          (Array.isArray(roleInfo.hospitals) && roleInfo.hospitals.length > 0
            ? roleInfo.hospitals
            : null) ||
          (roleInfo.data?.hospitalId ? [roleInfo.data.hospitalId] : []) ||
          []
        const activeHospital = roleInfo.activeHospital || roleInfo.data?.hospitalId || hospitals[0] || null
        if (hospitals.length > 0) {
          await setDoc(
            userDocRef,
            {
              uid: user.uid,
              email: user.email || roleInfo.data?.email || "",
              role: roleInfo.role === "pharmacy" ? "pharmacy" : roleInfo.role,
              hospitals,
              activeHospital,
              hospitalId: activeHospital,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
        }
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
        setRedirectBanner(null)
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
          setRedirectBanner(null)
          setSuccess("")
          router.replace("/hospital-selection?redirect=" + roleInfo.redirect)
          return
        }
      }
    }

    // For staff (admin/doctor/receptionist/pharmacy), they belong to one hospital - auto-select
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

    pendingRedirectPathRef.current = redirectPath
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
        dispatchRedirectBanner(
          () => router.replace(pendingRedirect || "/"),
          3,
          ""
        )
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

      // Start compiling the destination route ASAP (overlaps with remaining login work)
      try {
        router.prefetch(roleInfo.redirect)
      } catch {
        // ignore
      }

      // Auth succeeded — keep button busy; banner + countdown start immediately inside redirect helper
      await checkAndRedirectWithHospital(roleInfo, user)
      setLoading(false)
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

  const getWelcomeLine = (roleInfo: {
    role?: DashboardRole
    data?: Record<string, unknown>
  } | null): string => {
    if (!roleInfo?.data) return ""
    const data = roleInfo.data
    const first = String(data.firstName || "").trim()
    const last = String(data.lastName || "").trim()
    const full =
      `${first} ${last}`.trim() ||
      String(data.name || data.fullName || "").trim()
    if (!full) return ""
    if (roleInfo.role === "doctor") {
      return /^dr\.?\s/i.test(full) ? full : `Dr. ${full}`
    }
    return full
  }

  const dispatchRedirectBanner = (
    onComplete: () => void,
    seconds = 3,
    welcomeLine = ""
  ) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }

    redirectStartedRef.current = false
    setSuccess("")
    setError("")

    const totalSeconds = Math.max(1, seconds)
    setRedirectBanner({
      title: "Redirecting...",
      helperText: welcomeLine
        ? `Welcome back, ${welcomeLine}. Please wait while we prepare your dashboard.`
        : "Please wait while we prepare your dashboard.",
      welcomeLine,
      secondsLeft: totalSeconds,
    })

    let remaining = totalSeconds
    const interval = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setRedirectBanner((prev) =>
          prev ? { ...prev, secondsLeft: remaining } : prev
        )
        return
      }

      // Hit 0 — navigate immediately, exactly once
      clearInterval(interval)
      countdownIntervalRef.current = null
      setRedirectBanner((prev) => (prev ? { ...prev, secondsLeft: 0 } : prev))
      if (!redirectStartedRef.current) {
        redirectStartedRef.current = true
        onComplete()
      }
    }, 1000)

    countdownIntervalRef.current = interval
  }

  if (checking || isCheckingAuth) {
    // Auth init is essential, but avoid flash for fast session checks
    if (!showAuthGate) {
      return <div className="min-h-screen bg-slate-50" aria-busy="true" />
    }
    return <LoadingSpinner message="Checking session…" />
  }

  const otpMaskedPhone = pendingPhone ? maskPhoneNumber(pendingPhone) : ""

  return (
    <div className="login-saas min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* LEFT — Authentication (~45%) */}
      <div className="relative flex w-full flex-col justify-center px-4 py-8 sm:px-8 lg:w-[45%] lg:px-10 xl:px-14 lg:py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-teal-200/30 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-sky-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to HMS Cloud
          </Link>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-500/40">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">HMS Cloud</p>
              <p className="text-sm font-semibold text-slate-900">Hospital Management Platform</p>
              <p className="mt-0.5 text-xs text-slate-500">Secure access for healthcare professionals.</p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">Welcome Back</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Sign in to access your hospital dashboard.</p>
          </div>

          {error && !redirectBanner && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 shadow-sm">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">!</div>
              <p className="flex-1 text-sm font-medium leading-relaxed text-red-800">{error}</p>
              <button type="button" onClick={() => setError("")} className="text-red-400 transition hover:text-red-600" aria-label="Close error">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {success && !redirectBanner && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 shadow-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 115.757 9.88l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="flex-1 text-sm font-medium leading-relaxed text-emerald-800">{success}</p>
              <button type="button" onClick={() => setSuccess("")} className="text-emerald-400 transition hover:text-emerald-600" aria-label="Close success message">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-7">
            {!mfaRequired ? (
              <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
                {redirectBanner && (
                  <div
                    className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 animate-fade-in"
                    role="status"
                    aria-live="polite"
                    aria-label="Redirecting to dashboard"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 115.757 9.88l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-900">{redirectBanner.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/90">
                        {redirectBanner.helperText}
                      </p>
                      <p
                        key={redirectBanner.secondsLeft}
                        className="mt-1.5 text-xs font-semibold tabular-nums text-emerald-700 animate-fade-in"
                      >
                        {redirectBanner.secondsLeft > 0
                          ? `Redirecting in ${redirectBanner.secondsLeft} second${redirectBanner.secondsLeft === 1 ? "" : "s"}...`
                          : "Opening dashboard..."}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/15 disabled:opacity-60"
                    placeholder={
                      role === "doctor"
                        ? "doctor@hospital.com"
                        : role === "admin"
                        ? "admin@hospital.com"
                        : role === "receptionist"
                        ? "receptionist@hospital.com"
                        : role === "pharmacy"
                        ? "pharmacy@hospital.com"
                        : role === "patient"
                        ? "patient@email.com"
                        : "you@hospital.com"
                    }
                    required
                    autoComplete="username"
                    disabled={loading || !!redirectBanner}
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/15 disabled:opacity-60"
                      placeholder="Enter your password"
                      minLength={6}
                      required
                      autoComplete="current-password"
                      disabled={loading || !!redirectBanner}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      disabled={loading || !!redirectBanner}
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="group inline-flex cursor-pointer items-center gap-2.5 select-none">
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                        disabled={loading || !!redirectBanner}
                      />
                      <span className="h-4 w-4 rounded border border-slate-300 bg-white transition peer-checked:border-cyan-600 peer-checked:bg-cyan-600 peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-500/20" />
                      <svg className="pointer-events-none absolute h-2.5 w-2.5 text-white opacity-0 transition peer-checked:opacity-100" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 115.757 9.88l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-sm text-slate-600 group-hover:text-slate-800">Remember Me</span>
                  </label>
                  <Link href="/auth/forgot-password" className="text-sm font-medium text-cyan-700 transition hover:text-cyan-800">
                    Forgot Password
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full !rounded-full !bg-gradient-to-r !from-cyan-600 !to-teal-600 !py-3 !text-sm !font-semibold !shadow-md !shadow-cyan-600/25 transition hover:!from-cyan-500 hover:!to-teal-500 hover:!shadow-lg hover:!shadow-cyan-600/30 active:!scale-[0.99]"
                  loading={loading || !!redirectBanner}
                  loadingText={redirectBanner ? "Preparing Dashboard..." : "Signing in..."}
                  disabled={loading || !!redirectBanner}
                >
                  Sign In
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-5 animate-fade-in">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Two-Factor Authentication</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Enter the 6-digit security code we sent to{" "}
                    <span className="font-semibold text-slate-800">{otpMaskedPhone}</span> to verify your identity.
                  </p>
                </div>

                <div>
                  <label htmlFor="login-otp" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Security Code
                  </label>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 text-center text-2xl tracking-[0.4em] text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/15"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                  />
                </div>

                {otpError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{otpError}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => sendOtpCode()}
                    disabled={otpSending || otpCountdown > 0}
                    className="font-semibold text-cyan-700 transition hover:text-cyan-800 disabled:opacity-50"
                  >
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : otpSending ? "Sending..." : "Resend Code"}
                  </button>
                  <button type="button" onClick={handleCancelMfa} className="font-medium text-slate-500 transition hover:text-slate-700">
                    Cancel &amp; sign out
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full !rounded-full !bg-gradient-to-r !from-cyan-600 !to-teal-600 !py-3 !text-sm !font-semibold !shadow-md !shadow-cyan-600/25"
                  loading={otpVerifying}
                  loadingText="Verifying..."
                  disabled={otpCode.length !== 6}
                >
                  Verify & Continue
                </Button>
              </form>
            )}

            {(role === "patient" || role === "doctor" || !role) && !redirectBanner && (
              <div className="mt-6 border-t border-slate-100 pt-5 text-center">
                <p className="text-sm text-slate-600">
                  Don&apos;t have an account?{" "}
                  <a
                    href={role ? `/auth/signup?role=${role}` : "/auth/signup?role=patient"}
                    className="font-semibold text-cyan-700 transition hover:text-cyan-800"
                  >
                    Create {role === "doctor" ? "doctor" : role === "patient" ? "patient" : "account"}
                  </a>
                </p>
              </div>
            )}

            {(role === "admin" || role === "receptionist" || role === "pharmacy") && !redirectBanner && (
              <div className="mt-6 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-teal-50 p-4">
                <p className="text-sm font-semibold text-cyan-900">Need an account?</p>
                <p className="mt-1 text-xs leading-relaxed text-cyan-800">
                  {role === "admin"
                    ? "Admin accounts are created by system administrators. Please contact your IT department or system administrator for access."
                    : role === "pharmacy"
                    ? "Pharmacy accounts are created by administrators. Use the credentials provided by your admin or see the table below."
                    : "Receptionist accounts are created by administrators. Please contact your supervisor or system administrator for access."}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-slate-800">Need Help?</p>
            <p className="mt-0.5 text-xs text-slate-500">Contact your Hospital Administrator.</p>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:text-xs">
            {["Secure Login", "End-to-End Encryption", "Multi-Branch Support", "Role Based Access"].map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 115.757 9.88l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-4 border-t border-slate-200 pt-6">
            <h3 className="mb-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Test Credentials
            </h3>
            <p className="mb-3 text-center text-[11px] text-slate-400">Click a row to autofill</p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Email ID</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Password</th>
                      <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" onClick={() => { setIdentifier("Patient1@gmail.com"); setPassword("Patient1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Patient1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Patient1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Patient</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" onClick={() => { setIdentifier("Doctor1@gmail.com"); setPassword("Doctor1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Doctor1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Doctor1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Doctor</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" onClick={() => { setIdentifier("Receptionist1@gmail.com"); setPassword("Receptionist1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Receptionist1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Receptionist1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Receptionist (Bardoli)</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" onClick={() => { setIdentifier("Navsari1@gmail.com"); setPassword("Navsari1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Navsari1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Navsari1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Receptionist (Navsari)</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" onClick={() => { setIdentifier("Surat1@gmail.com"); setPassword("Surat1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Surat1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Surat1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Receptionist (Surat)</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" onClick={() => { setIdentifier("Sardar1@gmail.com"); setPassword("Sardar1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Sardar1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Sardar1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Admin</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-emerald-50" onClick={() => { setIdentifier("Pharmacy1@gmail.com"); setPassword("Pharmacy1@gmail.com"); }}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Pharmacy1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-600">Pharmacy1@gmail.com</td>
                      <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-600">Pharmacy (Portal)</td>
                    </tr>
                    <tr className="cursor-pointer transition hover:bg-cyan-50" hidden={true} onClick={() => { setIdentifier("Admin1@gmail.com"); setPassword("Admin1@gmail.com"); }}>
                      <td className="px-3 py-2 text-slate-600">Admin1@gmail.com</td>
                      <td className="px-3 py-2 text-slate-600">Admin1@gmail.com</td>
                      <td className="px-3 py-2 text-slate-600"> Super Admin</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setYatharthOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100/80"
              >
                <span>Yatharth Hospital credentials</span>
                <svg className={`h-4 w-4 text-slate-500 transition-transform ${yatharthOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {yatharthOpen && (
                <div className="border-t border-slate-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-slate-700">Email ID</th>
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-slate-700">Password</th>
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-slate-700">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="cursor-pointer hover:bg-cyan-50" onClick={() => { setIdentifier("Yatharthhospital@gmail.com"); setPassword("Yatharth@123"); }}>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Yatharthhospital@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Yatharth@123</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Admin</td>
                      </tr>
                      <tr className="cursor-pointer hover:bg-cyan-50" onClick={() => { setIdentifier("YTH1@gmail.com"); setPassword("YTH1@gmail.com"); }}>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">YTH1@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">YTH1@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Receptionist</td>
                      </tr>
                      <tr className="cursor-pointer hover:bg-cyan-50" onClick={() => { setIdentifier("Shrey1@gmail.com"); setPassword("Shrey1@gmail.com"); }}>
                        <td className="px-2 py-2 text-slate-600">Shrey1@gmail.com</td>
                        <td className="px-2 py-2 text-slate-600">Shrey1@gmail.com</td>
                        <td className="px-2 py-2 text-slate-600">Doctor</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setJivandeepOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100/80"
              >
                <span>Jivandeep Hospital credentials</span>
                <svg className={`h-4 w-4 text-slate-500 transition-transform ${jivandeepOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {jivandeepOpen && (
                <div className="border-t border-slate-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-slate-700">Email ID</th>
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-slate-700">Password</th>
                        <th className="border-b border-gray-200 px-2 py-2 font-semibold text-slate-700">Role / Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="cursor-pointer hover:bg-cyan-50" onClick={() => { setIdentifier("Jivandeep@gmail.com"); setPassword("Jivandeep@gmail.com"); }}>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Jivandeep@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Jivandeep@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Admin</td>
                      </tr>
                      <tr className="cursor-pointer hover:bg-emerald-50" onClick={() => { setIdentifier("jivandeeppharma@gmail.com"); setPassword("jivandeeppharma@gmail.com"); }}>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">jivandeeppharma@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">jivandeeppharma@gmail.com</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-slate-600">Pharmacy â€“ Rajpipala</td>
                      </tr>
                      <tr className="bg-teal-100/80">
                        <td colSpan={3} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800">Doctors</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-teal-400 bg-teal-50/70 hover:bg-teal-100" onClick={() => { setIdentifier("Priti1@gmail.com"); setPassword("Priti1@gmail.com"); }}>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Priti1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Priti1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 font-semibold text-teal-800">Doctor</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-teal-400 bg-teal-50/70 hover:bg-teal-100" onClick={() => { setIdentifier("Ram1@gmail.com"); setPassword("Ram1@gmail.com"); }}>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Ram1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Ram1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 font-semibold text-teal-800">Doctor</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-teal-400 bg-teal-50/70 hover:bg-teal-100" onClick={() => { setIdentifier("Gaurav1@gmail.com"); setPassword("Gaurav1@gmail.com"); }}>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Gaurav1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Gaurav1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 font-semibold text-teal-800">Doctor</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-teal-400 bg-teal-50/70 hover:bg-teal-100" onClick={() => { setIdentifier("Nikhilmehta1@gmiil.com"); setPassword("Nikhilmehta1@gmiil.com"); }}>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Nikhilmehta1@gmiil.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Nikhilmehta1@gmiil.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 font-semibold text-teal-800">Doctor</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-teal-400 bg-teal-50/70 hover:bg-teal-100" onClick={() => { setIdentifier("Rajsinhrana1@gmail.com"); setPassword("Rajsinhrana1@gmail.com"); }}>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Rajsinhrana1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Rajsinhrana1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 font-semibold text-teal-800">Doctor</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-teal-400 bg-teal-50/70 hover:bg-teal-100" onClick={() => { setIdentifier("Sai1@gmail.com"); setPassword("Sai1@gmail.com"); }}>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Sai1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 text-slate-700">Sai1@gmail.com</td>
                        <td className="border-b border-teal-100 px-2 py-2 font-semibold text-teal-800">Doctor</td>
                      </tr>
                      <tr className="bg-amber-100/80">
                        <td colSpan={3} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Receptionists</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-100" onClick={() => { setIdentifier("Rajpipala@gmail.com"); setPassword("Rajpipala@gmail.com"); }}>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">Rajpipala@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">Rajpipala@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 font-semibold text-amber-800">Receptionist â€“ Rajpipala</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-100" onClick={() => { setIdentifier("ahm@gmail.com"); setPassword("ahm@gmail.com"); }}>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">ahm@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">ahm@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 font-semibold text-amber-800">Receptionist â€“ Ahmedabad</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-100" onClick={() => { setIdentifier("diyodar@gmail.com"); setPassword("diyodar@gmail.com"); }}>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">diyodar@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">diyodar@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 font-semibold text-amber-800">Receptionist â€“ Diyodar</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-100" onClick={() => { setIdentifier("gardeshwar@gmail.com"); setPassword("gardeshwar@gmail.com"); }}>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">gardeshwar@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">gardeshwar@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 font-semibold text-amber-800">Receptionist â€“ Gardeshwar</td>
                      </tr>
                      <tr className="cursor-pointer border-l-4 border-l-amber-400 bg-amber-50/70 hover:bg-amber-100" onClick={() => { setIdentifier("umalla@gmail.com"); setPassword("umalla@gmail.com"); }}>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">umalla@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 text-slate-700">umalla@gmail.com</td>
                        <td className="border-b border-amber-100 px-2 py-2 font-semibold text-amber-800">Receptionist â€“ Umalla</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT â€” Brand showcase (~55%) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700 lg:flex lg:w-[55%] lg:flex-col lg:justify-start lg:px-10 lg:pt-10 lg:pb-12 xl:px-14 xl:pt-12">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -right-10 bottom-0 h-96 w-96 rounded-full bg-teal-300/30 blur-3xl" />
          <div className="absolute left-1/3 top-1/2 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-50 backdrop-blur-sm">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live hospital overview
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white xl:text-4xl">
            Modern Hospital
            <span className="mt-1 block text-blue-100">Operations Preview</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-blue-50/90">
            The same secure platform your teams use for appointments, billing, pharmacy, and clinical workflows â€” across every branch.
          </p>

          <div className="mt-8 rounded-[24px] border border-white/25 bg-white/95 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:shadow-cyan-950/30">
            <div className="mb-3 flex items-center justify-between text-[11px] text-slate-700">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                Command center Â· Today
              </span>
              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-slate-700">Multi-branch</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Today's Appointments", value: "128", badge: "+12%", tone: "text-emerald-600" },
                { label: "Revenue", value: "â‚¹2.4L", badge: "+8.3%", tone: "text-emerald-600" },
                { label: "Doctors Online", value: "34", badge: "All active", tone: "text-sky-600" },
                { label: "Available Beds", value: "86", badge: "62% free", tone: "text-teal-600" },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm transition hover:border-cyan-200 hover:bg-white">
                  <p className="text-[10px] text-slate-500">{card.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{card.value}</p>
                  <p className={`mt-0.5 text-[10px] ${card.tone}`}>{card.badge}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-800">
                    <span className="font-medium">Revenue graph</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Monâ€“Sun</span>
                  </div>
                  <div className="mt-2 h-28 w-full rounded-xl bg-gradient-to-t from-cyan-100 via-sky-50 to-transparent">
                    <div className="flex h-full items-end gap-1.5 px-1.5 pb-1">
                      {[35, 52, 78, 58, 92, 70, 48].map((h, idx) => (
                        <div
                          key={idx}
                          className="flex-1 rounded-full bg-gradient-to-t from-cyan-600 to-sky-400 transition hover:from-teal-600 hover:to-cyan-400"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-medium text-slate-900">Branch overview</p>
                  <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
                    {[
                      { name: "Central Hospital", value: "OPD 52 Â· ICU 78%", tone: "text-emerald-600" },
                      { name: "Navsari Clinic", value: "23 waiting", tone: "text-amber-600" },
                      { name: "City Diagnostics", value: "14 in progress", tone: "text-sky-600" },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className={`truncate ${row.tone}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-medium text-slate-900">OPD Queue</p>
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    {[
                      { name: "Token #104 Â· Dr. Mehta", status: "In consult", tone: "bg-emerald-50 text-emerald-700" },
                      { name: "Token #105 Â· Dr. Shah", status: "Waiting", tone: "bg-amber-50 text-amber-700" },
                      { name: "Token #106 Â· Labs", status: "Called", tone: "bg-sky-50 text-sky-700" },
                    ].map((row) => (
                      <div key={row.name} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="truncate text-slate-700">{row.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${row.tone}`}>{row.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-medium text-slate-900">ICU occupancy</p>
                  <div className="mt-2">
                    <div className="flex items-end justify-between text-xs">
                      <span className="text-2xl font-semibold tracking-tight text-slate-900">78%</span>
                      <span className="text-[10px] text-amber-600">2 beds nearing capacity</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-amber-400" style={{ width: "78%" }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-medium text-slate-900">Recent activity</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                    <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />Pharmacy dispense Â· Ward B</li>
                    <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />Admit request approved</li>
                    <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />Lab results ready Â· 3 critical</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-2 text-[11px] text-blue-50/90 sm:grid-cols-2 sm:text-xs">
            {["Secure & Encrypted", "HIPAA-Ready Security", "Multi-Branch Support", "Role-Based Access"].map((item) => (
              <div key={item} className="inline-flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 115.757 9.88l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" aria-busy="true" />}>
      <LoginContent />
    </Suspense>
  )
}

// Force dynamic rendering to prevent prerender errors
export const dynamic = 'force-dynamic'
