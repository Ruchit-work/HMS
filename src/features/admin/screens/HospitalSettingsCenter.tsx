"use client"

import { useState } from "react"
import { Building, Clock, CreditCard, Printer, Settings, UserCheck } from "lucide-react"
import HospitalBillingSettings from "@/features/admin/screens/HospitalBillingSettings"
import { HospitalPrintSettingsScreen } from "@/features/admin/screens/HospitalPrintSettingsScreen"
import ScheduleManagement from "@/features/admin/components/ScheduleManagement"
import GeneralSettings from "@/features/admin/components/GeneralSettings"
import HospitalReceptionistSettings from "@/features/admin/components/HospitalReceptionistSettings"

type Notify = (type: "success" | "error", message: string) => void

type SettingsSection = "general" | "schedule" | "billing" | "print" | "receptionist"

export default function HospitalSettingsCenter({ onNotify }: { onNotify: Notify }) {
  const [section, setSection] = useState<SettingsSection>("general")

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Settings className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Hospital Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure general hospital details, working schedules, billing policies, print branding, and receptionist experience.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSection("general")}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              section === "general"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            General Settings
          </button>

          <button
            type="button"
            onClick={() => setSection("schedule")}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              section === "schedule"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Working Hours & Schedule
          </button>

          <button
            type="button"
            onClick={() => setSection("billing")}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              section === "billing"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Billing & Payment Settings
          </button>

          <button
            type="button"
            onClick={() => setSection("print")}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              section === "print"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Printer className="h-3.5 w-3.5" />
            Print & Document Branding
          </button>

          <button
            type="button"
            onClick={() => setSection("receptionist")}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              section === "receptionist"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Receptionist Settings
          </button>
        </div>
      </div>

      {section === "general" ? <GeneralSettings onNotify={onNotify} /> : null}
      {section === "schedule" ? <ScheduleManagement onNotify={onNotify} /> : null}
      {section === "billing" ? <HospitalBillingSettings onNotify={onNotify} /> : null}
      {section === "print" ? <HospitalPrintSettingsScreen onNotify={onNotify} /> : null}
      {section === "receptionist" ? <HospitalReceptionistSettings onNotify={onNotify} /> : null}
    </div>
  )
}
