'use client'

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import DocumentsTab from "@/components/documents/DocumentsTab"
import LoadingSpinner from "@/components/ui/StatusComponents"

export default function DoctorDocumentsPage() {
  const { user, loading: authLoading } = useAuth("doctor")
  const { loading: hospitalLoading } = useMultiHospital()
  const [selectedPatient] = useState<{ id: string; uid: string; patientId: string; firstName: string; lastName: string; email: string; phone?: string } | null>(null)

  if (authLoading || hospitalLoading) {
    return <LoadingSpinner message="Loading..." />
  }

  if (!user) {
    return <div className="p-8 text-center">Please log in to access documents.</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-white pt-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero (aligned with appointments page style) */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-95" />
          <div className="relative px-6 sm:px-8 py-6 sm:py-8 flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between text-white">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shadow-sm">
                📁
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Documents &amp; Reports</h1>
                <p className="text-sm text-blue-100 mt-1">
                  Manage patient documents, link them to visits, and quickly find what you need.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
              <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 shadow-sm backdrop-blur">
                <p className="flex items-center gap-1 text-blue-50 font-semibold">
                  <span>🧪</span> Lab / Radiology
                </p>
                <p className="mt-1 text-blue-100/90">
                  Auto-detected lab &amp; imaging reports.
                </p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 shadow-sm backdrop-blur">
                <p className="flex items-center gap-1 text-emerald-50 font-semibold">
                  <span>🔗</span> Visit linked
                </p>
                <p className="mt-1 text-blue-100/90">
                  Attached to each appointment history.
                </p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 shadow-sm backdrop-blur col-span-2 sm:col-span-1">
                <p className="flex items-center gap-1 text-amber-50 font-semibold">
                  <span>🔍</span> Smart filters
                </p>
                <p className="mt-1 text-blue-100/90">
                  Search by patient, type, date &amp; text.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main documents module */}
        <DocumentsTab
          patientId={selectedPatient?.patientId}
          patientUid={selectedPatient?.uid}
          canUpload={true}
          canEdit={true}
          canDelete={true}
          showPatientSelector={true}
        />
      </main>
    </div>
  )
}

