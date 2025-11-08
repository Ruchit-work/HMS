"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { auth, db } from "@/firebase/config"
import { signInWithEmailAndPassword } from "firebase/auth"
import { getDoc, doc } from "firebase/firestore"
import { useRouter, useSearchParams } from "next/navigation"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

function LoginContent() {
  const searchParams = useSearchParams()
  const role = searchParams.get("role") as "patient" | "doctor" | "admin" | "receptionist" | null
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  // Protect route - redirect if already authenticated
  const { loading: checking } = usePublicRoute()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Check admin collection first
      const adminDoc = await getDoc(doc(db, "admins", user.uid))
      if (adminDoc.exists()) {
        setLoading(false)
        dispatchCountdownMessage("Login successful!", () => router.replace("/admin-dashboard"))
        return
      }

      // Check doctor collection
      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const doctorData = doctorDoc.data()
        
        if (doctorData.status === "pending") {
          setError("Your account is pending admin approval. Please wait for approval before logging in. You will be notified once your account is approved.")
          await auth.signOut()
          setLoading(false)
          return
        }
        setLoading(false)
        dispatchCountdownMessage("Login successful!", () => router.replace("/doctor-dashboard"))
        return
      }
      
      // Check patient collection
      const patientDoc = await getDoc(doc(db, "patients", user.uid))
      if (patientDoc.exists()) {
        setLoading(false)
        dispatchCountdownMessage("Login successful!", () => router.replace("/patient-dashboard"))
        return
      }
      
      // Check receptionist collection
      const receptionistDoc = await getDoc(doc(db, "receptionists", user.uid))
      if (receptionistDoc.exists()) {
        setLoading(false)
        dispatchCountdownMessage("Login successful!", () => router.replace("/receptionist-dashboard"))
        return
      }
      
      // No account found in any collection
      setError("Account not found. Please sign up first.")
      await auth.signOut()
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
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const dispatchCountdownMessage = (message: string, onComplete: () => void, seconds = 3) => {
    setSuccess(`${message} Redirecting in ${seconds}...`)
    let remaining = seconds
    const interval = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setSuccess(`${message} Redirecting in ${remaining}...`)
      } else {
        clearInterval(interval)
        onComplete()
      }
    }, 1000)
  }

  if (checking) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
        <div className="w-full max-w-sm sm:max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">H</span>
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-slate-900">HMS</h1>
                <p className="text-xs text-slate-500 font-medium">Hospital Management System</p>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              {role === "doctor" ? "Doctor Login" : 
               role === "admin" ? "Admin Login" : 
               role === "receptionist" ? "Receptionist Login" :
               role === "patient" ? "Patient Login" :
               "Login"}
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              {role === "doctor" ? "Sign in to access your doctor dashboard" : 
               role === "admin" ? "Sign in to access admin dashboard" : 
               role === "receptionist" ? "Sign in to access receptionist dashboard" :
               role === "patient" ? "Sign in to access your patient portal" :
               "Sign in to access your dashboard"}
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 mb-6 py-4 border-y border-slate-200">
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
              <div className="flex items-start gap-3">
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
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                  placeholder={role === "doctor" ? "doctor@hospital.com" : 
                                role === "admin" ? "admin@hospital.com" : 
                                role === "receptionist" ? "receptionist@hospital.com" :
                                role === "patient" ? "patient@email.com" :
                                "your@email.com"}
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
              className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          
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
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700 p-12 items-center justify-center relative overflow-hidden">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-white max-w-lg">
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