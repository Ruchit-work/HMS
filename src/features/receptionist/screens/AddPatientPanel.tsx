"use client"

import { useState } from "react"
import { auth } from "@/firebase/config"
import { useAuth } from "@/shared/hooks/useAuth"
import PatientProfileForm, { type PatientProfileFormValues } from "@/features/forms/PatientProfileForm"
import { uploadPatientDocuments } from "@/shared/utils/documents/uploadPatientDocuments"
import type { AddPatientFieldConfig } from "@/types/hospital"
import type { ReceptionistTab } from "@/features/receptionist/components/ReceptionistTabPanels"
import { UserPlus, ArrowLeft } from "lucide-react"

interface AddPatientPanelProps {
  receptionistBranchId?: string | null
  onNotification?: (payload: { type: "success" | "error"; message: string } | null) => void
  onTabChange?: (tab: ReceptionistTab) => void
  fieldConfig?: AddPatientFieldConfig
}

export default function AddPatientPanel({
  receptionistBranchId = null,
  onNotification,
  onTabChange,
  fieldConfig,
}: AddPatientPanelProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreatePatient = async (values: PatientProfileFormValues) => {
    try {
      setLoading(true)
      setError(null)

      const normalizedCountryCode = (values.countryCode || "+91").trim() || "+91"
      const normalizedPhone = values.phone.trim()

      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: `${normalizedCountryCode}${normalizedPhone}`,
        phoneCountryCode: normalizedCountryCode,
        phoneNumber: normalizedPhone,
        gender: values.gender,
        bloodGroup: values.bloodGroup,
        address: values.address,
        dateOfBirth: values.dateOfBirth,
        heightCm: values.heightCm || "",
        weightKg: values.weightKg || "",
        status: values.status ?? "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.role ?? "receptionist",
      }

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to create patients")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/receptionist/create-patient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ patientData: payload, password: values.password }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create patient")
      }

      const createdPatientUid = data?.id || data?.uid
      const createdPatientId = data?.patientId || createdPatientUid

      let documentWarning: string | null = null
      if (values.attachedFiles && values.attachedFiles.length > 0 && createdPatientUid) {
        const uploadResult = await uploadPatientDocuments({
          files: values.attachedFiles,
          patientUid: createdPatientUid,
          patientId: createdPatientId,
        })
        if (uploadResult.errors.length > 0) {
          if (uploadResult.successCount > 0) {
            documentWarning = `${uploadResult.successCount} file(s) uploaded. Warning: ${uploadResult.errors.join("; ")}`
          } else {
            documentWarning = `Document upload failed: ${uploadResult.errors.join("; ")}`
          }
        }
      }

      if (documentWarning) {
        onNotification?.({
          type: "success",
          message: `Patient added successfully! ${documentWarning}`,
        })
      } else {
        onNotification?.({
          type: "success",
          message: "Patient registered successfully!",
        })
      }

      onTabChange?.("dashboard")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 shrink-0">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add New Patient</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Register a new patient profile directly into the hospital database
            </p>
          </div>
        </div>
        {onTabChange && (
          <button
            type="button"
            onClick={() => onTabChange("dashboard")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        )}
      </div>

      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <PatientProfileForm
          mode="admin"
          loading={loading}
          externalError={error}
          onErrorClear={() => setError(null)}
          onSubmit={handleCreatePatient}
          onCancel={onTabChange ? () => onTabChange("dashboard") : undefined}
          submitLabel="Register Patient"
          receptionistMode={receptionistBranchId != null || true}
          initialValues={{ password: "123456" }}
          fieldConfig={fieldConfig}
        />
      </div>
    </div>
  )
}
