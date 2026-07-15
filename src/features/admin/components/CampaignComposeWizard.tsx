"use client"

import { useEffect, useMemo, useState } from "react"
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react"
import { Button } from '@/shared/components'
import type { Campaign, CampaignAudience } from "@/utils/campaigns/campaigns"
import { sanitizeForInnerHTML } from "@/utils/shared/sanitizeHtml"

type WizardStep = 1 | 2 | 3 | 4
type CampaignType = "announcement" | "health_day" | "reminder" | "promo"
type ScheduleMode = "now" | "schedule" | "recurring"
type PreviewTab = "desktop" | "mobile" | "whatsapp" | "email"

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Content" },
  { id: 3, label: "Schedule" },
  { id: 4, label: "Preview" },
]

export interface CampaignComposeWizardProps {
  form: Campaign
  setForm: Dispatch<SetStateAction<Campaign>>
  onTitleChange: (title: string) => void
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void | Promise<void>
  onCancel: () => void
  saving?: boolean
  editingId?: string | null
  estimatedRecipients?: number | null
}

export default function CampaignComposeWizard({
  form,
  setForm,
  onTitleChange,
  onSubmit,
  onCancel,
  saving = false,
  editingId = null,
  estimatedRecipients = null,
}: CampaignComposeWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [campaignType, setCampaignType] = useState<CampaignType>("announcement")
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    form.status === "published" ? "now" : "schedule"
  )
  const [scheduleAt, setScheduleAt] = useState("")
  const [recurringNote, setRecurringNote] = useState("weekly")
  const [subject, setSubject] = useState(form.title || "")
  const [previewTab, setPreviewTab] = useState<PreviewTab>("desktop")

  useEffect(() => {
    setStep(1)
    setSubject(form.title || "")
    setScheduleMode(form.status === "published" ? "now" : "schedule")
  }, [editingId])

  useEffect(() => {
    if (!subject && form.title) setSubject(form.title)
  }, [form.title])

  useEffect(() => {
    if (scheduleMode === "now") {
      setForm((prev) => ({ ...prev, status: "published" }))
    } else {
      setForm((prev) => ({ ...prev, status: "draft" }))
    }
  }, [scheduleMode, setForm])

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(form.title.trim())
    if (step === 2) return Boolean(form.content.trim() || form.ctaText?.trim())
    if (step === 3) {
      if (scheduleMode === "schedule") return Boolean(scheduleAt)
      return true
    }
    return true
  }, [step, form.title, form.content, form.ctaText, scheduleMode, scheduleAt])

  const recipientLabel = useMemo(() => {
    if (form.audience === "patients") return "Active patients"
    if (form.audience === "doctors") return "Active doctors"
    return "Patients & doctors"
  }, [form.audience])

  const estimateDisplay =
    estimatedRecipients != null && estimatedRecipients >= 0
      ? estimatedRecipients.toLocaleString("en-IN")
      : "—"

  const goNext = () => setStep((s) => Math.min(4, (s + 1) as WizardStep) as WizardStep)
  const goBack = () => setStep((s) => Math.max(1, (s - 1) as WizardStep) as WizardStep)

  const typeLabel: Record<CampaignType, string> = {
    announcement: "Announcement",
    health_day: "Health Day",
    reminder: "Reminder",
    promo: "Promotion",
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (step < 4) {
          if (canNext) goNext()
          return
        }
        void onSubmit(e)
      }}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          {editingId ? "Edit campaign" : "Create campaign"}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">Step {step} of 4 · {STEPS[step - 1].label}</p>
        <div className="mt-3 flex gap-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id <= step || (s.id === step + 1 && canNext)) setStep(s.id)
              }}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s.id <= step ? "bg-cyan-600" : "bg-slate-200"
              }`}
              aria-label={s.label}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {STEPS.map((s) => (
            <span key={s.id} className={s.id === step ? "text-cyan-700" : ""}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {step === 1 && (
          <>
            <Field label="Title *">
              <input
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Summer Health Camp"
                required
              />
            </Field>
            <Field label="Audience">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "patients", label: "Patients" },
                    { id: "doctors", label: "Doctors" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, audience: opt.id as CampaignAudience }))}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                      form.audience === opt.id
                        ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Campaign Type">
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="announcement">Announcement</option>
                <option value="health_day">Health awareness day</option>
                <option value="reminder">Reminder</option>
                <option value="promo">Promotion</option>
              </select>
            </Field>
            <Field label="Priority">
              <input
                type="number"
                min={0}
                value={form.priority ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
              <p className="mt-1 text-[10px] text-slate-400">Higher priority appears first in carousels.</p>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Subject">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Email / notification subject"
              />
            </Field>
            <Field label="Message">
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Write the campaign message…"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3">
              <Field label="CTA text">
                <input
                  value={form.ctaText || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaText: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Book appointment"
                />
              </Field>
              <Field label="CTA link">
                <input
                  value={form.ctaHref || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaHref: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  placeholder="/patient-dashboard/book-appointment"
                />
              </Field>
            </div>
            <Field label="Image URL">
              <input
                value={form.imageUrl || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="https://…"
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Delivery">
              <div className="space-y-1.5">
                {(
                  [
                    { id: "now", title: "Send now", desc: "Publish immediately after create" },
                    { id: "schedule", title: "Schedule", desc: "Save as draft until the chosen time" },
                    { id: "recurring", title: "Recurring", desc: "Repeat on a cadence (saved as draft)" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScheduleMode(opt.id)}
                    className={`flex w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      scheduleMode === opt.id
                        ? "border-cyan-300 bg-cyan-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-800">{opt.title}</span>
                    <span className="text-[11px] text-slate-500">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </Field>
            {scheduleMode === "schedule" && (
              <Field label="Schedule date & time">
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </Field>
            )}
            {scheduleMode === "recurring" && (
              <Field label="Recurrence">
                <select
                  value={recurringNote}
                  onChange={(e) => setRecurringNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Recurring cadence is captured for planning; campaign is saved as a draft for ops review.
                </p>
              </Field>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                Estimated recipients
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                {estimateDisplay}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {recipientLabel} · {typeLabel[campaignType]}
                {scheduleMode === "now"
                  ? " · Send now"
                  : scheduleMode === "schedule"
                    ? ` · Scheduled${scheduleAt ? ` ${scheduleAt.replace("T", " ")}` : ""}`
                    : ` · Recurring (${recurringNote})`}
              </p>
              {estimatedRecipients == null && (
                <p className="mt-1 text-[10px] text-slate-500">
                  Live audience count is not connected yet — confirm audience before publishing.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  { id: "desktop", label: "Desktop" },
                  { id: "mobile", label: "Mobile" },
                  { id: "whatsapp", label: "WhatsApp" },
                  { id: "email", label: "Email" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewTab(tab.id)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    previewTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {(previewTab === "desktop" || previewTab === "mobile") && (
              <div
                className={`mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
                  previewTab === "mobile" ? "max-w-[240px]" : "w-full"
                }`}
              >
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="" className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-20 items-center justify-center bg-slate-100 text-[11px] text-slate-400">
                    No image
                  </div>
                )}
                <div className="space-y-2 p-3">
                  <p className="text-sm font-semibold text-slate-900">{form.title || "Untitled"}</p>
                  <div
                    className="line-clamp-4 text-xs text-slate-600"
                    dangerouslySetInnerHTML={sanitizeForInnerHTML(form.content || "<p>Message preview…</p>")}
                  />
                  {form.ctaText && (
                    <span className="inline-flex rounded-md bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {form.ctaText}
                    </span>
                  )}
                </div>
              </div>
            )}

            {previewTab === "whatsapp" && (
              <div className="rounded-xl border border-emerald-200 bg-[#e7f8ef] p-3">
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 shadow-sm">
                  <p className="text-[11px] font-semibold text-emerald-800">Harmony HMS</p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">{form.title || "Campaign"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                    {(form.content || "").replace(/<[^>]+>/g, " ").trim() || "Your message will appear here."}
                  </p>
                  {form.ctaText && form.ctaHref && (
                    <p className="mt-2 text-[11px] font-semibold text-sky-600">{form.ctaText}</p>
                  )}
                  <p className="mt-1 text-right text-[10px] text-slate-400">Preview</p>
                </div>
              </div>
            )}

            {previewTab === "email" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="space-y-1 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                  <p>
                    <span className="text-slate-400">From:</span>{" "}
                    <span className="font-medium text-slate-700">Harmony HMS</span>
                  </p>
                  <p>
                    <span className="text-slate-400">Subject:</span>{" "}
                    <span className="font-medium text-slate-800">{subject || form.title || "(no subject)"}</span>
                  </p>
                </div>
                <div className="space-y-2 p-3">
                  {form.imageUrl && (
                    <img src={form.imageUrl} alt="" className="h-24 w-full rounded-md object-cover" />
                  )}
                  <p className="text-sm font-semibold text-slate-900">{form.title}</p>
                  <div
                    className="text-xs text-slate-600"
                    dangerouslySetInnerHTML={sanitizeForInnerHTML(form.content || "<p></p>")}
                  />
                  {form.ctaText && (
                    <span className="inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white">
                      {form.ctaText}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3">
        {step > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={goBack}>
            Back
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <Button type="button" size="sm" disabled={!canNext} onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            loading={saving}
            loadingText="Publishing…"
            disabled={!form.title.trim()}
          >
            {scheduleMode === "now" ? (editingId ? "Save & publish" : "Publish campaign") : editingId ? "Save draft" : "Create draft"}
          </Button>
        )}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  )
}
