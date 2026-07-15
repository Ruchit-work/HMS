'use client'

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useDebounce } from "@/hooks/useDebounce"
import { SuccessToast } from '@/shared/components'
import { TabSkeleton } from '@/shared/components'
import AdminProtected from "@/features/auth/AdminProtected"
import { Campaign, CampaignAudience, CampaignStatus, createCampaign, slugify, updateCampaign } from "@/utils/campaigns/campaigns"
import { collection, getDocs, orderBy, query, where, Timestamp } from "firebase/firestore"
import { db, auth } from "@/firebase/config"
import { formatDateTime } from "@/utils/shared/date"
import { sanitizeForInnerHTML } from "@/utils/shared/sanitizeHtml"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { Button } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { useTablePagination } from "@/hooks/useTablePagination"
import {
  EnterpriseDataTable,
  StatusPill,
  type EnterpriseColumn,
  type EnterpriseRowAction,
  type EnterpriseBulkAction,
  type StatusVariant,
} from '@/shared/components'
import CampaignComposeWizard from "@/features/admin/components/CampaignComposeWizard"
import CampaignAnalyticsSection from "@/features/admin/components/CampaignAnalyticsSection"
import CampaignAutomationPanel from "@/features/admin/components/CampaignAutomationPanel"

type CampaignRow = Campaign & { id: string }

