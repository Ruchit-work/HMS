"use client"

import Link from "next/link"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"

export default function Home() {
  const { loading } = usePublicRoute()

  if (loading) {
    return <LoadingSpinner message="Loading..." />
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Section 1: Header — solid blue, no gradient */}
        <header className="rounded-lg bg-sky-700 px-6 py-8 sm:px-8 sm:py-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-white mb-4">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">
            Hospital Management System
          </h1>
          <p className="mt-2 text-sm text-sky-100">
            Streamline your healthcare operations with our comprehensive platform
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              HIPAA Compliant
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure & Encrypted
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              24/7 Support
            </span>
          </div>
        </header>

        {/* Section 2: Healthcare Portal — same-width card */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 sm:h-14 sm:w-14">
              <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
              Healthcare Portal
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Book appointments, view your medical records, and manage your healthcare journey in one place. Available for patients, doctors, administrators, and receptionists.
            </p>
            <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-sky-600 bg-white px-4 py-3 text-sm font-semibold text-sky-600 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-12-9a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
                </svg>
                Sign Up
              </Link>
            </div>
          </div>
        </section>

        {/* Section 3: Key Features — same card style as portal */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-center text-lg font-bold text-slate-900 sm:text-xl">
            Key Features
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Everything you need to manage your healthcare operations efficiently
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Appointment Management</h3>
              <p className="mt-1 text-sm text-slate-600">
                Schedule, reschedule, and manage appointments with an intuitive interface
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-slate-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Patient Records</h3>
              <p className="mt-1 text-sm text-slate-600">
                Maintain patient medical histories with secure, organized documentation
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">Real-time Updates</h3>
              <p className="mt-1 text-sm text-slate-600">
                Instant notifications and schedule updates to stay informed
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Footer — same width, simple */}
        <footer className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 sm:gap-6">
              <a href="mailto:support@hms.com" className="inline-flex items-center gap-2 hover:text-sky-600 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                support@hms.com
              </a>
              <a href="tel:+15551234567" className="inline-flex items-center gap-2 hover:text-sky-600 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                +1 (555) 123-4567
              </a>
            </div>
            <Link href="/privacy" className="text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors">
              Privacy & Policy
            </Link>
          </div>
          <p className="mt-4 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Hospital Management System. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  )
}
