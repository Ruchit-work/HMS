import Link from "next/link"
import type { ReactNode } from "react"

export type LegalSection = {
  id: string
  title: string
  intro?: string
  items?: string[]
  extra?: ReactNode
}

type LegalDocumentPageProps = {
  eyebrow: string
  title: string
  description: string
  lastUpdated: string
  effectiveDate: string
  version: string
  sections: LegalSection[]
  contactExtra?: ReactNode
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

export function LegalDocumentPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  effectiveDate,
  version,
  sections,
  contactExtra,
}: LegalDocumentPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 px-4 py-12 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-3xl border border-white/40 bg-white/90 p-6 shadow-2xl backdrop-blur sm:p-10">
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-500">{eyebrow}</p>
          <h1 className="mb-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">{title}</h1>
          <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">{description}</p>
          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <MetaPill label="Last Updated" value={lastUpdated} />
            <MetaPill label="Effective Date" value={effectiveDate} />
            <MetaPill label="Policy Version" value={version} />
          </div>
        </header>

        <nav aria-label="Document sections" className="mb-8 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
          <ol className="grid grid-cols-1 gap-2 text-sm text-cyan-800 sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="font-medium hover:underline">
                  {index + 1}. {section.title.replace(/^\d+\.\s*/, "")}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-8">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-8 rounded-2xl border border-gray-100 bg-gray-50 p-5 shadow-inner sm:p-6"
            >
              <h2 className="mb-3 text-xl font-bold text-gray-900">{section.title}</h2>
              {section.intro ? (
                <p className="mb-3 text-sm leading-relaxed text-gray-700 sm:text-base">{section.intro}</p>
              ) : null}
              {section.items && section.items.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700 sm:text-base">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.extra}
            </section>
          ))}

          <section
            id="contact"
            className="scroll-mt-8 rounded-2xl border border-blue-100 bg-cyan-50 p-5 shadow-inner sm:p-6"
          >
            <h2 className="mb-3 text-xl font-bold text-gray-900">Contact</h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-700 sm:text-base">
              For legal requests, product support, or general enquiries about HMS Cloud, use the contacts below.
              Please include your hospital name and registered account email so we can respond promptly.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-100 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Legal Contact</p>
                <a
                  href="mailto:admin@mivs.in?subject=HMS%20Cloud%20Legal%20Enquiry"
                  className="mt-1 block text-sm font-semibold text-slate-900 hover:text-cyan-700 hover:underline"
                >
                  admin@mivs.in
                </a>
                <p className="mt-1 text-xs text-slate-500">Mark subject as Legal Enquiry</p>
              </div>
              <div className="rounded-xl border border-cyan-100 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Support Contact</p>
                <a
                  href="mailto:admin@mivs.in?subject=HMS%20Cloud%20Support"
                  className="mt-1 block text-sm font-semibold text-slate-900 hover:text-cyan-700 hover:underline"
                >
                  admin@mivs.in
                </a>
                <p className="mt-1 text-xs text-slate-500">Product & technical assistance</p>
              </div>
              <div className="rounded-xl border border-cyan-100 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Business Address</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">HMS Cloud by MIVS Software</p>
                <p className="mt-1 text-xs text-slate-500">India</p>
                <a
                  href="https://www.mivs.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs font-medium text-cyan-700 hover:underline"
                >
                  www.mivs.in
                </a>
              </div>
            </div>
            {contactExtra}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center sm:p-6">
            <h2 className="text-xl font-bold text-gray-900">Need Help?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 sm:text-base">
              Our team can help with account access, hospital onboarding, and policy questions.
            </p>
            <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <a
                href="mailto:admin@mivs.in?subject=HMS%20Cloud%20Support"
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition hover:bg-sky-700"
              >
                Contact Support
              </a>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Return Home
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-xl border border-transparent px-5 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50"
              >
                Login
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-10 text-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} HMS Cloud. All rights reserved. Powered by{" "}
            <a
              href="https://www.mivs.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 hover:underline"
            >
              MIVS Software
            </a>
            .
          </p>
        </footer>
      </article>
    </div>
  )
}