export default function CampaignManagement({
  disableAdminGuard = true,
  selectedBranchId = "all",
  branches = [],
}: {
  disableAdminGuard?: boolean
  selectedBranchId?: string
  branches?: Array<{ id: string; name: string }>
} = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId } = useMultiHospital()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [publishingCampaignId, setPublishingCampaignId] = useState<string | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<"details" | "compose">("details")
  const [refreshing, setRefreshing] = useState(false)
  const [localBranchId, setLocalBranchId] = useState(selectedBranchId)
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
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ status: CampaignStatus | "all" }>({ status: "all" })
  const [audienceFilter, setAudienceFilter] = useState<CampaignAudience | "all">("all")
  const [sortField, setSortField] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingBulk, setProcessingBulk] = useState(false)
  const [cronStatus, setCronStatus] = useState<any>(null)
  const [loadingCronStatus, setLoadingCronStatus] = useState(false)
  const [reminderStatus, setReminderStatus] = useState<any>(null)
  const [loadingReminderStatus, setLoadingReminderStatus] = useState(false)
  const [reminderStatusError, setReminderStatusError] = useState<string | null>(null)
  const [testingReminders, setTestingReminders] = useState(false)
  const [sendWhatsAppOnManualGenerate, setSendWhatsAppOnManualGenerate] = useState(true)
  const [generatingToday, setGeneratingToday] = useState(false)
  const [generatingRandom, setGeneratingRandom] = useState(false)
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)

  const reloadCampaigns = async (): Promise<Campaign[]> => {
    try {
      if (!activeHospitalId) {
        setCampaigns([])
        return []
      }
      let campaignsData: Campaign[] = []
      try {
        const q = query(
          collection(db, 'campaigns'),
          where('hospitalId', '==', activeHospitalId),
          orderBy('updatedAt', 'desc')
        )
        const snap = await getDocs(q)
        campaignsData = snap.docs.map(d => {
          const data = d.data()
          return { id: d.id, ...data } as Campaign
        })
      } catch {
        const q = query(collection(db, 'campaigns'), where('hospitalId', '==', activeHospitalId))
        const snap = await getDocs(q)
        campaignsData = snap.docs.map(d => {
          const data = d.data()
          return { id: d.id, ...data } as Campaign
        })
        campaignsData.sort((a, b) => {
          const aUpdated = a.updatedAt instanceof Timestamp ? a.updatedAt.toMillis() : 0
          const bUpdated = b.updatedAt instanceof Timestamp ? b.updatedAt.toMillis() : 0
          return bUpdated - aUpdated
        })
      }
      setCampaigns(campaignsData)
      return campaignsData
    } catch {
      return campaigns
    } finally {
      setLoadingCampaigns(false)
    }
  }

  useEffect(() => {
    setLocalBranchId(selectedBranchId)
  }, [selectedBranchId])

  useEffect(() => {
    if (!user || authLoading) return
    reloadCampaigns()
    checkCronStatus()
    checkReminderStatus()
     
  }, [user, authLoading, activeHospitalId])

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
    } catch {
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
    let rows = filter.status === "all" ? campaigns : campaigns.filter((c) => c.status === filter.status)
    if (audienceFilter !== "all") {
      rows = rows.filter((c) => c.audience === audienceFilter)
    }
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase()
      rows = rows.filter(
        (c) =>
          c.title.toLowerCase().includes(term) ||
          c.ctaText?.toLowerCase().includes(term) ||
          c.audience.toLowerCase().includes(term) ||
          c.slug?.toLowerCase().includes(term)
      )
    }

    const withIds = rows.filter((c): c is CampaignRow => Boolean(c.id))

    if (!sortField) return withIds

    const dir = sortOrder === "asc" ? 1 : -1
    return [...withIds].sort((a, b) => {
      const ts = (value?: Timestamp | string | null) => {
        if (!value) return 0
        if (value instanceof Timestamp) return value.toMillis()
        if (typeof value === "string") return new Date(value).getTime() || 0
        return 0
      }
      switch (sortField) {
        case "title":
          return a.title.localeCompare(b.title) * dir
        case "audience":
          return a.audience.localeCompare(b.audience) * dir
        case "status":
          return a.status.localeCompare(b.status) * dir
        case "scheduled":
          return (ts(a.startAt) - ts(b.startAt) || ts(a.createdAt) - ts(b.createdAt)) * dir
        case "createdBy":
          return (a.createdBy || "").localeCompare(b.createdBy || "") * dir
        default:
          return 0
      }
    })
  }, [campaigns, filter, debouncedSearchTerm, audienceFilter, sortField, sortOrder])

  const {
    currentPage,
    pageSize,
    totalPages,
    paginatedItems: paginatedCampaigns,
    goToPage,
    setPageSize,
  } = useTablePagination(filtered, { initialPageSize: 10 })

  const totalPublished = useMemo(
    () => campaigns.filter((c) => c.status === "published").length,
    [campaigns]
  )
  const totalDrafts = useMemo(
    () => campaigns.filter(c => c.status === "draft").length,
    [campaigns]
  )

  const kpiMetrics = useMemo(() => {
    const nowMs = Date.now()
    const tsMs = (value?: Campaign["startAt"] | Campaign["endAt"]) => {
      if (!value) return null
      if (value instanceof Timestamp) return value.toMillis()
      return null
    }
    let scheduled = 0
    let active = 0
    let completed = 0
    for (const c of campaigns) {
      const start = tsMs(c.startAt)
      const end = tsMs(c.endAt)
      if (start != null && start > nowMs) scheduled += 1
      if (c.status === "published" && (end == null || end >= nowMs) && (start == null || start <= nowMs)) {
        active += 1
      }
      if (end != null && end < nowMs) completed += 1
    }
    const failed =
      cronStatus?.executionHistory?.filter((e: { success?: boolean }) => e && e.success === false)?.length ||
      (cronStatus?.lastExecution && cronStatus.lastExecution.success === false ? 1 : 0)
    const pct = (n: number) => (campaigns.length ? Math.round((n / campaigns.length) * 100) : 0)
    return {
      total: campaigns.length,
      scheduled,
      active,
      completed,
      failed: Number(failed) || 0,
      drafts: totalDrafts,
      trends: {
        total: pct(campaigns.length),
        scheduled: pct(scheduled),
        active: pct(active),
        completed: pct(completed),
        failed: pct(Number(failed) || 0),
        drafts: pct(totalDrafts),
      },
    }
  }, [campaigns, cronStatus, totalDrafts])

  const branchLabel = useMemo(() => {
    if (localBranchId === "all") return "All branches"
    return branches.find((b) => b.id === localBranchId)?.name || "All branches"
  }, [branches, localBranchId])

  const exportCampaignsCsv = () => {
    const rows = [
      ["Title", "Status", "Audience", "Priority", "CTA", "Slug", "Updated"],
      ...filtered.map((c) => [
        c.title,
        c.status,
        c.audience,
        String(c.priority ?? 0),
        c.ctaText || "",
        c.slug,
        formatCampaignDate(c.updatedAt),
      ]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "")
            return `"${value.replace(/"/g, '""')}"`
          })
          .join(",")
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRefreshAll = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await reloadCampaigns()
      await checkCronStatus()
      await checkReminderStatus()
      setSuccessMessage("Dashboard refreshed")
      setTimeout(() => setSuccessMessage(null), 2500)
    } finally {
      setRefreshing(false)
    }
  }

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
    return <TabSkeleton variant="table" />
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
        setPanelMode("details")
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
        setPanelMode("details")
        setSuccessMessage("Campaign created successfully!")
      }
      setEditingId(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
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
    } catch {
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
        body: JSON.stringify({ id, hospitalId: activeHospitalId || null }),
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
    setPanelMode("compose")
  }

  const cancelEditing = () => {
    setEditingId(null)
    resetForm()
    setPanelMode(selectedCampaignId ? "details" : "compose")
  }

  const openCompose = () => {
    setEditingId(null)
    resetForm()
    setPanelMode("compose")
  }

  const duplicateSelectedCampaign = () => {
    if (!selectedCampaign) {
      setSuccessMessage("Select a campaign in the library to duplicate.")
      setTimeout(() => setSuccessMessage(null), 3000)
      return
    }
    setEditingId(null)
    setForm({
      ...createInitialFormState(),
      title: `${selectedCampaign.title} (Copy)`,
      slug: slugify(`${selectedCampaign.slug || selectedCampaign.title}-copy`),
      content: selectedCampaign.content || "",
      imageUrl: selectedCampaign.imageUrl || "",
      ctaText: selectedCampaign.ctaText || "",
      ctaHref: selectedCampaign.ctaHref || "",
      audience: selectedCampaign.audience,
      status: "draft",
      priority: selectedCampaign.priority ?? 0,
    })
    setPanelMode("compose")
    setSuccessMessage("Duplicated into compose as a new draft.")
    setTimeout(() => setSuccessMessage(null), 2500)
  }

  const scheduleNewCampaign = () => {
    setEditingId(null)
    resetForm()
    setForm((prev) => ({ ...prev, status: "draft" }))
    setPanelMode("compose")
    setSuccessMessage("Compose opened — use Scheduling to send later or set recurrence.")
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleAutomationQuickAction = (action: "new" | "duplicate" | "import" | "export" | "schedule") => {
    if (action === "new") {
      openCompose()
      return
    }
    if (action === "duplicate") {
      duplicateSelectedCampaign()
      return
    }
    if (action === "export") {
      exportCampaignsCsv()
      setSuccessMessage("Campaign report exported.")
      setTimeout(() => setSuccessMessage(null), 2500)
      return
    }
    if (action === "schedule") {
      scheduleNewCampaign()
      return
    }
    setSuccessMessage("Audience import is ready for CSV upload when the import endpoint is connected.")
    setTimeout(() => setSuccessMessage(null), 3500)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPage = () => {
    const pageIds = paginatedCampaigns.map((c) => c.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const formatTs = (value?: Timestamp | string | null) => {
    if (!value) return "—"
    if (value instanceof Timestamp) return formatDateTime(value.toDate().toISOString())
    if (typeof value === "string") return formatDateTime(value)
    return "—"
  }

  const campaignTypeLabel = (c: Campaign) => {
    if (c.hospitalId) return "Hospital"
    return "Broadcast"
  }

  const statusVariant = (status: CampaignStatus): StatusVariant =>
    status === "published" ? "success" : "warning"

  const campaignColumns: EnterpriseColumn<CampaignRow>[] = [
    {
      key: "title",
      header: "Campaign Name",
      width: "w-[18%]",
      sortable: true,
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{c.title}</p>
          <p className="truncate text-[11px] text-slate-400">{c.slug}</p>
        </div>
      ),
    },
    {
      key: "audience",
      header: "Audience",
      hideBelow: "sm",
      sortable: true,
      render: (c) => (
        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-700">
          {c.audience}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      hideBelow: "md",
      render: (c) => (
        <span className="text-xs font-medium text-slate-600">{campaignTypeLabel(c)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (c) => (
        <StatusPill
          label={c.status === "published" ? "Active" : "Draft"}
          variant={statusVariant(c.status)}
        />
      ),
    },
    {
      key: "scheduled",
      header: "Scheduled Date",
      hideBelow: "md",
      sortable: true,
      render: (c) => (
        <span className="text-xs text-slate-600">{formatTs(c.startAt || c.createdAt)}</span>
      ),
    },
    {
      key: "delivered",
      header: "Delivered",
      hideBelow: "lg",
      align: "right",
      render: () => <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: "openRate",
      header: "Open Rate",
      hideBelow: "lg",
      align: "right",
      render: () => <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: "clickRate",
      header: "Click Rate",
      hideBelow: "lg",
      align: "right",
      render: () => <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: "createdBy",
      header: "Created By",
      hideBelow: "lg",
      sortable: true,
      render: (c) => (
        <span className="text-xs text-slate-600">{c.createdBy || "System"}</span>
      ),
    },
  ]

  const campaignRowActions: EnterpriseRowAction<CampaignRow>[] = [
    {
      label: "View",
      onClick: (c) => {
        setSelectedCampaignId(c.id)
        setPanelMode("details")
      },
    },
    {
      label: "Edit",
      onClick: (c) => startEditing(c),
    },
    {
      label: "Publish",
      variant: "success",
      hidden: (c) => c.status === "published",
      onClick: (c) => handlePublishToggle(c.id, c.status),
    },
    {
      label: "Unpublish",
      variant: "warning",
      hidden: (c) => c.status !== "published",
      onClick: (c) => handlePublishToggle(c.id, c.status),
    },
    {
      label: "Delete",
      variant: "danger",
      onClick: (c) => handleDelete(c.id),
    },
  ]

  const campaignBulkActions: EnterpriseBulkAction<CampaignRow>[] = [
    {
      label: "Publish selected",
      variant: "success",
      disabled: processingBulk || publishingCampaignId !== null,
      onClick: async (rows) => {
        setProcessingBulk(true)
        try {
          for (const row of rows) {
            if (row.status !== "published") await updateCampaign(row.id, { status: "published" })
          }
          await reloadCampaigns()
          setSelectedIds(new Set())
          setSuccessMessage("Selected campaigns published")
          setTimeout(() => setSuccessMessage(null), 3000)
        } finally {
          setProcessingBulk(false)
        }
      },
    },
    {
      label: "Move to draft",
      disabled: processingBulk || publishingCampaignId !== null,
      onClick: async (rows) => {
        setProcessingBulk(true)
        try {
          for (const row of rows) {
            if (row.status !== "draft") await updateCampaign(row.id, { status: "draft" })
          }
          await reloadCampaigns()
          setSelectedIds(new Set())
          setSuccessMessage("Selected campaigns moved to draft")
          setTimeout(() => setSuccessMessage(null), 3000)
        } finally {
          setProcessingBulk(false)
        }
      },
    },
    {
      label: "Delete selected",
      variant: "danger",
      disabled: processingBulk || deletingCampaignId !== null,
      onClick: async (rows) => {
        setProcessingBulk(true)
        try {
          for (const row of rows) {
            await handleDelete(row.id)
          }
          setSelectedIds(new Set())
        } finally {
          setProcessingBulk(false)
        }
      },
    },
  ]

  const content = (
    <div className="camp-crm">
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2">
          <SuccessToast
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
            className="border border-slate-200 shadow-lg"
          />
        </div>
      )}

      {loadingCampaigns ? (
        <CampaignCrmSkeleton />
      ) : (
        <>
      {/* Compact toolbar — no second hero */}
      <div className="camp-crm-toolbar">
        <div className="camp-crm-toolbar-meta">
          <div>
            <p className="camp-crm-eyebrow">Marketing workspace</p>
            <p className="camp-crm-title">
              {campaigns.length} campaigns · {branchLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {branches.length > 0 && (
            <select
              value={localBranchId}
              onChange={(e) => setLocalBranchId(e.target.value)}
              className="camp-crm-input min-w-[8.5rem]"
              title="Branch scope (display)"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <div className="relative min-w-[10rem] flex-1 sm:flex-none sm:w-48">
            <svg
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search…"
              className="camp-crm-input w-full pl-7"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            loading={refreshing}
            loadingText="…"
          >
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCampaignsCsv}>
            Export
          </Button>
          <Button type="button" size="sm" onClick={openCompose}>
            Create
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="camp-crm-kpi-grid">
        {[
          {
            key: "total",
            label: "Total",
            value: kpiMetrics.total,
            trend: `${kpiMetrics.trends.total}%`,
            tone: "bg-slate-50 text-slate-600 border-slate-200",
          },
          {
            key: "scheduled",
            label: "Scheduled",
            value: kpiMetrics.scheduled,
            trend: `${kpiMetrics.trends.scheduled}%`,
            tone: "bg-sky-50 text-sky-700 border-sky-200",
          },
          {
            key: "active",
            label: "Active",
            value: kpiMetrics.active,
            trend: `${kpiMetrics.trends.active}%`,
            tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
          },
          {
            key: "completed",
            label: "Completed",
            value: kpiMetrics.completed,
            trend: `${kpiMetrics.trends.completed}%`,
            tone: "bg-indigo-50 text-indigo-700 border-indigo-200",
          },
          {
            key: "failed",
            label: "Failed",
            value: kpiMetrics.failed,
            trend: `${kpiMetrics.trends.failed}%`,
            tone: "bg-rose-50 text-rose-700 border-rose-200",
          },
          {
            key: "drafts",
            label: "Drafts",
            value: kpiMetrics.drafts,
            trend: `${kpiMetrics.trends.drafts}%`,
            tone: "bg-amber-50 text-amber-700 border-amber-200",
          },
        ].map((kpi) => (
          <div key={kpi.key} className="camp-crm-kpi">
            <div className="flex items-center justify-between gap-2">
              <p className="camp-crm-kpi-label">{kpi.label}</p>
              <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold ${kpi.tone}`}>
                {kpi.trend}
              </span>
            </div>
            <p className="camp-crm-kpi-value">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Balanced workspace */}
      <div className="camp-crm-workspace">
        <section className="camp-crm-panel">
          <EnterpriseDataTable
            data={paginatedCampaigns}
            columns={campaignColumns}
            loading={false}
            loadingVariant="skeleton"
            emptyTitle={searchTerm || filter.status !== "all" || audienceFilter !== "all" ? "No matching campaigns" : "Your campaign library is empty"}
            emptyDescription={
              searchTerm || filter.status !== "all" || audienceFilter !== "all"
                ? "Adjust filters or clear search to see more results."
                : "Launch your first campaign to engage patients and doctors."
            }
            emptyAction={
              searchTerm || filter.status !== "all" || audienceFilter !== "all"
                ? {
                    label: "Clear filters",
                    onClick: () => {
                      setSearchTerm("")
                      setFilter({ status: "all" })
                      setAudienceFilter("all")
                    },
                  }
                : { label: "Create campaign", onClick: openCompose }
            }
            toolbar={
              <div className="space-y-2 border-b border-slate-100 bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="camp-crm-section-title">Campaign Library</h3>
                    <p className="camp-crm-section-sub">
                      {filtered.length} shown
                      {totalPublished > 0 ? ` · ${totalPublished} published` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <FilterChip
                    active={filter.status === "all"}
                    count={campaigns.length}
                    onClick={() => setFilter({ status: "all" })}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    active={filter.status === "published"}
                    count={campaigns.filter((c) => c.status === "published").length}
                    onClick={() => setFilter({ status: "published" })}
                  >
                    Active
                  </FilterChip>
                  <FilterChip
                    active={filter.status === "draft"}
                    count={campaigns.filter((c) => c.status === "draft").length}
                    onClick={() => setFilter({ status: "draft" })}
                  >
                    Drafts
                  </FilterChip>
                  <span className="mx-0.5 h-3.5 w-px bg-slate-200" />
                  <FilterChip
                    active={audienceFilter === "all"}
                    onClick={() => setAudienceFilter("all")}
                  >
                    All audiences
                  </FilterChip>
                  <FilterChip
                    active={audienceFilter === "patients"}
                    onClick={() => setAudienceFilter("patients")}
                  >
                    Patients
                  </FilterChip>
                  <FilterChip
                    active={audienceFilter === "doctors"}
                    onClick={() => setAudienceFilter("doctors")}
                  >
                    Doctors
                  </FilterChip>
                </div>
              </div>
            }
            enableSearch={false}
            enableFilters={false}
            selectable
            selectedIds={selectedIds}
            onToggleRow={toggleSelect}
            onToggleAll={toggleSelectAllPage}
            onClearSelection={() => setSelectedIds(new Set())}
            bulkActions={campaignBulkActions}
            processingBulk={processingBulk}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(c) => {
              setSelectedCampaignId(c.id)
              if (!editingId) setPanelMode("details")
            }}
            getRowClassName={(c) =>
              selectedCampaignId === c.id ? "bg-cyan-50/60" : undefined
            }
            primaryAction={{
              label: "View",
              onClick: (c) => {
                setSelectedCampaignId(c.id)
                setPanelMode("details")
              },
            }}
            rowActions={campaignRowActions}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 15, 20]}
            showPageSize
            itemLabel="campaigns"
            minWidth="min-w-[980px]"
            variant="flat"
            className="border-0 shadow-none rounded-none"
          />

          <details className="border-t border-slate-100">
            <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
              Manual generation tools
            </summary>
            <div className="space-y-3 border-t border-slate-50 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={checkCronStatus} loading={loadingCronStatus} loadingText="Checking…">
                  Campaign cron
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={checkReminderStatus} loading={loadingReminderStatus} loadingText="Checking…">
                  Reminder status
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={testReminders} loading={testingReminders} loadingText="Testing…">
                  Test reminders
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={sendWhatsAppOnManualGenerate}
                  onChange={(e) => setSendWhatsAppOnManualGenerate(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                Send WhatsApp on manual generate
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={generatingToday || generatingRandom}
                  loading={generatingToday}
                  loadingText="Generating…"
                  onClick={async () => {
                    if (generatingToday) return
                    try {
                      setGeneratingToday(true)
                      setSuccessMessage(null)
                      const currentUser = auth.currentUser
                      if (!currentUser) throw new Error("You must be logged in to generate campaigns")
                      const token = await currentUser.getIdToken()
                      setSuccessMessage("Checking today's health awareness days...")
                      const checkResponse = await fetch("/api/auto-campaigns/test?date=today", {
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      })
                      const checkData = await checkResponse.json()
                      if (checkData.healthDaysFound === 0) {
                        setSuccessMessage(`No health awareness days found for today (${checkData.dateFormatted}).`)
                        return
                      }
                      setSuccessMessage(`Found ${checkData.healthDaysFound} day(s). Generating…`)
                      const sendWhatsApp = sendWhatsAppOnManualGenerate ? "true" : "false"
                      const response = await fetch(`/api/auto-campaigns/generate?check=today&publish=true&sendWhatsApp=${sendWhatsApp}`, {
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      })
                      const data = await response.json()
                      if (data.success) {
                        if (data.campaignsGenerated === 0) {
                          setSuccessMessage(data.message || "No new campaigns generated.")
                        } else {
                          setSuccessMessage(
                            sendWhatsAppOnManualGenerate
                              ? `Generated ${data.campaignsGenerated} campaign(s) and sent WhatsApp notifications.`
                              : `Generated ${data.campaignsGenerated} campaign(s).`
                          )
                          setTimeout(async () => {
                            await reloadCampaigns()
                            await checkCronStatus()
                          }, 1000)
                        }
                      } else {
                        setSuccessMessage(data.error || "Failed to generate campaigns")
                      }
                    } catch (error: any) {
                      setSuccessMessage(error?.message || "Failed to generate campaigns")
                    } finally {
                      setGeneratingToday(false)
                    }
                  }}
                >
                  Generate today
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={generatingToday || generatingRandom}
                  loading={generatingRandom}
                  loadingText="Generating…"
                  onClick={async () => {
                    if (generatingRandom) return
                    try {
                      setGeneratingRandom(true)
                      setSuccessMessage(null)
                      const currentUser = auth.currentUser
                      if (!currentUser) throw new Error("You must be logged in to generate campaigns")
                      const token = await currentUser.getIdToken()
                      setSuccessMessage("Generating random awareness campaign…")
                      const sendWhatsApp = sendWhatsAppOnManualGenerate ? "true" : "false"
                      const response = await fetch(
                        `/api/auto-campaigns/generate?check=today&publish=true&sendWhatsApp=${sendWhatsApp}&random=true`,
                        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
                      )
                      const data = await response.json()
                      if (data.success) {
                        if (data.campaignsGenerated === 0) {
                          setSuccessMessage(data.message || "No new campaigns generated.")
                        } else {
                          setSuccessMessage(
                            sendWhatsAppOnManualGenerate
                              ? "Generated random campaign and sent WhatsApp messages."
                              : "Generated random campaign."
                          )
                          setTimeout(async () => {
                            await reloadCampaigns()
                            await checkCronStatus()
                          }, 1000)
                        }
                      } else {
                        setSuccessMessage(data.error || "Failed to generate random campaign")
                      }
                    } catch (error: any) {
                      setSuccessMessage(error?.message || "Failed to generate random campaign")
                    } finally {
                      setGeneratingRandom(false)
                    }
                  }}
                >
                  Generate random
                </Button>
              </div>
            </div>
          </details>
        </section>

        <aside className="camp-crm-panel camp-crm-panel--aside">
          <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 p-1">
            <button
              type="button"
              onClick={() => setPanelMode("details")}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                panelMode === "details" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={openCompose}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                panelMode === "compose" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {editingId ? "Edit" : "Create"}
            </button>
          </div>

          {panelMode === "details" ? (
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
              {selectedCampaign ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {selectedCampaign.audience}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        selectedCampaign.status === "published"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {selectedCampaign.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight text-slate-900">{selectedCampaign.title}</h3>
                  <div
                    className="prose prose-sm max-w-none text-xs text-slate-700"
                    dangerouslySetInnerHTML={sanitizeForInnerHTML(selectedCampaign.content)}
                  />
                  {selectedCampaign.ctaText && selectedCampaign.ctaHref && (
                    <a
                      className="inline-flex text-xs font-semibold text-cyan-700 transition-colors hover:text-cyan-800"
                      href={selectedCampaign.ctaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedCampaign.ctaText} ↗
                    </a>
                  )}
                  <dl className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Priority</dt>
                      <dd className="font-medium text-slate-800">{selectedCampaign.priority ?? 0}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Updated</dt>
                      <dd className="font-medium text-slate-800">{formatCampaignDate(selectedCampaign.updatedAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Slug</dt>
                      <dd className="truncate font-mono text-[10px] text-slate-700">{selectedCampaign.slug}</dd>
                    </div>
                  </dl>
                  {selectedCampaign.imageUrl && (
                    <img
                      src={selectedCampaign.imageUrl}
                      alt={selectedCampaign.title}
                      className="h-32 w-full rounded-lg border border-slate-200 object-cover transition-opacity hover:opacity-95"
                      loading="lazy"
                    />
                  )}
                  <div className="flex gap-2 pt-0.5">
                    <Button type="button" size="sm" className="flex-1" onClick={() => startEditing(selectedCampaign)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handlePublishToggle(selectedCampaign.id, selectedCampaign.status)}
                    >
                      {selectedCampaign.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="camp-crm-empty">
                  <div className="camp-crm-empty-icon">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <p className="camp-crm-empty-title">Select a campaign</p>
                  <p className="camp-crm-empty-desc">
                    Choose a row from the library to review content, status, and publish actions.
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={openCompose}>
                    Or create new
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <CampaignComposeWizard
                form={form}
                setForm={setForm}
                onTitleChange={handleTitleChange}
                onSubmit={handleSubmit}
                onCancel={editingId ? cancelEditing : resetForm}
                saving={saving}
                editingId={editingId}
                estimatedRecipients={null}
              />
            </div>
          )}
        </aside>
      </div>

      <CampaignAutomationPanel
        onQuickAction={handleAutomationQuickAction}
        canDuplicate={Boolean(selectedCampaign)}
        cronStatusLabel={cronStatus ? `Cron · ${cronStatus.status}` : null}
        reminderStatusLabel={
          reminderStatus
            ? `Reminders · ${reminderStatus.status}`
            : reminderStatusError
              ? `Reminders · error`
              : null
        }
        onToggleAutomation={(key, enabled) => {
          const labels: Record<string, string> = {
            birthday: "Birthday Campaign",
            followUp: "Follow-up Reminder",
            appointment: "Appointment Reminder",
            vaccination: "Vaccination Reminder",
            healthAwareness: "Health Awareness Campaign",
            festival: "Festival Greetings",
          }
          if (key === "appointment" && enabled) void checkReminderStatus()
          if (key === "healthAwareness" && enabled) void checkCronStatus()
          setSuccessMessage(`${enabled ? "Enabled" : "Disabled"} ${labels[key] || key}`)
          setTimeout(() => setSuccessMessage(null), 2000)
        }}
      />

      <CampaignAnalyticsSection campaigns={campaigns} failedMessages={kpiMetrics.failed} />
        </>
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

function CampaignCrmSkeleton() {
  return (
    <div className="camp-crm" aria-busy="true" aria-label="Loading campaigns">
      <div className="camp-crm-toolbar">
        <div className="space-y-1.5">
          <div className="camp-crm-skel camp-crm-skel-block w-24" />
          <div className="camp-crm-skel camp-crm-skel-block h-3 w-40" />
        </div>
        <div className="flex gap-1.5">
          <div className="camp-crm-skel h-8 w-24 rounded-md" />
          <div className="camp-crm-skel h-8 w-20 rounded-md" />
          <div className="camp-crm-skel h-8 w-16 rounded-md" />
        </div>
      </div>
      <div className="camp-crm-kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="camp-crm-kpi">
            <div className="camp-crm-skel camp-crm-skel-block w-16" />
            <div className="camp-crm-skel mt-3 h-6 w-10 rounded-md" />
          </div>
        ))}
      </div>
      <div className="camp-crm-workspace">
        <div className="camp-crm-panel p-3">
          <div className="camp-crm-skel camp-crm-skel-block mb-3 w-36" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="camp-crm-skel h-9 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="camp-crm-panel p-3">
          <div className="camp-crm-skel mb-3 h-8 w-full rounded-md" />
          <div className="camp-crm-skel camp-crm-skel-block mb-2 w-28" />
          <div className="camp-crm-skel mb-2 h-20 w-full rounded-md" />
          <div className="camp-crm-skel camp-crm-skel-block w-full" />
          <div className="camp-crm-skel camp-crm-skel-block mt-2 w-4/5" />
        </div>
      </div>
      <div className="camp-crm-section p-3">
        <div className="camp-crm-skel camp-crm-skel-block mb-3 w-40" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="camp-crm-skel h-[5.25rem] rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

