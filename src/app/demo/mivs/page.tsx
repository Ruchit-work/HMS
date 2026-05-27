"use client"

import Link from "next/link"

const services = [
  {
    title: "AI Workflow Automation",
    description:
      "Intelligent workflows that replace manual steps with AI-driven decisions—scale operations without scaling headcount.",
  },
  {
    title: "Custom AI Agents",
    description:
      "Agents that reason over your data and tools—from document Q&A to task automation, tailored to your security needs.",
  },
  {
    title: "Chatbot & Conversational AI",
    description:
      "Enterprise-grade conversational interfaces with guardrails, your brand voice, and support for internal and customer-facing use.",
  },
  {
    title: "Business Process Optimization",
    description:
      "Map, analyze, and automate core processes while keeping governance and compliance at the center.",
  },
  {
    title: "AI Strategy & Consulting",
    description:
      "Roadmap to rollout: prioritize use cases, choose stack, and build capability so AI delivers lasting value.",
  },
]

const highlights = [
  { label: "Cost reduction", value: "40%", detail: "Average in automated processes" },
  { label: "Faster delivery", value: "3x", detail: "With AI-augmented workflows" },
  { label: "Engagements", value: "50+", detail: "Enterprise projects delivered" },
]

const industries = [
  "Financial Services",
  "Healthcare",
  "Retail & E-commerce",
  "Manufacturing",
  "Technology",
  "Government",
]

export default function MivsDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-sky-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
          >
            ← Back to HMS Cloud
          </Link>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Demo / Partner page
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-sky-700 px-6 py-10 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Technology partner
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">MIVS Software</h1>
            <p className="mt-1 text-lg text-indigo-100">Enterprise AI Automation & AI Consulting</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-indigo-50/90 sm:text-base">
              MIVS designs and deploys production-grade AI systems—from workflow automation and custom
              agents to full-stack healthcare platforms like HMS Cloud. Intelligent systems, built for
              scale, with security and governance from day one.
            </p>
            <a
              href="https://www.mivs.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-indigo-800 shadow-md hover:bg-indigo-50"
            >
              Visit mivs.in
              <span aria-hidden>↗</span>
            </a>
          </div>

          <div className="space-y-8 p-6 sm:p-10">
            <section>
              <h2 className="text-xl font-bold text-slate-900">About MIVS</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                MIVS helps enterprises architect intelligent operations through AI workflow automation,
                custom agents, and strategic consulting. Their work spans cloud, private VPC, and
                on-premises deployments—sovereign by design, with measurable outcomes and clear handover
                so your team can own the solution long term.
              </p>
            </section>

            <section className="rounded-2xl border border-sky-100 bg-sky-50/80 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">HMS Cloud & MIVS</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                This Hospital Management System is powered by MIVS Software. MIVS has delivered an
                advanced, AI-enabled hospital platform focused on patient care, operational efficiency,
                and data-driven insights for healthcare institutions—covering appointments, billing,
                pharmacy, clinical workflows, and multi-branch operations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">What MIVS delivers</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {services.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                  >
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Impact at a glance</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-violet-800">{item.value}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900">Industries served</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {industries.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">Deployment options</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <strong className="text-slate-900">Cloud</strong> — Fully managed, automatic scaling,
                  fastest time-to-value
                </li>
                <li>
                  <strong className="text-slate-900">Private Cloud (VPC)</strong> — Your security
                  perimeter, their management
                </li>
                <li>
                  <strong className="text-slate-900">On-Premises</strong> — Full control, air-gapped for
                  regulated industries
                </li>
              </ul>
            </section>

            <footer className="border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
              <p>
                Content on this page is illustrative and sourced from public information at{" "}
                <a
                  href="https://www.mivs.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-700 hover:underline"
                >
                  mivs.in
                </a>
                .
              </p>
              <p className="mt-3">
                <Link href="/" className="font-semibold text-sky-700 hover:underline">
                  Return to HMS Cloud home
                </Link>
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
