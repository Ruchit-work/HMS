"use client"

import { useState } from "react"
import Link from "next/link"
import { auth } from "@/firebase/config"
import { sendPasswordResetEmail } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false,
      })
      
      setSuccess(true)
      setEmail("")
      
      // Auto redirect to login after 5 seconds
      setTimeout(() => {
        router.push("/auth/login")
      }, 5000)
      
    } catch (err) {
      const firebaseError = err as { code?: string; message?: string }
      let errorMessage = "Failed to send reset email"
      
      switch (firebaseError.code) {
        case "auth/invalid-email":
          errorMessage = "Invalid email address. Please enter a valid email."
          break
        case "auth/user-not-found":
          // Don't reveal if email exists for security
          errorMessage = "If this email is registered, you will receive a password reset link."
          setSuccess(true)
          break
        case "auth/too-many-requests":
          errorMessage = "Too many requests. Please try again later."
          break
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your internet connection."
          break
        default:
          errorMessage = firebaseError.message || "Failed to send reset email. Please try again."
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-100 rounded-xl mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Forgot Password?
          </h1>
          <p className="text-sm text-slate-600">
            No worries! Enter your email and we&apos;ll send you reset instructions.
          </p>
        </div>

        {error && !success && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg animate-slide-down">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg animate-slide-down">
            <div className="flex items-start gap-3">
              <span className="text-green-500 text-xl">✓</span>
              <div className="text-sm text-green-700">
                <p className="font-semibold">Email sent successfully!</p>
                <p className="mt-1">
                  Check your inbox for password reset instructions. 
                  Redirecting to login in 5 seconds...
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg
                  focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200
                  bg-white text-slate-900 placeholder:text-slate-400
                  transition-all duration-200
                  disabled:bg-slate-100 disabled:cursor-not-allowed"
                placeholder="your.email@hospital.com"
                required
                disabled={success}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 
              text-white py-3 px-6 rounded-lg font-semibold shadow-md hover:shadow-lg
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
              transform hover:-translate-y-0.5"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </span>
            ) : success ? (
              "Email Sent ✓"
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/auth/login")}
            className="text-sm text-cyan-600 hover:text-cyan-700 font-semibold transition-colors"
          >
            ← Back to Login
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-cyan-600 hover:text-cyan-700 font-semibold transition-colors">
            Sign up here
          </Link>
        </div>

        {/* Security Note */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-center text-slate-500">
            🔒 Your security is our priority. Password reset links expire in 1 hour.
          </p>
        </div>
      </div>
    </div>
  )
}

