"use client"

import { useEffect, useState, useRef } from "react"
import { sendOTP, verifyOTP } from "@/utils/twilioOTP"

interface OTPVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  phone: string
  countryCode?: string
  title?: string
  subtitle?: string
  onVerified?: () => void
  onChangePhone?: () => void
}

export default function OTPVerificationModal({
  isOpen,
  onClose,
  phone,
  countryCode = "+91",
  title = "Verify Your Phone Number",
  subtitle = "We've sent a 6-digit verification code to",
  onVerified,
  onChangePhone
}: OTPVerificationModalProps) {
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOTP, setSendingOTP] = useState(false)
  const [verifyingOTP, setVerifyingOTP] = useState(false)
  const [error, setError] = useState("")
  const [resendSeconds, setResendSeconds] = useState(30)
  const hasAutoRequestedRef = useRef(false)

  const fullPhone = `${countryCode}${phone}`.replace(/\s+/g, "")

  useEffect(() => {
    if (!isOpen) {
      setOtp("")
      setOtpSent(false)
      setOtpVerified(false)
      setError("")
      setResendSeconds(30)
      hasAutoRequestedRef.current = false
      return
    }

    if (!hasAutoRequestedRef.current && phone && !sendingOTP) {
      hasAutoRequestedRef.current = true
      ;(async () => {
        setError("")
        setSendingOTP(true)
        try {
          const res = await sendOTP(fullPhone)
          if (res.success) {
            setOtpSent(true)
            setResendSeconds(30)
          } else {
            setError(res.error || "Failed to send OTP")
          }
        } finally {
          setSendingOTP(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phone])

  useEffect(() => {
    if (!isOpen || !otpSent) return
    if (resendSeconds <= 0) return

    const interval = setInterval(() => {
      setResendSeconds(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, otpSent, resendSeconds])

  const handleVerify = async () => {
    if (otp.length !== 6) { setError("OTP must be 6 digits"); return }
    setError("")
    setVerifyingOTP(true)
    try {
      const res = await verifyOTP(fullPhone, otp)
      if (res.success) {
        setOtpVerified(true)
        // Call onVerified and wait for it to complete
        // Wrap in try-catch to handle any errors from onVerified
        try {
          await onVerified?.()
        } catch (error: any) {
          // If onVerified fails, reset the verification state and show error
          setOtpVerified(false)
          setError(error?.message || "Failed to complete verification. Please try again.")
          console.error("Error in onVerified callback:", error)
        }
      } else {
        const msg = res.error || "Invalid OTP"
        setError(res.remainingAttempts !== undefined ? `${msg} (${res.remainingAttempts} attempts remaining)` : msg)
      }
    } catch (error: any) {
      // Handle unexpected errors
      setError(error?.message || "Failed to verify OTP. Please try again.")
      setOtpVerified(false)
    } finally {
      setVerifyingOTP(false)
    }
  }

  const handleResend = async () => {
    if (sendingOTP || resendSeconds > 0) return
    setOtp("")
    setError("")
    hasAutoRequestedRef.current = true
    setSendingOTP(true)
    try {
      const res = await sendOTP(fullPhone)
      if (res.success) {
        setOtpSent(true)
        setResendSeconds(30)
      } else {
        setError(res.error || "Failed to send OTP")
      }
    } finally {
      setSendingOTP(false)
    }
  }

  if (!isOpen) return null

  const formattedCountdown = `00:${resendSeconds.toString().padStart(2, "0")}`

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
            <span className="text-3xl">📱</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-600">{subtitle}</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{countryCode}{phone}</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded-r-lg">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {!otpSent ? (
          <div className="text-center py-4">
            <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-slate-600 mt-4">Sending OTP...</p>
          </div>
        ) : !otpVerified ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Enter Verification Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-4 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none bg-white text-slate-900 text-center text-3xl font-bold tracking-widest"
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifyingOTP || otp.length !== 6}
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {verifyingOTP ? "Verifying..." : "Verify & Continue"}
            </button>

            <div className="text-center text-sm text-slate-600">
              {!sendingOTP && resendSeconds > 0 ? (
                <p>Didn't receive the code? Resend in <span className="font-semibold">{formattedCountdown}</span></p>
              ) : (
                <p>
                  Didn’t receive the code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-teal-600 hover:text-teal-700 font-semibold"
                    disabled={sendingOTP}
                  >
                    {sendingOTP ? "Resending..." : "Resend"}
                  </button>
                </p>
              )}
            </div>

            {onChangePhone && (
              <button
                type="button"
                onClick={() => {
                  if (verifyingOTP) return
                  onChangePhone()
                }}
                className="w-full text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                Change phone number
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-3xl text-green-600">✓</span>
            </div>
            <p className="text-sm font-medium text-green-700">Verifying and continuing...</p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={verifyingOTP || otpVerified}
          className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {otpVerified ? "" : "Cancel"}
        </button>
      </div>
    </div>
  )
}

