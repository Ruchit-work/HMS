'use client'

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import DocumentsTab from "@/components/documents/DocumentsTab"
import LoadingSpinner from "@/components/ui/StatusComponents"
import PatientSelector from "@/components/documents/PatientSelector"

export default function DoctorDocumentsPage() {
  const { user, loading: authLoading } = useAuth("doctor")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; uid: string; patientId: string; firstName: string; lastName: string; email: string; phone?: string } | null>(null)

  if (authLoading || hospitalLoading) {
    return <LoadingSpinner message="Loading..." />
  }

  if (!user) {
    return <div className="p-8 text-center">Please log in to access documents.</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Documents & Reports</h1>
          <p className="text-gray-600 mt-2">Manage patient documents and medical reports</p>
        </div>

        <DocumentsTab
          patientId={selectedPatient?.patientId}
          patientUid={selectedPatient?.uid}
          canUpload={true}
          canEdit={true}
          canDelete={true}
          showPatientSelector={true}
        />
      </div>
    </div>
  )
}

