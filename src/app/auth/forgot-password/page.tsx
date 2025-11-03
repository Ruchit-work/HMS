"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { auth } from "@/firebase/config"
import { sendPasswordResetEmail } from "firebase/auth"
 

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const role = searchParams.get("role")
 

 const handleSubmit = async (e:any) => {
  e.preventDefault();
  if(!email) {
    setError("Email is required")
    return;
  }
  setError("")
  setLoading(true)
  try {
   await sendPasswordResetEmail(auth, email)
   setSuccess(true);
  setEmail("")
  } catch (error) {
   setError((error as Error).message)
  } finally {
    setLoading(false)
  }
}
 
 return (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50 p-4">
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-2xl">H</span>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 rounded-xl mb-3">🔑</div>
        <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
        <p className="text-sm text-slate-600 mt-1">Enter your email to receive a reset link.</p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-5 rounded-r-lg">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-5 rounded-r-lg">
          <div className="text-sm text-green-700">
            <p className="font-semibold">If this email is registered, a reset link has been sent.</p>
            <p className="mt-1">Check your inbox and also your Spam/Junk folder for the password reset email.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email Address <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
            <input
              type="email"
              placeholder="your.email@hospital.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
              required
              disabled={loading || success}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white py-3 rounded-lg font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Sending..." : success ? "Email Sent ✓" : "Send Reset Link"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = "/auth/login")}
          className="text-sm text-cyan-600 hover:text-cyan-700 font-semibold"
        >
          ← Back to Login
        </button>
        <span className="text-xs text-slate-500">Links expire in 1 hour</span>
      </div>
    </div>
  </div>
 )
}
