"use client"

import Link from "next/link"
import { useAuth } from "@/shared/hooks/useAuth"
import {
  ClinicalAlertCard,
  ClinicalPageFrame,
  ClinicalPageHeader,
} from "@/features/doctor/clinical"
import { getSettingsHubItems } from "@/features/doctor/nav"
import {
  BarChart3,
  CalendarPlus,
  ChevronRight,
  FileText,
  Info,
  Settings,
  User,
} from "lucide-react"

const GROUP_LABELS = {
  account: "Account",
  practice: "Practice tools",
  scheduling: "Scheduling",
} as const

const ICONS = {
  profile: User,
  about: Info,
  analytics: BarChart3,
  documents: FileText,
  book: CalendarPlus,
}

export default function DoctorSettingsPage() {
  const { user, loading } = useAuth("doctor")
  const items = getSettingsHubItems()

  if (loading) {
    return <div className="min-h-[40vh]" aria-busy="true" />
  }
  if (!user) return null

  const groups = (["account", "practice", "scheduling"] as const).map((group) => ({
    key: group,
    label: GROUP_LABELS[group],
    items: items.filter((i) => i.group === group),
  }))

  return (
    <ClinicalPageFrame maxWidth="6xl">
      <ClinicalPageHeader
        title="Settings"
        subtitle="Account, insights, and tools you rarely need during active consultations."
        icon={<Settings className="w-5 h-5" />}
      />

      <ClinicalAlertCard variant="info" title="Clinical work stays in the sidebar">
        Consultations, Overview, and Inpatients remain your primary navigation. Open these settings
        before or after clinic — not mid-consultation.
      </ClinicalAlertCard>

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.items.map((item) => {
                const Icon = ICONS[item.id as keyof typeof ICONS] || Settings
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="clinical-surface flex items-start gap-3 p-4 hover:border-teal-200 hover:shadow-sm transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 shrink-0" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </ClinicalPageFrame>
  )
}
