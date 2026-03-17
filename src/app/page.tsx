"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"

export default function Home() {
  const { loading } = usePublicRoute()
  const router = useRouter()
  const [portalLoading, setPortalLoading] = useState(false)

  if (loading) {
    return <LoadingSpinner message="Loading..." />
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-10">
        {/* Top nav */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-500/40">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12h6M12 9v6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                HMS Cloud
              </p>
              <p className="text-sm font-semibold text-slate-900">Hospital Management Platform</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-xs font-medium text-slate-600 sm:flex">
            <span className="hover:text-slate-900">Product</span>
            <span className="hover:text-slate-900">Security</span>
            <span className="hover:text-slate-900">Pricing</span>
            <span className="hover:text-slate-900">Support</span>
            <Link
              href="/auth/login"
              className="rounded-full border border-sky-500 bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              Access Portal
            </Link>
          </nav>
        </header>

        {/* HERO SECTION */}
        <section className="mt-10 grid gap-10 rounded-3xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-10 text-white shadow-sm lg:mt-16 lg:grid-cols-[minmax(0,_1.05fr)_minmax(0,_1.1fr)] lg:px-10 lg:py-12 lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-50">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Trusted Hospital Operations Platform
            </div>
            <div>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Modern Hospital
                <span className="block text-blue-100">Management System</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-50/90 sm:text-base">
                HMS Cloud centralizes appointments, billing, pharmacy, and clinical workflows into a
                single secure platform — built for multi‑branch hospitals, specialty clinics, and
                modern healthcare networks.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={portalLoading}
                onClick={() => {
                  if (portalLoading) return
                  setPortalLoading(true)
                  router.push("/auth/login")
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 ${
                  portalLoading ? "ring-2 ring-offset-2 ring-blue-300 animate-pulse" : ""
                }`}
              >
                {portalLoading ? (
                  <>
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Opening portal…
                  </>
                ) : (
                  <>
                    Access Healthcare Portal
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M7 17L17 7M9 7H17V15"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Trust badges */}
            <div className="mt-2 grid gap-2 text-[11px] text-blue-50/90 sm:grid-cols-2 sm:text-xs">
              {[
                "Secure & Encrypted",
                "HIPAA‑Ready Security",
                "Multi‑Branch Support",
                "Real‑Time Medical Data",
              ].map((item) => (
                <div key={item} className="inline-flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15 text-blue-50">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 115.757 9.88l2.293 2.293 6.543-6.543a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero dashboard mockup */}
          <div className="relative">
            <div className="rounded-[24px] border border-blue-100 bg-white/95 p-4 shadow-lg shadow-blue-900/5">
              <div className="mb-3 flex items-center justify-between text-[11px] text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  Live hospital overview
                </span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-slate-700">
                  Today · Multi‑branch
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.1fr_minmax(0,_0.9fr)]">
                {/* Left: stats & trends */}
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { label: "Today’s Appointments", value: "128", badge: "+12%" },
                      { label: "Active Doctors", value: "34", badge: "All online" },
                      { label: "Today’s Revenue", value: "₹2.4L", badge: "+8.3%" },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 shadow-sm"
                      >
                        <p className="text-[10px] text-slate-500">{card.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{card.value}</p>
                        <p className="mt-0.5 text-[10px] text-emerald-600">{card.badge}</p>
                      </div>
                    ))}
                  </div>

                  {/* Simple trend chart mock */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-800">
                      <span>Weekly appointment volume</span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        Mon–Sun
                      </span>
                    </div>
                    <div className="mt-2 h-24 w-full rounded-xl bg-gradient-to-t from-blue-100 via-blue-50 to-transparent">
                      <div className="flex h-full items-end gap-1.5 px-1">
                        {[30, 55, 80, 60, 90, 75, 50].map((h, idx) => (
                          <div
                            key={idx}
                            className="flex-1 rounded-full bg-gradient-to-t from-sky-600 to-sky-400"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: compact lists */}
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-900">Appointments in queue</p>
                    <div className="mt-2 space-y-1.5 text-[11px] text-slate-700">
                      {[
                        { name: "Navsari Clinic", value: "23 waiting", tone: "text-amber-300" },
                        { name: "Central Hospital", value: "52 today", tone: "text-emerald-300" },
                        { name: "City Diagnostics", value: "14 in progress", tone: "text-sky-300" },
                      ].map((row) => (
                        <div
                          key={row.name}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5"
                        >
                          <span className="truncate">{row.name}</span>
                          <span className={`truncate ${row.tone}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-900">Clinical risk alerts</p>
                    <div className="mt-2 space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-red-700">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500/80 text-[10px]">
                          !
                        </span>
                        <span className="truncate">3 critical lab results awaiting review</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-amber-700">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/80 text-[10px]">
                          !
                        </span>
                        <span className="truncate">2 beds nearing capacity in ICU</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST & CREDIBILITY SECTION */}
        <section className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Built for Modern Healthcare Providers
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                HMS Cloud is engineered with hospital‑grade security, role‑based access, and
                real‑time data pipelines so your teams can work with confidence.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Secure Patient Data",
                desc: "End‑to‑end encryption and granular role‑based permissions across all modules.",
              },
              {
                title: "Multi‑Branch Management",
                desc: "Operate multiple hospitals and clinics from a single consolidated workspace.",
              },
              {
                title: "Real‑Time Analytics",
                desc: "Track appointments, revenue, and clinical KPIs in live, interactive dashboards.",
              },
              {
                title: "Doctor & Staff Collaboration",
                desc: "Connect doctors, reception, billing, and pharmacy in one secure system.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-blue-500/60 hover:bg-blue-50"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PLATFORM MODULES SECTION */}
        <section className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Everything You Need to Run Your Hospital
              </h2>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                Pluggable modules designed for real hospital workflows, from front desk to pharmacy.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              "Appointment Management",
              "Patient Records",
              "Doctor Scheduling",
              "Pharmacy Management",
              "Billing & Invoices",
              "Prescription Tracking",
              "Staff Management",
              "Reports & Analytics",
            ].map((label) => (
              <div
                key={label}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:border-blue-500/70 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 5l7 7-7 7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                  Streamlined workflows, audit‑ready records, and unified data for this module.
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* PRODUCT PREVIEW SECTION */}
        <section className="mt-16 rounded-3xl border border-slate-200 bg-blue-50/70 p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            Designed for Simplicity and Efficiency
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Familiar, dashboard‑first layouts that your teams can adopt in days, not months.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {[
              "Appointment Dashboard",
              "Patient Medical Records",
              "Hospital Analytics",
            ].map((title) => (
              <div
                key={title}
                className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-xs font-medium text-slate-900">{title}</p>
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  </div>
                </div>
                <div className="h-40 rounded-2xl bg-slate-50 p-3 text-[10px] text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700">
                      Preview layout
                    </span>
                    <span className="text-[9px] text-slate-500">Sample data</span>
                  </div>
                  <div className="mt-3 grid h-[78%] grid-rows-2 gap-2">
                    <div className="flex gap-2">
                      <div className="h-full flex-1 rounded-xl bg-slate-200" />
                      <div className="h-full w-20 rounded-xl bg-slate-100" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-full flex-1 rounded-xl bg-slate-100" />
                      <div className="h-full w-16 rounded-xl bg-slate-200" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECURITY & COMPLIANCE SECTION */}
        <section className="mt-16 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 12.5l1.8 1.8 3.2-3.6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-emerald-900 sm:text-xl">
                  Security and Privacy First
                </h2>
                <p className="mt-1 max-w-xl text-sm text-emerald-900/80">
                  Built with healthcare compliance in mind — from access policies to immutable audit
                  trails.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              "Role-based Access Control",
              "Secure Medical Data Storage",
              "Encrypted Communication",
              "Activity Logs & Audit Trails",
              "Backup and Disaster Recovery",
              "Session & Device Management",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-3"
              >
                <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium text-emerald-900">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WHO IS IT FOR */}
        <section className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
            This Platform Is Perfect For
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Purpose‑built for healthcare organizations of every size.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {["Hospitals", "Clinics", "Diagnostic Centers", "Multi‑Branch Networks"].map(
              (label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                    Configure branches, roles, and workflows to match your exact operating model.
                  </p>
                </div>
              ),
            )}
          </div>
        </section>

        {/* CALL TO ACTION SECTION */}
        <section className="mt-16">
          <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 p-6 shadow-sm sm:p-8">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-300/30 blur-3xl" />
            <div className="relative flex flex-col items-start gap-4 text-blue-50 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">
                  Start Managing Your Healthcare Operations Smarter
                </h2>
                <p className="mt-2 max-w-xl text-sm text-blue-50/90">
                  Centralize operations, improve care coordination, and gain full visibility across
                  every branch — all from one secure platform.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  Login to Healthcare Portal
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-50/80 bg-blue-500/10 px-5 py-2.5 text-sm font-semibold text-blue-50 hover:bg-blue-500/20"
                >
                  Create an Account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* PROFESSIONAL FOOTER */}
        <footer className="mt-16 border-t border-slate-200 pt-8 text-xs text-slate-500">
          <div className="grid gap-6 md:grid-cols-[minmax(0,_1.6fr)_repeat(4,_minmax(0,_1fr))]">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3l7 4v5c0 5-3 7-7 9-4-2-7-4-7-9V7l7-4z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-slate-900">HMS Cloud</span>
              </div>
              <p className="mt-2 max-w-xs text-[11px] text-slate-500">
                Enterprise‑grade hospital management for modern healthcare providers.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Product
              </p>
              <div className="mt-2 space-y-1.5">
                <span className="block hover:text-sky-600">Overview</span>
                <span className="block hover:text-sky-600">Modules</span>
                <span className="block hover:text-sky-600">Roadmap</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Features
              </p>
              <div className="mt-2 space-y-1.5">
                <span className="block hover:text-sky-600">Appointments</span>
                <span className="block hover:text-sky-600">Pharmacy</span>
                <span className="block hover:text-sky-600">Billing</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Security
              </p>
              <div className="mt-2 space-y-1.5">
                <span className="block hover:text-sky-600">Compliance</span>
                <span className="block hover:text-sky-600">Audit Logs</span>
                <span className="block hover:text-sky-600">Data Protection</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Company
              </p>
              <div className="mt-2 space-y-1.5">
                <span className="block hover:text-sky-600">Support</span>
                <span className="block hover:text-sky-600">Contact</span>
                <span className="block hover:text-sky-600">Status</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} HMS Cloud. All rights reserved.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/privacy" className="hover:text-sky-600">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-sky-600">
                Terms of Service
              </Link>
              <a href="mailto:support@hmscloud.io" className="hover:text-sky-600">
                support@hmscloud.io
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
