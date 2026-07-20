import type { Metadata } from "next"
import { LegalDocumentPage, type LegalSection } from "@/shared/ui/legal/LegalDocumentPage"

export const metadata: Metadata = {
  title: "Privacy & Data Protection Policy | HMS Cloud",
  description:
    "Learn how HMS Cloud collects, uses, protects, and retains hospital, patient, and staff information across clinical, billing, and WhatsApp workflows.",
  openGraph: {
    title: "Privacy & Data Protection Policy | HMS Cloud",
    description:
      "Enterprise privacy practices for hospitals and clinics using HMS Cloud — encryption, access control, audit logs, and patient rights.",
    type: "website",
  },
}

const SECTIONS: LegalSection[] = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    intro:
      "Depending on your role and how your hospital configures HMS Cloud, we may process the following categories of information:",
    items: [
      "Patient information such as name, date of birth, gender, contact details, patient identifiers, and demographic profile data",
      "Doctor information including specialty, schedule, credentials shown in the system, and clinical account details",
      "Staff accounts for hospital administrators, receptionists, pharmacists, and other authorised hospital users",
      "Contact information used for appointments, reminders, and operational communication",
      "Medical records and clinical notes entered by authorised care teams",
      "Prescriptions and medication details generated during consultations",
      "Uploaded documents such as reports, consent forms, identity proofs, and clinical attachments",
      "Billing information including consultation fees, invoices, payment status, payment methods, and transaction references",
      "Appointment history including bookings, reschedules, cancellations, check-ins, and attendance outcomes",
      "Login history and authentication events associated with secure account access",
      "Device and technical information reasonably required for security, diagnostics, and service reliability",
      "Audit logs of important business actions for accountability and compliance review",
      "WhatsApp booking data when patients or staff interact with hospital WhatsApp booking and confirmation flows",
    ],
  },
  {
    id: "how-we-use-information",
    title: "2. How We Use Information",
    intro: "We use information only for legitimate healthcare operations and platform administration, including:",
    items: [
      "Appointment management — booking, confirmation, rescheduling, cancellation, and attendance tracking",
      "Clinical workflows — supporting consultations, prescriptions, documents, and inpatient coordination",
      "Billing — generating invoices, recording payments, advances, partial collections, and refund workflows configured by the hospital",
      "Notifications — appointment reminders, operational alerts, and service updates authorised by the hospital",
      "WhatsApp communication — booking assistance, confirmations, and hospital-approved patient messaging",
      "Security — authenticating users, detecting abuse, and protecting accounts and records",
      "Legal compliance — meeting applicable healthcare, privacy, and record-keeping obligations",
      "Analytics — aggregated operational insights that help hospitals improve service delivery",
      "Platform improvements — reliability, usability, and product quality without selling personal health data",
    ],
  },
  {
    id: "data-protection",
    title: "3. Data Protection",
    intro: "HMS Cloud is designed with hospital-grade controls intended to safeguard sensitive information:",
    items: [
      "HTTPS encryption for data transmitted between browsers, APIs, and cloud services",
      "Role-based access so doctors, receptionists, admins, pharmacists, and patients only see what their role permits",
      "Audit logs for critical business actions such as appointments, billing changes, admissions, and user administration",
      "Secure authentication with password protection and multi-factor options where enabled",
      "Backup and disaster-recovery practices aligned with cloud infrastructure resilience",
      "Activity monitoring for unusual access patterns and operational health of core services",
      "Access control at hospital and branch level for multi-tenant healthcare deployments",
    ],
  },
  {
    id: "patient-rights",
    title: "4. Patient Rights",
    intro:
      "Subject to hospital policy and applicable law, patients may exercise the following rights through the patient portal or by contacting the hospital / HMS Cloud support:",
    items: [
      "Access records available in their patient dashboard and related hospital records",
      "Download appointment confirmations, prescriptions, and other documents made available by the hospital",
      "Request correction of inaccurate personal profile information",
      "Request deletion of account or personal data where legally allowed and operationally feasible",
      "Manage communication preferences for WhatsApp and other non-emergency notifications",
    ],
  },
  {
    id: "data-retention",
    title: "5. Data Retention",
    intro:
      "Retention periods depend on hospital policy and applicable healthcare, financial, and legal requirements. In general:",
    items: [
      "Medical records are retained for as long as required for continuity of care and statutory medical record obligations",
      "Billing records are retained for accounting, audit, dispute resolution, and tax or regulatory needs",
      "Audit logs are retained to support security investigations, accountability, and compliance reviews",
      "Appointment history is retained to support clinical follow-up, operations reporting, and patient service",
    ],
    extra: (
      <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">
        Exact retention windows may vary by hospital configuration and Indian healthcare or other applicable
        regulations. Hospitals remain responsible for defining local retention practices that meet their
        regulatory obligations.
      </p>
    ),
  },
  {
    id: "third-party-services",
    title: "6. Third Party Services",
    intro:
      "HMS Cloud relies on carefully selected infrastructure and communication providers to deliver the service:",
    items: [
      "Firebase — authentication, database, storage, and related cloud application services",
      "WhatsApp Business API / messaging providers — appointment booking, confirmations, and hospital messaging",
      "SMS providers — optional OTP or operational messaging where configured",
      "Payment gateway partners — may be introduced for online collections; hospitals control enabled payment methods",
      "Cloud infrastructure — hosting, networking, and operational resilience for the multi-hospital platform",
    ],
    extra: (
      <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">
        Third parties process data only as needed to provide their services and under contractual and technical
        safeguards appropriate to a healthcare SaaS environment.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "7. Cookies",
    intro: "We use cookies and similar technologies in a practical, limited way:",
    items: [
      "Essential cookies keep you signed in and remember hospital or session preferences needed for the product to work",
      "Security cookies help protect accounts and detect suspicious activity",
      "We do not use intrusive advertising cookies to sell personal health information",
      "You can control cookies through your browser settings; disabling essential cookies may limit platform features",
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      eyebrow="Patient Trust & Transparency"
      title="Privacy & Data Protection"
      description="This Privacy & Data Protection Policy explains how HMS Cloud (“HMS Cloud”, “we”, “us”) collects, uses, stores, and safeguards information for hospitals, clinics, doctors, staff, and patients across web dashboards, APIs, and WhatsApp booking flows."
      lastUpdated="20 July 2026"
      effectiveDate="20 July 2026"
      version="2.0"
      sections={SECTIONS}
    />
  )
}
