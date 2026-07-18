"use client"

import { useState } from "react"
import { CreditCard, Settings } from "lucide-react"
import HospitalBillingSettings from "@/features/admin/screens/HospitalBillingSettings"

type Notify = (type: "success" | "error", message: string) => void

type SettingsSection = "billing"

export default function HospitalSettingsCenter({ onNotify }: { onNotify: Notify }) {
  const [section, setSection] = useState<SettingsSection>("billing")

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
              Configure operational policies for your hospital. Changes apply only to the currently selected hospital.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      </div>

      {section === "billing" ? <HospitalBillingSettings onNotify={onNotify} /> : null}
    </div>
  )
}
