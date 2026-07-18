"use client"

import { useAuth } from "@/shared/hooks/useAuth"
import {
  ClinicalFormSection,
  ClinicalPageFrame,
  ClinicalPageHeader,
} from "@/features/doctor/clinical"
import DoctorSettingsBackLink from "@/features/doctor/clinical/DoctorSettingsBackLink"
import { Info } from "lucide-react"

export default function DoctorAbout() {
  const { user, loading } = useAuth("doctor")

  if (loading) {
    return <div className="min-h-[40vh]" aria-busy="true" />
  }

  if (!user) {
    return null
  }

  return (
    <ClinicalPageFrame maxWidth="6xl">
      <DoctorSettingsBackLink />
      <ClinicalPageHeader
        title="About Clinical Workspace"
        subtitle="Information for healthcare professionals using the doctor portal."
        icon={<Info className="w-5 h-5" />}
      />

      <ClinicalFormSection title="Overview">
        <p className="text-slate-600 leading-relaxed">
          The Doctor Portal is designed to help healthcare professionals manage their appointments efficiently.
          This comprehensive system provides all the tools you need to deliver excellent patient care while
          maintaining organized records and streamlined workflows.
        </p>
      </ClinicalFormSection>

      <ClinicalFormSection title="Key features">
        <ul className="space-y-3 text-slate-600">
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-primary)] font-bold">•</span>
            <span><strong className="text-slate-800">Consultation queue</strong> — See today&apos;s patients and complete visits in one workspace.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-primary)] font-bold">•</span>
            <span><strong className="text-slate-800">Prescriptions</strong> — Write and send prescriptions with AI-assisted suggestions.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-primary)] font-bold">•</span>
            <span><strong className="text-slate-800">Patient history</strong> — Review prior visits, diagnoses, and documents inline.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-primary)] font-bold">•</span>
            <span><strong className="text-slate-800">Inpatient rounds</strong> — Track admitted patients and document rounds.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--color-primary)] font-bold">•</span>
            <span><strong className="text-slate-800">Anatomy consultation</strong> — Visual diagnosis tools for ENT and related specialties.</span>
          </li>
        </ul>
      </ClinicalFormSection>

      <ClinicalFormSection title="Need help?">
        <p className="text-slate-600 leading-relaxed">
          Contact your hospital administrator for account issues, schedule changes, or technical support.
          For urgent clinical system issues, reach out to your IT department.
        </p>
      </ClinicalFormSection>
    </ClinicalPageFrame>
  )
}
