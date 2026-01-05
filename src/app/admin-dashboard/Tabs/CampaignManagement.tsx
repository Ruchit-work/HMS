'use client'

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/StatusComponents"
import AdminProtected from "@/components/AdminProtected"
import { Campaign, CampaignAudience, CampaignStatus, createCampaign, slugify, updateCampaign } from "@/utils/campaigns"
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore"
import { db, auth } from "@/firebase/config"
import { SuccessToast } from "@/components/ui/StatusComponents"
import { formatDateTime } from "@/utils/date"
import { sanitizeForInnerHTML } from "@/utils/sanitizeHtml"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"

export default function CampaignManagement({ disableAdminGuard = true }: { disableAdminGuard?: boolean } = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId } = useMultiHospital()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [publishingCampaignId, setPublishingCampaignId] = useState<string | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const createInitialFormState = (): Campaign => ({
    title: "",
    slug: "",
    content: "",
    imageUrl: "",
    ctaText: "",
    ctaHref: "",
    audience: "all",
    status: "draft",
    priority: 0,
  })

  const [form, setForm] = useState<Campaign>(() => createInitialFormState())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [filter, setFilter] = useState<{status: CampaignStatus|"all"}>({ status: "all" })
  const [cronStatus, setCronStatus] = useState<any>(null)
  const [loadingCronStatus, setLoadingCronStatus] = useState(false)
  const [reminderStatus, setReminderStatus] = useState<any>(null)
  const [loadingReminderStatus, setLoadingReminderStatus] = useState(false)
  const [reminderStatusError, setReminderStatusError] = useState<string | null>(null)
  const [testingReminders, setTestingReminders] = useState(false)
  const [sendWhatsAppOnManualGenerate, setSendWhatsAppOnManualGenerate] = useState(true)
  const [generatingToday, setGeneratingToday] = useState(false)
  const [generatingRandom, setGeneratingRandom] = useState(false)

  const reloadCampaigns = async (): Promise<Campaign[]> => {
    try {
      const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      const campaignsData = snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, ...data } as Campaign
      })
      setCampaigns(campaignsData)
      return campaignsData
    } catch (error) {
      try {
        const q = query(collection(db, 'campaigns'))
        const snap = await getDocs(q)
        const campaignsData = snap.docs.map(d => {
          const data = d.data()
          return { id: d.id, ...data } as Campaign
        })
        campaignsData.sort((a, b) => {
          const aUpdated = a.updatedAt instanceof Timestamp ? a.updatedAt.toMillis() : 0
          const bUpdated = b.updatedAt instanceof Timestamp ? b.updatedAt.toMillis() : 0
          return bUpdated - aUpdated
        })
        setCampaigns(campaignsData)
        return campaignsData
      } catch (fallbackError) {
        return campaigns
      }
    }
  }

  useEffect(() => {
    if (!user || authLoading) return
    reloadCampaigns()
    checkCronStatus()
    checkReminderStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  const checkCronStatus = async () => {
    try {
      setLoadingCronStatus(true)

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to check cron status")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch("/api/auto-campaigns/status", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const data = await response.json()
      if (data.success) {
        setCronStatus(data)
      }
    } catch (error) {
    } finally {
      setLoadingCronStatus(false)
    }
  }

  const checkReminderStatus = async () => {
    try {
      setLoadingReminderStatus(true)
      setReminderStatusError(null)

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to check reminder status")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch("/api/appointments/reminders-status", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const data = await response.json()
      if (data.success) {
        setReminderStatus(data)
        setSuccessMessage("✅ Reminder status updated!")
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        const errorMsg = data.error || "Failed to check reminder status"
        setReminderStatusError(errorMsg)
        setSuccessMessage(`❌ Error: ${errorMsg}`)
        setTimeout(() => setSuccessMessage(null), 5000)
      }
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to check reminder status"
      setReminderStatusError(errorMsg)
      setSuccessMessage(`❌ Error: ${errorMsg}`)
      setTimeout(() => setSuccessMessage(null), 5000)
    } finally {
      setLoadingReminderStatus(false)
    }
  }

  const testReminders = async () => {
    if (testingReminders) return
    try {
      setTestingReminders(true)
      setSuccessMessage("🔄 Testing appointment reminders...")

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to test reminders")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch("/api/appointments/send-reminders", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const data = await response.json()
      if (data.success) {
        const summary = data.summary || {}
        const remindersSent = summary.totalRemindersSent || 0
        const remindersSkipped = summary.totalRemindersSkipped || 0
        const errors = summary.totalErrors || 0
        
        if (remindersSent > 0) {
          setSuccessMessage(`✅ Success! Sent ${remindersSent} reminder(s). Skipped: ${remindersSkipped}, Errors: ${errors}`)
        } else if (remindersSkipped > 0) {
          setSuccessMessage(`ℹ️ No reminders sent. ${remindersSkipped} appointment(s) already have reminders sent.`)
        } else {
          setSuccessMessage(`ℹ️ No reminders sent. No appointments found in the 24-hour reminder window (±90 minutes).`)
        }
        
        // Refresh status after testing
        setTimeout(async () => {
          await checkReminderStatus()
        }, 1000)
      } else {
        setSuccessMessage(`❌ Error: ${data.error || "Failed to test reminders"}`)
      }
    } catch (error: any) {
      setSuccessMessage(`❌ Error: ${error?.message || "Failed to test reminders"}`)
    } finally {
      setTestingReminders(false)
    }
  }

  const filtered = useMemo(() => {
    const byStatus = filter.status === "all" ? campaigns : campaigns.filter(c => c.status === filter.status)
    if (!searchTerm.trim()) return byStatus
    const term = searchTerm.toLowerCase()
    return byStatus.filter(c =>
      c.title.toLowerCase().includes(term) ||
      c.ctaText?.toLowerCase().includes(term) ||
      c.audience.toLowerCase().includes(term)
    )
  }, [campaigns, filter, searchTerm])

  const totalPublished = useMemo(
    () => campaigns.filter(c => c.status === "published").length,
    [campaigns]
  )
  const totalDrafts = useMemo(
    () => campaigns.filter(c => c.status === "draft").length,
    [campaigns]
  )

  useEffect(() => {
    if (!filtered.length) {
      setSelectedCampaignId(null)
      return
    }
    if (!selectedCampaignId || !filtered.some(c => c.id === selectedCampaignId)) {
      setSelectedCampaignId(filtered[0].id ?? null)
    }
  }, [filtered, selectedCampaignId])

  const selectedCampaign = useMemo(
    () => (selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId) ?? null : null),
    [selectedCampaignId, campaigns]
  )

  const formatCampaignDate = (value?: Campaign["updatedAt"]) => {
    if (!value) return "—"
    if (value instanceof Timestamp) {
      return formatDateTime(value.toDate().toISOString())
    }
    if (typeof value === "string") {
      return formatDateTime(value)
    }
    return "—"
  }

  const resetForm = () => {
    setForm(createInitialFormState())
  }

  if (authLoading) {
    return <LoadingSpinner message="Loading campaigns..." />
  }

  if (!user) {
    return null
  }

  // When disableAdminGuard=true, verify user is admin or receptionist
  if (disableAdminGuard && user.role !== "admin" && user.role !== "receptionist") {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Access denied. Admin or receptionist privileges required.</p>
      </div>
    )
  }

  const handleTitleChange = (title: string) => {
    setForm(prev => ({ ...prev, title, slug: prev.slug || slugify(title) }))
  }

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!form.title || !form.slug) return
    setSaving(true)
    try {
      if (editingId) {
        // Update existing campaign
        await updateCampaign(editingId, {
          title: form.title,
          slug: slugify(form.slug),
          content: form.content,
          imageUrl: form.imageUrl || undefined,
          ctaText: form.ctaText || undefined,
          ctaHref: form.ctaHref || undefined,
          audience: form.audience,
          status: form.status,
          priority: form.priority ?? 0,
        })
        // Reload campaigns to get updated data (preserves all campaigns)
        await reloadCampaigns()
        setSelectedCampaignId(editingId)
        setSuccessMessage("Campaign updated successfully!")
      } else {
        await createCampaign({
          title: form.title,
          slug: slugify(form.slug),
          content: form.content,
          imageUrl: form.imageUrl,
          ctaText: form.ctaText,
          ctaHref: form.ctaHref,
          audience: form.audience,
          status: form.status,
          priority: form.priority ?? 0,
          hospitalId: activeHospitalId || null,
        })
        
        await new Promise(resolve => setTimeout(resolve, 500))
        await reloadCampaigns()
        
        resetForm()
        setSuccessMessage("Campaign created successfully!")
      }
      setEditingId(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (id?: string, current?: CampaignStatus) => {
    if (!id || publishingCampaignId) return
    const next: CampaignStatus = current === 'published' ? 'draft' : 'published'
    try {
      setPublishingCampaignId(id)
      setSuccessMessage(`🔄 ${next === 'published' ? 'Publishing' : 'Unpublishing'} campaign...`)
      await updateCampaign(id, { status: next })
      await reloadCampaigns()
      setSuccessMessage(`✅ Campaign ${next === 'published' ? 'published' : 'unpublished'} successfully!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      setSuccessMessage(`❌ Failed to ${next === 'published' ? 'publish' : 'unpublish'} campaign. Please try again.`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } finally {
      setPublishingCampaignId(null)
    }
  }

  const handleDelete = async (id?: string) => {
    if (!id || deletingCampaignId) return
    try {
      setDeletingCampaignId(id)
      setSuccessMessage("🔄 Deleting campaign...")
      
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to delete campaigns")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch("/api/campaigns/delete", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      })
      const data = await response.json()
      
      // Handle 404 - campaign might have already been deleted
      if (response.status === 404 || (data?.error && data.error.includes("not found"))) {
        // Campaign doesn't exist - refresh list and show success (it's already gone)
        await reloadCampaigns()
        setSelectedCampaignId(prev => (prev === id ? null : prev))
        if (editingId === id) {
          resetForm()
          setEditingId(null)
        }
        setSuccessMessage("ℹ️ Campaign was already deleted or doesn't exist.")
        setTimeout(() => setSuccessMessage(null), 3000)
        return
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data?.error || "Failed to delete campaign")
      }

      await reloadCampaigns()
      setSelectedCampaignId(prev => (prev === id ? null : prev))
      if (editingId === id) {
        resetForm()
        setEditingId(null)
      }
      setSuccessMessage("✅ Campaign deleted successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to delete campaign"
      setSuccessMessage(`❌ ${errorMsg}. Please try again.`)
      setTimeout(() => setSuccessMessage(null), 4000)
    } finally {
      setDeletingCampaignId(null)
    }
  }

  const startEditing = (campaign: Campaign) => {
    setEditingId(campaign.id ?? null)
    setForm({
      ...createInitialFormState(),
      ...campaign,
      ctaText: campaign.ctaText ?? "",
      ctaHref: campaign.ctaHref ?? "",
      imageUrl: campaign.imageUrl ?? "",
      priority: campaign.priority ?? 0,
    })
    setSelectedCampaignId(campaign.id ?? null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    resetForm()
  }

  const content = (
    <div className="space-y-8">
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 max-w-md">
          <SuccessToast
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
            className="shadow-2xl border-2 border-teal-200"
          />
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-700 text-white shadow-lg">
        <div className="relative px-6 py-10 sm:px-10">
          <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-white/20 sm:block" />
          <div className="absolute -bottom-16 -left-12 hidden h-48 w-48 rounded-full bg-teal-500/20 blur-3xl sm:block" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-200/80">
                Campaign Operations
              </p>
              <h2 className="text-3xl font-bold sm:text-4xl">
                Plan, publish, and measure every engagement in one dashboard.
              </h2>
              <p className="text-sm text-teal-100/90 sm:text-base">
                Keep patients and doctors informed with curated announcements, targeted outreach,
                and timely calls to action. Create a campaign, ship it instantly, or schedule for later.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-1 gap-4 text-slate-900">
              <div className="rounded-2xl bg-white/85 p-4 shadow-md backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Campaigns</p>
                <p className="mt-2 text-3xl font-bold">{campaigns.length}</p>
                <p className="mt-1 text-xs text-slate-500">All active and archived announcements</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/90 p-4 shadow-md backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">{totalPublished}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Currently visible to recipients</p>
                </div>
                <div className="rounded-2xl bg-white/90 p-4 shadow-md backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drafts</p>
                  <p className="mt-2 text-2xl font-bold text-amber-600">{totalDrafts}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Ready for review and publishing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Campaign Library</h3>
                <p className="text-sm text-slate-500">
                  Manage drafts, review published announcements, and triage outreach priorities.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    🔎
                  </span>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by title, CTA, or audience"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ status: e.target.value as CampaignStatus | "all" })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft only</option>
                  <option value="published">Published only</option>
                </select>
              </div>
            </div>
            {/* Cron Status Display */}
            {cronStatus && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">Cron Job Status</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={checkCronStatus}
                      disabled={loadingCronStatus}
                      className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      title="Refresh cron status"
                    >
                      {loadingCronStatus ? "Refreshing..." : "Refresh"}
                    </button>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      cronStatus.status === "healthy" 
                        ? "bg-green-100 text-green-800" 
                        : cronStatus.status === "error"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {cronStatus.status === "healthy" ? "✓ Healthy" : cronStatus.status === "error" ? "✗ Error" : "? Unknown"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600 font-medium">Schedule</p>
                    <p className="text-slate-900">
                      {cronStatus.cron.scheduleDisplay || cronStatus.cron.schedule || "Midnight IST (6:30 PM UTC)"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Cron format: {cronStatus.cron.scheduleUTC || cronStatus.cron.schedule || "30 18 * * *"} (6:30 PM UTC)
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">Next Execution</p>
                    <p className="text-slate-900">{cronStatus.cron.nextExecutionFormatted}</p>
                  </div>
                  {cronStatus.lastExecution && (
                    <>
                      <div>
                        <p className="text-slate-600 font-medium">Last Execution</p>
                        <p className="text-slate-900">
                          {new Date(cronStatus.lastExecution.executedAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZoneName: "short",
                          })}
                        </p>
                        <p className="text-xs text-slate-500">
                          Triggered by: {cronStatus.lastExecution.triggeredBy === "cron" ? "🔄 Automatic Cron" : "👤 Manual"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600 font-medium">Last Result</p>
                        <p className={`font-semibold ${
                          cronStatus.lastExecution.success ? "text-green-600" : "text-red-600"
                        }`}>
                          {cronStatus.lastExecution.success 
                            ? `✓ Success: ${cronStatus.lastExecution.campaignsGenerated} campaign(s) generated`
                            : `✗ Failed: ${cronStatus.lastExecution.error || "Unknown error"}`
                          }
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-slate-600 font-medium">Today's Health Awareness Days</p>
                    <p className="text-slate-900">
                      {cronStatus.today.healthDaysCount > 0 
                        ? cronStatus.today.healthDays.map((d: any) => d.name).join(", ")
                        : "None (no campaigns will be generated today)"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">Recent Campaigns (Last 7 Days)</p>
                    <p className="text-slate-900">{cronStatus.recentCampaigns.length} auto-generated campaign(s)</p>
                  </div>
                </div>
                {cronStatus.executionHistory && cronStatus.executionHistory.length > 0 && (
                  <div className="mt-4">
                    <p className="text-slate-600 font-medium mb-2">Execution History (Last 5)</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {cronStatus.executionHistory.slice(0, 5).map((exec: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                          <span className="text-slate-600">
                            {new Date(exec.executedAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className={`font-semibold ${
                            exec.success ? "text-green-600" : "text-red-600"
                          }`}>
                            {exec.success ? `✓ ${exec.campaignsGenerated} campaigns` : `✗ Failed`}
                          </span>
                          <span className="text-slate-400">
                            {exec.triggeredBy === "cron" ? "🔄" : "👤"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Appointment Reminders Status Display */}
            {(reminderStatus || reminderStatusError) && (
              <div className="rounded-lg border border-slate-200 bg-blue-50 p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">📅 Appointment Reminders Status</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={checkReminderStatus}
                      disabled={loadingReminderStatus}
                      className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      title="Refresh reminder status"
                    >
                      {loadingReminderStatus ? "Refreshing..." : "Refresh"}
                    </button>
                    {reminderStatus && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        reminderStatus.status === "healthy" 
                          ? "bg-green-100 text-green-800" 
                          : reminderStatus.status === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {reminderStatus.status === "healthy" ? "✓ Healthy" : reminderStatus.status === "error" ? "✗ Error" : "? Unknown"}
                      </span>
                    )}
                  </div>
                </div>
                {reminderStatusError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-sm text-red-800 font-semibold">❌ Error loading reminder status</p>
                    <p className="text-xs text-red-600 mt-1">{reminderStatusError}</p>
                  </div>
                )}
                {reminderStatus && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600 font-medium">Schedule</p>
                        <p className="text-slate-900">
                          {reminderStatus.cron.scheduleDisplay || reminderStatus.cron.schedule || "11:30 AM IST (6:00 AM UTC)"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Cron format: {reminderStatus.cron.scheduleUTC || "0 6 * * *"} (6:00 AM UTC)
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600 font-medium">Next Execution</p>
                        <p className="text-slate-900">{reminderStatus.cron.nextExecutionFormatted}</p>
                      </div>
                      {reminderStatus.lastExecution && (
                        <>
                          <div>
                            <p className="text-slate-600 font-medium">Last Reminder Sent</p>
                            <p className="text-slate-900">
                              {new Date(reminderStatus.lastExecution.sentAt).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZoneName: "short",
                              })}
                            </p>
                            <p className="text-xs text-slate-500">
                              Patient: {reminderStatus.lastExecution.patientName || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600 font-medium">Last Status</p>
                            <p className={`font-semibold ${
                              reminderStatus.lastExecution.status === "sent" ? "text-green-600" : "text-red-600"
                            }`}>
                              {reminderStatus.lastExecution.status === "sent" 
                                ? "✓ Sent Successfully"
                                : `✗ Failed: ${reminderStatus.lastExecution.error || "Unknown error"}`
                              }
                            </p>
                          </div>
                        </>
                      )}
                      <div>
                        <p className="text-slate-600 font-medium">Statistics</p>
                        <p className="text-slate-900">
                          {reminderStatus.statistics.upcomingAppointments} upcoming appointment(s)
                        </p>
                        <p className="text-xs text-slate-500">
                          {reminderStatus.statistics.appointmentsInWindow} in reminder window (±90m)
                        </p>
                      </div>
                  <div>
                    <p className="text-slate-600 font-medium">Recent Activity (Last 7 Days)</p>
                    <p className="text-slate-900">
                      {reminderStatus.statistics.remindersSentLast7Days} sent, {reminderStatus.statistics.remindersFailedLast7Days} failed
                    </p>
                  </div>
                  </div>
                    {reminderStatus.recentReminders && reminderStatus.recentReminders.length > 0 && (
                      <div className="mt-4">
                        <p className="text-slate-600 font-medium mb-2">Recent Reminders (Last 5)</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {reminderStatus.recentReminders.slice(0, 5).map((reminder: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                              <span className="text-slate-600">
                                {new Date(reminder.sentAt).toLocaleString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-slate-600">
                                {reminder.patientName} → {reminder.doctorName}
                              </span>
                              <span className={`font-semibold ${
                                reminder.status === "sent" ? "text-green-600" : "text-red-600"
                              }`}>
                                {reminder.status === "sent" ? "✓ Sent" : "✗ Failed"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Generate Campaigns Buttons - Always Visible */}
            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={checkCronStatus}
                disabled={loadingCronStatus || generatingToday || generatingRandom}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  loadingCronStatus
                    ? "border-blue-400 bg-blue-200 text-blue-500 cursor-not-allowed"
                    : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95 disabled:opacity-60"
                }`}
                title="Check cron job status and execution history"
              >
                {loadingCronStatus ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking...
                  </span>
                ) : (
                  "🔄 Check Campaign Cron Status"
                )}
              </button>
              <button
                type="button"
                onClick={checkReminderStatus}
                disabled={loadingReminderStatus || generatingToday || generatingRandom}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  loadingReminderStatus
                    ? "border-purple-400 bg-purple-200 text-purple-500 cursor-not-allowed"
                    : "border-purple-600 bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md active:scale-95 disabled:opacity-60"
                }`}
                title="Check appointment reminder cron job status"
              >
                {loadingReminderStatus ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Checking...
                  </span>
                ) : (
                  "📅 Check Reminder Status"
                )}
              </button>
              <button
                type="button"
                onClick={testReminders}
                disabled={testingReminders || loadingReminderStatus || generatingToday || generatingRandom}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  testingReminders
                    ? "border-orange-400 bg-orange-200 text-orange-500 cursor-not-allowed"
                    : "border-orange-600 bg-orange-600 text-white hover:bg-orange-700 hover:shadow-md active:scale-95 disabled:opacity-60"
                }`}
                title="Manually trigger appointment reminder check (for testing)"
              >
                {testingReminders ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing...
                  </span>
                ) : (
                  "🧪 Test Reminders Now"
                )}
              </button>
              <div className="flex flex-col gap-1">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendWhatsAppOnManualGenerate}
                        onChange={(e) => setSendWhatsAppOnManualGenerate(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Send WhatsApp notifications to patients
                      </span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (generatingToday) return // Prevent double-click
                      try {
                        setGeneratingToday(true)
                        setSuccessMessage(null)
                        
                        // Get Firebase Auth token
                        const currentUser = auth.currentUser
                        if (!currentUser) {
                          throw new Error("You must be logged in to generate campaigns")
                        }

                        const token = await currentUser.getIdToken()

                        setSuccessMessage("🔍 Checking today's health awareness days...")
                        // First check what health awareness days are for today
                        const checkResponse = await fetch("/api/auto-campaigns/test?date=today", {
                          headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                        })
                        const checkData = await checkResponse.json()
                        
                        if (checkData.healthDaysFound === 0) {
                          setSuccessMessage(`ℹ️ No health awareness days found for today (${checkData.dateFormatted}). Check healthAwarenessDays.ts for available dates.`)
                          return
                        }
                        
                        setSuccessMessage(`✅ Found ${checkData.healthDaysFound} health awareness day(s): ${checkData.healthDays.map((d: any) => d.name).join(", ")}. Generating campaigns...`)
                        
                        const sendWhatsApp = sendWhatsAppOnManualGenerate ? "true" : "false"
                        const response = await fetch(`/api/auto-campaigns/generate?check=today&publish=true&sendWhatsApp=${sendWhatsApp}`, {
                          headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                        })
                        const data = await response.json()
                        if (data.success) {
                          if (data.campaignsGenerated === 0) {
                            setSuccessMessage(`ℹ️ No new campaigns generated. ${data.message || "Campaigns may already exist for today."}`)
                          } else {
                            const whatsAppMsg = sendWhatsAppOnManualGenerate 
                              ? `✅ Generated ${data.campaignsGenerated} campaign(s) and sent WhatsApp notifications to all active patients!` 
                              : `✅ Generated ${data.campaignsGenerated} campaign(s) for today!`
                            setSuccessMessage(whatsAppMsg)
                            setTimeout(async () => {
                              await reloadCampaigns()
                              await checkCronStatus()
                              setSuccessMessage("🔄 Campaigns refreshed!")
                            }, 1000)
                          }
                        } else {
                          setSuccessMessage(`❌ Error: ${data.error || "Failed to generate campaigns"}`)
                        }
                      } catch (error: any) {
                        setSuccessMessage(`❌ Error: ${error?.message || "Failed to generate campaigns"}`)
                      } finally {
                        setGeneratingToday(false)
                      }
                    }}
                    disabled={generatingToday || generatingRandom}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                      generatingToday
                        ? "border-slate-400 bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "border-teal-600 bg-teal-600 text-white hover:bg-teal-700 hover:shadow-md active:scale-95"
                    }`}
                    title="Manually generate campaigns for today (useful for testing/local development). In production, campaigns are generated automatically via cron job at midnight IST (6:30 PM UTC) with WhatsApp notifications enabled."
                  >
                    {generatingToday ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      "🚀 Generate Auto Campaigns (Today)"
                    )}
                  </button>
              <button
                type="button"
                onClick={async () => {
                  if (generatingRandom) return // Prevent double-click
                  try {
                    setGeneratingRandom(true)
                    setSuccessMessage(null)
                    
                    // Get Firebase Auth token
                    const currentUser = auth.currentUser
                    if (!currentUser) {
                      throw new Error("You must be logged in to generate campaigns")
                    }

                    const token = await currentUser.getIdToken()

                    setSuccessMessage("🎲 Generating random awareness day campaign...")

                    const sendWhatsApp = sendWhatsAppOnManualGenerate ? "true" : "false"
                    const response = await fetch(
                      `/api/auto-campaigns/generate?check=today&publish=true&sendWhatsApp=${sendWhatsApp}&random=true`,
                      {
                        headers: {
                          "Authorization": `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                      }
                    )
                    const data = await response.json()
                    if (data.success) {
                      if (data.campaignsGenerated === 0) {
                        setSuccessMessage(`ℹ️ No new campaigns generated. ${data.message || "Campaigns may already exist for today."}`)
                      } else {
                        const whatsAppMsg = sendWhatsAppOnManualGenerate
                          ? "✅ Generated random campaign and sent WhatsApp messages with the booking link!"
                          : "✅ Generated random campaign successfully!"
                        setSuccessMessage(whatsAppMsg)
                        setTimeout(async () => {
                          await reloadCampaigns()
                          await checkCronStatus()
                          setSuccessMessage("🔄 Campaigns refreshed!")
                        }, 1000)
                      }
                    } else {
                      setSuccessMessage(`❌ Error: ${data.error || "Failed to generate random campaign"}`)
                    }
                  } catch (error: any) {
                    setSuccessMessage(`❌ Error: ${error?.message || "Failed to generate random campaign"}`)
                  } finally {
                    setGeneratingRandom(false)
                  }
                }}
                disabled={generatingToday || generatingRandom}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  generatingRandom
                    ? "border-purple-400 bg-purple-200 text-purple-500 cursor-not-allowed"
                    : "border-purple-600 bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md active:scale-95"
                }`}
                title="Generate a random awareness day campaign for quick WhatsApp testing."
              >
                {generatingRandom ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  "🎲 Generate Random Campaign (Test)"
                )}
              </button>
                  <p className="text-xs text-slate-500 italic">
                Note: In production, campaigns are automatically generated daily at midnight IST (6:30 PM UTC) via cron job with WhatsApp notifications enabled. These manual buttons are for testing/local development. Enable the checkbox above to send WhatsApp messages to patients.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filtered.map((campaign) => {
              const isActive = selectedCampaignId === campaign.id
              return (
                <article
                  key={campaign.id}
                  onClick={() => setSelectedCampaignId(campaign.id ?? null)}
                  className={`group flex cursor-pointer flex-col gap-4 rounded-xl border p-4 transition-all sm:flex-row sm:items-start sm:justify-between ${
                    isActive
                      ? "border-teal-500 bg-teal-50/60 shadow-md"
                      : "border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <span className="rounded-full border border-teal-200 bg-white px-2 py-0.5 text-teal-700">
                        {campaign.audience}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          campaign.status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {campaign.status}
                      </span>
                      {typeof campaign.priority === "number" && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">
                          Priority {campaign.priority}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">{campaign.title}</h4>
                      <p
                        className="mt-2 line-clamp-2 text-sm text-slate-600"
                        dangerouslySetInnerHTML={sanitizeForInnerHTML(campaign.content)}
                      />
                      {campaign.ctaText && campaign.ctaHref && (
                        <p className="mt-2 text-xs font-medium text-teal-600">
                          CTA: {campaign.ctaText} → {campaign.ctaHref}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 self-end sm:self-start">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePublishToggle(campaign.id, campaign.status)
                      }}
                      disabled={publishingCampaignId !== null || deletingCampaignId !== null}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
                        publishingCampaignId === campaign.id
                          ? "border-teal-400 bg-teal-200 text-teal-500 cursor-not-allowed"
                          : "border-teal-600 bg-teal-600 text-white hover:bg-teal-700 hover:shadow-md active:scale-95 disabled:opacity-60"
                      }`}
                    >
                      {publishingCampaignId === campaign.id ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {campaign.status === "published" ? "Unpublishing..." : "Publishing..."}
                        </span>
                      ) : (
                        campaign.status === "published" ? "Unpublish" : "Publish"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditing(campaign)
                      }}
                      disabled={publishingCampaignId !== null || deletingCampaignId !== null || editingId === campaign.id}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
                        editingId === campaign.id
                          ? "border-blue-400 bg-blue-100 text-blue-600 cursor-not-allowed"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:shadow-md active:scale-95 disabled:opacity-60"
                      }`}
                    >
                      {editingId === campaign.id ? "Editing..." : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(campaign.id)
                      }}
                      disabled={publishingCampaignId !== null || deletingCampaignId !== null}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
                        deletingCampaignId === campaign.id
                          ? "border-rose-400 bg-rose-200 text-rose-500 cursor-not-allowed"
                          : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:shadow-md active:scale-95 disabled:opacity-60"
                      }`}
                    >
                      {deletingCampaignId === campaign.id ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deleting...
                        </span>
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </article>
              )
            })}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center text-slate-500">
                <span className="text-4xl">📭</span>
                <p className="mt-3 text-sm font-medium">
                  No campaigns match your filters. Adjust the search or create a new message.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingId ? "Edit Campaign" : "Create Campaign"}
              </h3>
              <p className="text-sm text-slate-500">
                {editingId ? "Update the content and republish when ready." : "Craft a targeted announcement and publish it instantly."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Title *</label>
              <input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="Summer Health Camp"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Slug *</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="summer-health-camp"
                required
              />
              <p className="text-xs text-slate-400">We’ll automatically format this for URL use.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Audience</label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value as CampaignAudience }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">All recipients</option>
                  <option value="patients">Patients only</option>
                  <option value="doctors">Doctors only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as CampaignStatus }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Publish immediately</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Hero Image URL</label>
              <input
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">CTA Text</label>
                <input
                  value={form.ctaText}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaText: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="Learn more"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">CTA Link</label>
                <input
                  value={form.ctaHref}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaHref: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="/patient-dashboard/services"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                className="min-h-[160px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="Describe the campaign, include key benefits and timing."
              />
              <p className="text-xs text-slate-400">
                Supports short HTML snippets. Keep imagery and links concise.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Priority</label>
              <input
                type="number"
                value={form.priority ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                min={0}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || !form.title}
                className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-teal-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Create campaign"}
              </button>
              <button
                type="button"
                onClick={editingId ? cancelEditing : resetForm}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {editingId ? "Cancel" : "Reset"}
              </button>
            </div>
          </form>
        </aside>
      </div>

      {selectedCampaign && (
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-slate-700">
                {selectedCampaign.audience}
              </span>
              <span
                className={`rounded-full px-3 py-0.5 ${
                  selectedCampaign.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {selectedCampaign.status}
              </span>
              {typeof selectedCampaign.priority === "number" && (
                <span className="rounded-full bg-slate-200 px-3 py-0.5 text-slate-600">
                  Priority {selectedCampaign.priority}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-slate-900">{selectedCampaign.title}</h3>
            <div
              className="prose prose-sm max-w-none text-slate-700"
              dangerouslySetInnerHTML={sanitizeForInnerHTML(selectedCampaign.content)}
            />
            {selectedCampaign.ctaText && selectedCampaign.ctaHref && (
              <a className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
                href={selectedCampaign.ctaHref} target="_blank" rel="noopener noreferrer"  >
                {selectedCampaign.ctaText}
                <span>↗</span>
              </a>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-700">Quick details</h4>
              <dl className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Audience</dt>
                  <dd className="text-slate-800">{selectedCampaign.audience}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd className="text-slate-800">{selectedCampaign.status}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Priority</dt>
                  <dd className="text-slate-800">{selectedCampaign.priority ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-slate-500">Last updated</dt>
                  <dd className="text-slate-800">{formatCampaignDate(selectedCampaign.updatedAt)}</dd>
                </div>
              </dl>
            </div>
            {selectedCampaign.imageUrl && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <img src={selectedCampaign.imageUrl}    alt={selectedCampaign.title}
                  className="h-48 w-full object-cover"  loading="lazy" />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )

  if (disableAdminGuard) {
    return content
  }

  return (
    <AdminProtected>
      {content}
    </AdminProtected>
  )
}

