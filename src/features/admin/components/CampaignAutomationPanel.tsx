"use client"

import { useEffect, useState, type ReactNode } from "react"

export type AutomationKey =
  | "birthday"
  | "followUp"
  | "appointment"
  | "vaccination"
  | "healthAwareness"
  | "festival"

type QuickActionId = "new" | "duplicate" | "import" | "export" | "schedule"

const STORAGE_KEY = "hms.campaign.automation.toggles"

const QUICK_ACTIONS: {
  id: QuickActionId
  label: string
  description: string
  icon: ReactNode
}[] = [
  {
    id: "new",
    label: "New Campaign",
    description: "Guided compose",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    id: "duplicate",
    label: "Duplicate",
    description: "Clone selection",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    id: "import",
    label: "Import Audience",
    description: "Upload list",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
    ),
  },
  {
    id: "export",
    label: "Export Reports",
    description: "Download CSV",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
    ),
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Send later",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
]

const AUTOMATIONS: {
  key: AutomationKey
  label: string
  description: string
  statusHint: string
}[] = [
  {
    key: "birthday",
    label: "Birthday Campaign",
    description: "Wish patients on their birthday",
    statusHint: "Daily 08:00",
  },
  {
    key: "followUp",
    label: "Follow-up Reminder",
    description: "Post-visit check-in messages",
    statusHint: "After discharge +3d",
  },
  {
    key: "appointment",
    label: "Appointment Reminder",
    description: "Remind before scheduled visits",
    statusHint: "24h window",
  },
  {
    key: "vaccination",
    label: "Vaccination Reminder",
    description: "Due-dose and booster alerts",
    statusHint: "Weekly scan",
  },
  {
    key: "healthAwareness",
    label: "Health Awareness",
    description: "Awareness day auto-posts",
    statusHint: "Cron linked",
  },
  {
    key: "festival",
    label: "Festival Greetings",
    description: "Seasonal outreach",
    statusHint: "Calendar based",
  },
]

const DEFAULT_TOGGLES: Record<AutomationKey, boolean> = {
  birthday: false,
  followUp: false,
  appointment: true,
  vaccination: false,
  healthAwareness: true,
  festival: false,
}

function loadToggles(): Record<AutomationKey, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_TOGGLES }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TOGGLES }
    return { ...DEFAULT_TOGGLES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_TOGGLES }
  }
}

export interface CampaignAutomationPanelProps {
  onQuickAction: (action: QuickActionId) => void
  onToggleAutomation?: (key: AutomationKey, enabled: boolean) => void
  cronStatusLabel?: string | null
  reminderStatusLabel?: string | null
  canDuplicate?: boolean
}

export default function CampaignAutomationPanel({
  onQuickAction,
  onToggleAutomation,
  cronStatusLabel,
  reminderStatusLabel,
  canDuplicate = false,
}: CampaignAutomationPanelProps) {
  const [toggles, setToggles] = useState<Record<AutomationKey, boolean>>(DEFAULT_TOGGLES)

  useEffect(() => {
    setToggles(loadToggles())
  }, [])

  const setToggle = (key: AutomationKey, enabled: boolean) => {
    setToggles((prev) => {
      const next = { ...prev, [key]: enabled }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    onToggleAutomation?.(key, enabled)
  }

  const enabledCount = Object.values(toggles).filter(Boolean).length

  return (
    <section className="camp-crm-section">
      <div className="camp-crm-section-head">
        <div>
          <h3 className="camp-crm-section-title">Campaign Automation</h3>
          <p className="camp-crm-section-sub">Quick actions and scheduled outreach rules</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600">
            {enabledCount}/{AUTOMATIONS.length} active
          </span>
          {cronStatusLabel && (
            <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 font-medium text-cyan-800">
              {cronStatusLabel}
            </span>
          )}
          {reminderStatusLabel && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
              {reminderStatusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
            {QUICK_ACTIONS.map((action) => {
              const disabled = action.id === "duplicate" && !canDuplicate
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onQuickAction(action.id)}
                  className="camp-crm-card"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
                    {action.icon}
                  </span>
                  <span className="mt-1.5 text-[11px] font-semibold text-slate-800">{action.label}</span>
                  <span className="mt-0.5 text-[10px] leading-snug text-slate-500">{action.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Automation
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {AUTOMATIONS.map((item) => {
              const on = toggles[item.key]
              return (
                <div
                  key={item.key}
                  className={`camp-crm-card flex-row items-start gap-2.5 !min-h-[4.75rem] ${on ? "camp-crm-card--on" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[11px] font-semibold text-slate-800">{item.label}</p>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {on ? "On" : "Off"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{item.description}</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">{item.statusHint}</p>
                  </div>
                  <ToggleSwitch
                    checked={on}
                    onChange={(next) => setToggle(item.key, next)}
                    label={item.label}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} ${checked ? "enabled" : "disabled"}`}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-cyan-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  )
}
