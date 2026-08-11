"use client"

import { useState, useEffect, useCallback, type FormEvent } from "react"
import {
  UserCheck,
  Layout,
  LayoutGrid,
  CheckCircle2,
  Lock,
  Save,
  RotateCcw,
  Sliders,
  FileText,
  Calendar,
  Layers,
  Info,
} from "lucide-react"
import { Button } from "@/shared/components"
import { useAuth } from "@/shared/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import {
  DEFAULT_RECEPTIONIST_MODULES,
  DEFAULT_RECEPTIONIST_SETTINGS,
  mergeReceptionistSettings,
} from "@/shared/constants/receptionistDefaults"
import { clearHospitalReceptionistSettingsCache } from "@/shared/hooks/useHospitalReceptionistSettings"
import type { HospitalReceptionistSettings, AddPatientFieldConfig, BookAppointmentFieldConfig } from "@/types/hospital"

type Notify = (type: "success" | "error", message: string) => void

interface FormFieldItem<T> {
  key: keyof T
  label: string
  description: string
}

const ADD_PATIENT_CONFIGURABLE_FIELDS: FormFieldItem<AddPatientFieldConfig>[] = [
  { key: "email", label: "Email Address", description: "Collect patient email for login portal" },
  { key: "gender", label: "Gender", description: "Select patient gender identity" },
  { key: "dateOfBirth", label: "Date of Birth", description: "Collect birth date for age calculation" },
  { key: "bloodGroup", label: "Blood Group", description: "Select blood type (A+, B+, O+, etc.)" },
  { key: "address", label: "Street Address", description: "Residential address line" },
  { key: "cityStatePincode", label: "City, State & PIN Code", description: "Detailed geographical location" },
  { key: "alternatePhone", label: "Alternate Phone", description: "Secondary contact phone number" },
  { key: "emergencyContact", label: "Emergency Contact", description: "Emergency contact name and phone" },
  { key: "maritalStatus", label: "Marital Status", description: "Single, Married, Divorced, etc." },
  { key: "occupation", label: "Occupation", description: "Patient employment/profession" },
  { key: "heightWeight", label: "Height & Weight", description: "Vitals: height (cm) and weight (kg)" },
  { key: "insurance", label: "Insurance Information", description: "Provider name and policy number" },
  { key: "documents", label: "Patient Documents & ID Proofs", description: "Upload government ID, insurance cards, or medical records" },
  { key: "passwordFields", label: "Password & Credentials", description: "Initial portal password inputs (pre-filled with 123456 if hidden)" },
  { key: "status", label: "Account Status", description: "Patient account status selector (Active / Inactive)" },
]

const BOOK_APPOINTMENT_CONFIGURABLE_FIELDS: FormFieldItem<BookAppointmentFieldConfig>[] = [
  { key: "visitType", label: "Visit Type", description: "OPD and IPD visit type selection" },
  { key: "symptoms", label: "Symptom Category & Notes", description: "Symptom selector and chief complaint text" },
  { key: "appointmentDate", label: "Appointment Date", description: "Date picker for selecting consultation date" },
  { key: "appointmentTime", label: "Time Slot Selection", description: "Available time slot grid for doctor booking" },
  { key: "additionalFees", label: "Additional Services & Fees", description: "Itemized extra fees / procedure charges" },
  { key: "paymentMethod", label: "Payment Collection", description: "Payment method selection (Cash, UPI, Card)" },
  { key: "patientConsent", label: "Patient Consent Video / Media", description: "Require/play consent video during booking" },
  { key: "documents", label: "Appointment Documents & Reports", description: "Attach lab reports, previous prescriptions, or referral slips" },
]

