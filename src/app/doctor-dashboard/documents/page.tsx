'use client'

import Link from "next/link"
import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import DocumentsTab from "@/features/documents/DocumentsTab"
import {
  ClinicalAlertCard,
  ClinicalFormSection,
  ClinicalPageFrame,
  ClinicalPageHeader,
} from "@/features/doctor/clinical"
import { TabSkeleton } from '@/shared/components'
import DoctorSettingsBackLink from "@/features/doctor/clinical/DoctorSettingsBackLink"
import { FileText } from "lucide-react"

export default function DoctorDocumentsPage() {
  const { user, loading: authLoading } = useAuth("doctor")
  const { loading: hospitalLoading } = useMultiHospital()
  const [selectedPatient] = useState<{ id: string; uid: string; patientId: string; firstName: string; lastName: string; email: string; phone?: string } | null>(null)

  if (authLoading || hospitalLoading) {
    return <TabSkeleton variant="documents" />
  }

  if (!user) {
    return (
      <ClinicalPageFrame>
        <ClinicalAlertCard variant="warning" title="Sign in required">
          Please log in to access patient documents and reports.
        </ClinicalAlertCard>
      </ClinicalPageFrame>
    )
  }

  return (
    <ClinicalPageFrame>
      <DoctorSettingsBackLink />
      <ClinicalPageHeader
        title="Documents & Reports"
        subtitle="Cross-patient search and upload. For visit context, open reports from Consultations."
        icon={<FileText className="w-5 h-5" />}
      />

      <ClinicalAlertCard variant="info" title="Patient context reports">
        Lab, radiology, prescriptions, and clinical documents are best reviewed inside the patient workspace.{" "}
        <Link href="/doctor-dashboard/appointments" className="font-semibold text-[var(--color-primary-dark)] hover:underline">
          Open Consultations →
        </Link>
        {" "}This page provides cross-patient search, upload, and file management.
      </ClinicalAlertCard>

      <ClinicalFormSection
        title="Patient documents"
        description="Browse and manage documents across your patient panel."
      >
        <DocumentsTab
          patientId={selectedPatient?.patientId}
          patientUid={selectedPatient?.uid}
          canUpload={true}
          canEdit={true}
          canDelete={true}
          showPatientSelector={true}
        />
      </ClinicalFormSection>
    </ClinicalPageFrame>
  )
}
