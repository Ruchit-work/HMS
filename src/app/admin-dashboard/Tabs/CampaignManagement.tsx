'use client'

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import AdminProtected from "@/components/AdminProtected"
import { Campaign, CampaignAudience, CampaignStatus, createCampaign, deleteCampaign, slugify, updateCampaign } from "@/utils/campaigns"
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore"
import { db } from "@/firebase/config"
import SuccessToast from "@/components/ui/SuccessToast"
import { formatDateTime } from "@/utils/date"

export default function CampaignManagement({ disableAdminGuard = true }: { disableAdminGuard?: boolean } = {}) {
  const { user, loading: authLoading } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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

  useEffect(() => {
    if (!user || authLoading) return
    const load = async () => {
      const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[])
    }
    load()
  }, [user, authLoading])

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
        const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
        const snap = await getDocs(q)
        const updated = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[]
        setCampaigns(updated)
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
        })
        const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
        const snap = await getDocs(q)
        const refreshed = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[]
        setCampaigns(refreshed)
        resetForm()
        setSuccessMessage("Campaign created successfully!")
      }
      setEditingId(null)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Error creating campaign:", error)
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (id?: string, current?: CampaignStatus) => {
    if (!id) return
    const next: CampaignStatus = current === 'published' ? 'draft' : 'published'
    try {
      await updateCampaign(id, { status: next })
      const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[])
      setSuccessMessage(`Campaign ${next === 'published' ? 'published' : 'unpublished'} successfully!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Error updating campaign:", error)
    }
  }

  const handleDelete = async (id?: string) => {
    if (!id) return
    try {
      await deleteCampaign(id)
      setCampaigns(prev => prev.filter(c => c.id !== id))
      setSelectedCampaignId(prev => (prev === id ? null : prev))
      if (editingId === id) {
        resetForm()
        setEditingId(null)
      }
      setSuccessMessage("Campaign deleted successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Error deleting campaign:", error)
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
        <SuccessToast
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
          className="shadow-xl"
        />
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
                        dangerouslySetInnerHTML={{ __html: campaign.content }}
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
                      className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                    >
                      {campaign.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditing(campaign)
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(campaign.id)
                      }}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete
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
              dangerouslySetInnerHTML={{ __html: selectedCampaign.content }}
            />
            {selectedCampaign.ctaText && selectedCampaign.ctaHref && (
              <a
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
                href={selectedCampaign.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
              >
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
                <img
                  src={selectedCampaign.imageUrl}
                  alt={selectedCampaign.title}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
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