export default function HospitalReceptionistSettings({ onNotify }: { onNotify?: Notify }) {
  const { user } = useAuth()
  const { activeHospitalId } = useMultiHospital()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [interfaceMode, setInterfaceMode] = useState<"professional" | "simple">("professional")
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(
    DEFAULT_RECEPTIONIST_SETTINGS.enabledModules
  )
  const [addPatientFields, setAddPatientFields] = useState<AddPatientFieldConfig>(
    DEFAULT_RECEPTIONIST_SETTINGS.formFields.addPatient
  )
  const [bookAppointmentFields, setBookAppointmentFields] = useState<BookAppointmentFieldConfig>(
    DEFAULT_RECEPTIONIST_SETTINGS.formFields.bookAppointment
  )

  const loadSettings = useCallback(async () => {
    if (!activeHospitalId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await authedFetchJson<{ success: boolean; settings: HospitalReceptionistSettings }>(
        `/api/admin/hospital-receptionist-settings?hospitalId=${encodeURIComponent(activeHospitalId)}`
      )
      const merged = mergeReceptionistSettings(res.settings)
      setInterfaceMode(merged.interfaceMode)
      setEnabledModules(merged.enabledModules)
      setAddPatientFields(merged.formFields.addPatient)
      setBookAppointmentFields(merged.formFields.bookAppointment)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load receptionist settings"
      onNotify?.("error", msg)
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId, onNotify])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const toggleModule = (id: string) => {
    setEnabledModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const toggleAddPatientField = (key: keyof AddPatientFieldConfig) => {
    setAddPatientFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const toggleBookAppointmentField = (key: keyof BookAppointmentFieldConfig) => {
    setBookAppointmentFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleReset = () => {
    setInterfaceMode(DEFAULT_RECEPTIONIST_SETTINGS.interfaceMode)
    setEnabledModules(DEFAULT_RECEPTIONIST_SETTINGS.enabledModules)
    setAddPatientFields(DEFAULT_RECEPTIONIST_SETTINGS.formFields.addPatient)
    setBookAppointmentFields(DEFAULT_RECEPTIONIST_SETTINGS.formFields.bookAppointment)
    onNotify?.("success", "Reset to default receptionist configuration.")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isAdmin || !activeHospitalId) return

    setSaving(true)
    try {
      const payload = {
        hospitalId: activeHospitalId,
        interfaceMode,
        enabledModules,
        formFields: {
          addPatient: addPatientFields,
          bookAppointment: bookAppointmentFields,
        },
      }

      const res = await authedFetchJson<{ message?: string }>(
        "/api/admin/hospital-receptionist-settings",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      )

      clearHospitalReceptionistSettingsCache(activeHospitalId)
      onNotify?.("success", res.message || "Receptionist experience settings saved successfully.")
      await loadSettings()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings"
      onNotify?.("error", msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          Loading hospital receptionist experience settings…
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-6 text-white shadow-md sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-300">
              <UserCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Hospital Settings</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Receptionist Experience Builder</h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Customize the front desk interface mode, active operational modules, and form field visibility tailored specifically to your hospital.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving || !isAdmin}
              className="border-slate-700 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset Defaults
            </Button>
            <Button
              type="submit"
              disabled={saving || !isAdmin}
              className="bg-cyan-600 text-xs font-semibold text-white hover:bg-cyan-500 shadow-sm"
            >
              {saving ? (
                <>
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 1. Interface Mode Selection */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-5 w-5 text-cyan-600" />
          <h2 className="text-lg font-bold text-slate-900">1. Receptionist Interface Mode</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Select how receptionists navigate and interact with the hospital system on their dashboard.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Professional Mode */}
          <div
            onClick={() => setInterfaceMode("professional")}
            className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all ${
              interfaceMode === "professional"
                ? "border-cyan-600 bg-cyan-50/40 ring-2 ring-cyan-600/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${interfaceMode === "professional" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Layout className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Professional Mode (Default)</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Standard Navigation Sidebar</span>
                  </div>
                </div>
                {interfaceMode === "professional" && (
                  <CheckCircle2 className="h-5 w-5 text-cyan-600 shrink-0" />
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Classic multi-panel interface featuring a side navigation bar, badge notifications, tab caching, and quick action sub-menus. Ideal for high-volume hospital reception desks.
              </p>
            </div>
          </div>

          {/* Simple Mode */}
          <div
            onClick={() => setInterfaceMode("simple")}
            className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all ${
              interfaceMode === "simple"
                ? "border-cyan-600 bg-cyan-50/40 ring-2 ring-cyan-600/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${interfaceMode === "simple" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Simple Action Mode</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Touch-Friendly Action Cards</span>
                  </div>
                </div>
                {interfaceMode === "simple" && (
                  <CheckCircle2 className="h-5 w-5 text-cyan-600 shrink-0" />
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Streamlined, touch-friendly grid displaying large action cards for active modules. Responsive auto-layout (1 to 4 cards) designed for fast, frictionless single-task operations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Receptionist Modules */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-cyan-600" />
          <h2 className="text-lg font-bold text-slate-900">2. Active Receptionist Modules</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Enable or disable receptionist features for this hospital. Disabled modules will be hidden from the sidebar and action grid.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DEFAULT_RECEPTIONIST_MODULES.map((mod) => {
            const isEnabled = enabledModules[mod.id] !== false
            return (
              <div
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`flex items-start justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isEnabled
                    ? "border-cyan-200 bg-cyan-50/30 text-slate-900"
                    : "border-slate-200 bg-slate-50/50 text-slate-400 hover:border-slate-300"
                }`}
              >
                <div className="pr-3">
                  <p className="text-xs font-bold">{mod.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{mod.description}</p>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? "bg-cyan-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Form Field Visibility Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Patient Fields */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-cyan-600" />
            <h2 className="text-base font-bold text-slate-900">3. Add Patient Form Fields</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Control optional patient profile fields. Locked system fields cannot be turned off.
          </p>

          {/* System Locked Fields */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                First Name, Last Name, Phone Number
              </span>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                System Required
              </span>
            </div>
          </div>

          {/* Configurable Fields List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {ADD_PATIENT_CONFIGURABLE_FIELDS.map((item) => {
              const isChecked = addPatientFields[item.key] !== false
              return (
                <label
                  key={item.key}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked ? "border-cyan-200 bg-cyan-50/20" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleAddPatientField(item.key)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </label>
              )
            })}
          </div>
        </div>

        {/* Book Appointment Fields */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-cyan-600" />
            <h2 className="text-base font-bold text-slate-900">4. Book Appointment Form Fields</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Control optional appointment booking fields per hospital requirements.
          </p>

          {/* System Locked Fields */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                Patient, Doctor
              </span>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                System Required
              </span>
            </div>
          </div>

          {/* Configurable Fields List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {BOOK_APPOINTMENT_CONFIGURABLE_FIELDS.map((item) => {
              const isChecked = bookAppointmentFields[item.key] !== false
              return (
                <label
                  key={item.key}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isChecked ? "border-cyan-200 bg-cyan-50/20" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleBookAppointmentField(item.key)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-cyan-900">
        <Info className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold">Hospital Scoped Configuration</p>
          <p className="text-cyan-800">
            All receptionist settings saved here apply exclusively to the current active hospital. Changing options for this hospital will not impact any other registered hospitals in the HMS.
          </p>
        </div>
      </div>

      {/* Submit Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={saving || !isAdmin}
          className="text-xs text-slate-600"
        >
          Reset Defaults
        </Button>
        <Button
          type="submit"
          disabled={saving || !isAdmin}
          className="bg-cyan-600 text-xs font-semibold text-white hover:bg-cyan-500 shadow-sm px-6"
        >
          {saving ? (
            <>
              <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving Settings…
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
