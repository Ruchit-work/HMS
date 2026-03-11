'use client'

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import DocumentsTab from "@/components/documents/DocumentsTab"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"

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
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-sky-50/80 shadow-sm bg-[radial-gradient(ellipse_90%_70%_at_70%_20%,rgba(14,165,233,0.25),transparent)]">
          <div className="relative px-6 sm:px-8 py-6 sm:py-8 flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between text-slate-900">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shadow-sm">
                📁
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Documents &amp; Reports</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Manage patient documents, link them to visits, and quickly find what you need.
                </p>
              </div>
            </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-sm">
                <p className="flex items-center gap-1 text-slate-800 font-semibold">
                  <span>🧪</span> Lab / Radiology
                </p>
                <p className="mt-1 text-slate-600">
                  Auto-detected lab &amp; imaging reports.
                </p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-sm">
                <p className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <span>🔗</span> Visit linked
                </p>
                <p className="mt-1 text-slate-600">
                  Attached to each appointment history.
                </p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 shadow-sm col-span-2 sm:col-span-1">
                <p className="flex items-center gap-1 text-amber-600 font-semibold">
                  <span>🔍</span> Smart filters
                </p>
                <p className="mt-1 text-slate-600">
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

