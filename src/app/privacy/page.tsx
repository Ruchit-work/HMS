"use client"

import Link from "next/link"

export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: "1. Information We Collect",
      items: [
        "Patient profile data such as name, age, gender, and contact information",
        "Medical records, prescriptions, symptoms, vitals, and appointment history",
        "Insurance, billing, and payment details that you share with our staff",
        "Technical data including login timestamps, device information, and usage analytics that help us secure your account",
      ],
    },
    {
      title: "2. How We Use Your Information",
      items: [
        "To schedule appointments, manage clinical workflows, and coordinate care",
        "To notify you about bookings, lab reports, medication reminders, and critical updates",
        "To comply with legal and regulatory obligations applicable to healthcare providers",
        "To improve the Hospital Management System experience while keeping your identity protected",
      ],
    },
    {
      title: "3. How We Protect Your Data",
      items: [
        "Role-based access controls for doctors, receptionists, administrators, and patients",
        "Encryption in transit (HTTPS) and at rest for sensitive health information",
        "Audit logs for appointment creation, edits, prescriptions, and billing actions",
        "Continuous monitoring for unusual login activity or unauthorized access attempts",
      ],
    },
    {
      title: "4. Your Rights",
      items: [
        "Request a copy of your medical records or download them from the patient dashboard",
        "Update or correct personal information by contacting reception or using the profile section",
        "Ask us to delete your account where legally permissible",
        "Opt in or out of WhatsApp/push/email notifications at any time",
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-white/40 p-6 sm:p-10">
        <header className="mb-8 text-center">
          <p className="text-sm uppercase tracking-widest text-blue-500 font-semibold mb-2">
            Patient Trust & Transparency
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
            Privacy & Data Protection Policy
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
            This policy explains how the Hospital Management System (“HMS”, “we”, “us”) collects, uses, and safeguards patient information across our web platform, dashboards, and WhatsApp booking flows.
          </p>
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="bg-gray-50 rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-inner">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{section.title}</h2>
              <ul className="space-y-2 list-disc pl-5 text-gray-700 leading-relaxed text-sm sm:text-base">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}

          <section className="bg-blue-50 rounded-2xl p-5 sm:p-6 border border-blue-100 shadow-inner">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Contact & Concerns</h2>
            <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-4">
              For privacy-related questions, data requests, or security concerns, reach out to our compliance desk any time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 text-sm font-medium text-gray-800">
              <span>📧 privacy@hms.com</span>
              <span>📞 +1 (555) 123-4567</span>
            </div>
          </section>
        </div>

        <footer className="mt-10 text-center text-sm text-gray-500">
          <p className="mb-2">Effective Date: January 2025</p>
          <p>
            Return to{" "}
            <Link href="/" className="text-blue-600 font-semibold hover:underline">
              Hospital Management System landing page
            </Link>{" "}
            or{" "}
            <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline">
              sign in
            </Link>{" "}
            to manage your appointments.
          </p>
        </footer>
      </div>
    </div>
  )
}

