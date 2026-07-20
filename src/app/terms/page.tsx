import type { Metadata } from "next"
import { LegalDocumentPage, type LegalSection } from "@/shared/ui/legal/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Terms & Conditions | HMS Cloud",
  description:
    "Terms governing hospital, staff, and patient use of HMS Cloud — appointments, payments, security, medical disclaimer, and Indian jurisdiction.",
  openGraph: {
    title: "Terms & Conditions | HMS Cloud",
    description:
      "Enterprise terms for hospitals and clinics using HMS Cloud for appointments, clinical workflows, billing, and patient communication.",
    type: "website",
  },
}

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    intro:
      "By accessing or using HMS Cloud (the “Platform”), you agree to these Terms & Conditions and our Privacy & Data Protection Policy. If you do not agree, do not use the Platform. Hospitals that subscribe to HMS Cloud are responsible for ensuring their authorised users understand and follow these terms.",
    items: [
      "These terms apply to hospital administrators, doctors, receptionists, pharmacists, patients, and other authorised users",
      "Continued use after updates constitutes acceptance of the revised terms",
      "Additional hospital-specific policies (for example cancellation or refund rules) may apply inside each tenant",
    ],
  },
  {
    id: "platform-usage",
    title: "2. Platform Usage",
    intro: "HMS Cloud may be used only for legitimate healthcare operations and related administrative purposes.",
    items: [
      "Use the Platform only with valid credentials issued or approved by your hospital",
      "Do not attempt to access another hospital’s data, bypass security controls, or disrupt service availability",
      "Do not upload unlawful, harmful, or misleading content",
      "Do not reverse engineer, resell, or misuse the software except as permitted by written agreement",
      "Automated scraping or abusive API usage is prohibited",
    ],
  },
  {
    id: "hospital-responsibilities",
    title: "3. Hospital Responsibilities",
    intro: "Hospital administrators are responsible for the tenant environment under their control, including:",
    items: [
      "Creating and managing staff accounts for doctors, receptionists, pharmacists, and other roles",
      "Assigning permissions and ensuring least-privilege access appropriate to each role",
      "Maintaining accuracy of patient demographic and operational data entered by hospital staff",
      "Configuring billing, refund, cancellation, and branch settings that reflect hospital policy",
      "Training staff on privacy, clinical documentation standards, and secure use of the Platform",
      "Responding to patient requests that must be handled by the hospital as the data controller for clinical records",
    ],
  },
  {
    id: "user-responsibilities",
    title: "4. User Responsibilities",
    intro: "Each user role must use HMS Cloud carefully and lawfully:",
    items: [
      "Doctors — document care accurately, protect clinical confidentiality, and complete workflows only for patients under their authorised scope",
      "Receptionists — verify patient identity where required, book and update appointments correctly, and handle billing information with care",
      "Patients — provide accurate personal details, keep login credentials secure, and follow hospital instructions for appointments and payments",
      "Admins — supervise staff access, monitor critical settings, and ensure hospital policies are reflected in Platform configuration",
    ],
  },
  {
    id: "appointments",
    title: "5. Appointments",
    intro: "Appointment features support booking, changes, and attendance tracking across hospital channels.",
    items: [
      "Booking — appointments may be created by staff, patients, or approved digital channels such as WhatsApp where enabled",
      "Cancellation — cancellations follow the hospital’s configured paid-appointment and refund policies",
      "Rescheduling — where offered, rescheduling depends on slot availability and hospital rules",
      "No-show — hospitals may mark patients as not attended; fees or rebooking rules are set by the hospital",
      "Hospital-specific cancellation policy applies — HMS Cloud enforces the policy configured for that hospital and does not independently guarantee refunds",
    ],
  },
  {
    id: "payments",
    title: "6. Payments",
    intro: "Payment behaviour is controlled by each hospital’s billing settings and local collection practices.",
    items: [
      "Cash, UPI, cards, and other enabled methods may be accepted at the front desk or through supported digital flows",
      "Refund policy is hospital-configurable (disabled, manual approval, or automatic) and may differ by tenant",
      "Advance and partial payments may be collected when the hospital enables those options",
      "Hospital billing rules govern consultation fees, remaining balances, and settlement of outstanding amounts",
      "HMS Cloud records payment status for operational use; settlement with banks or payment partners remains a hospital / provider responsibility",
    ],
  },
  {
    id: "medical-disclaimer",
    title: "7. Medical Disclaimer",
    intro: "Please read this carefully:",
    items: [
      "HMS Cloud is software that assists healthcare providers with operations, documentation, and coordination",
      "The Platform does not provide medical advice, diagnosis, or treatment recommendations on its own",
      "Clinical decisions remain the responsibility of licensed healthcare professionals and the treating hospital",
      "Emergency care should be sought through appropriate medical emergency services — not through the Platform alone",
    ],
  },
  {
    id: "security",
    title: "8. Security",
    intro: "Users share responsibility for keeping accounts secure.",
    items: [
      "Choose strong passwords and do not share credentials with unauthorised persons",
      "Enable and use multi-factor authentication (MFA) where available",
      "Sign out of shared devices and report suspected account compromise immediately",
      "Hospitals must promptly disable access for staff who leave or change roles",
      "Users must not attempt to circumvent access controls, audit logging, or security monitoring",
    ],
  },
  {
    id: "intellectual-property",
    title: "9. Intellectual Property",
    items: [
      "The HMS Cloud software, design, trademarks, and platform intellectual property belong to HMS Cloud / MIVS Software and its licensors",
      "Hospitals retain ownership of their patient data, clinical records, and operational content entered into their tenant",
      "Users receive a limited, non-exclusive right to use the Platform for authorised hospital operations under their subscription or access grant",
      "No licence is granted to copy, redistribute, or create derivative products from the Platform except as agreed in writing",
    ],
  },
  {
    id: "limitation-of-liability",
    title: "10. Limitation of Liability",
    intro:
      "To the maximum extent permitted by applicable law, HMS Cloud and its operators provide the Platform on an “as available” basis for operational assistance.",
    items: [
      "We are not liable for clinical outcomes, medical decisions, or treatment results arising from use of the Platform",
      "We are not responsible for hospital misconfiguration, inaccurate staff data entry, or unauthorised use of hospital accounts",
      "We are not liable for delays or failures caused by third-party networks, messaging providers, payment partners, or force majeure events",
      "Where liability cannot be excluded, it is limited to direct damages and, to the extent permitted by law, to fees paid for the Platform during the preceding three months",
      "Nothing in these terms excludes liability that cannot be limited under Indian law",
    ],
  },
  {
    id: "termination",
    title: "11. Termination",
    intro: "Access may be suspended or terminated when necessary to protect patients, hospitals, or the Platform.",
    items: [
      "Accounts may be suspended for security incidents, policy violations, or non-payment under the hospital’s commercial agreement",
      "Hospitals may disable staff or patient access according to their internal procedures",
      "Upon termination of a hospital subscription, access ends subject to agreed data export and retention arrangements",
      "Provisions on intellectual property, liability, governing law, and confidentiality survive termination",
    ],
  },
  {
    id: "governing-law",
    title: "12. Governing Law",
    items: [
      "These Terms & Conditions are governed by the laws of India",
      "Courts in India shall have exclusive jurisdiction over disputes arising from or relating to the Platform, subject to any mandatory consumer or healthcare protections",
      "Hospitals and users agree to seek good-faith resolution before formal proceedings where reasonably possible",
    ],
  },
  {
    id: "changes-to-terms",
    title: "13. Changes to Terms",
    items: [
      "We may update these Terms & Conditions to reflect product, legal, or operational changes",
      "Material changes will be communicated through the Platform, website notice, or email to hospital administrators where reasonably practicable",
      "The Last Updated and Effective Date shown on this page indicate when the current version applies",
      "Continued use after the effective date of updated terms constitutes acceptance",
    ],
  },
]

export default function TermsAndConditionsPage() {
  return (
    <LegalDocumentPage
      eyebrow="Legal Agreement"
      title="Terms & Conditions"
      description="These Terms & Conditions govern access to and use of HMS Cloud by hospitals, clinics, clinicians, staff, and patients. Please read them carefully together with our Privacy & Data Protection Policy."
      lastUpdated="20 July 2026"
      effectiveDate="20 July 2026"
      version="1.0"
      sections={SECTIONS}
    />
  )
}
