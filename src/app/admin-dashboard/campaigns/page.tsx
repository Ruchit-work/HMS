"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import { Campaign, CampaignAudience, CampaignStatus, createCampaign, deleteCampaign, fetchPublishedCampaignsForAudience, slugify, updateCampaign } from "@/utils/campaigns"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "@/firebase/config"

export default function AdminCampaignsPage() {
  const { user, loading } = useAuth("admin")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Campaign>({
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
  const [filter, setFilter] = useState<{status: CampaignStatus|"all"}>({ status: "all" })

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[])
    }
    load()
  }, [user])

  const filtered = useMemo(() => {
    if (filter.status === 'all') return campaigns
    return campaigns.filter(c => c.status === filter.status)
  }, [campaigns, filter])

  if (loading) {
    return <LoadingSpinner message="Loading Campaigns..." />
  }

  if (!user) {
    return null
  }

  const handleTitleChange = (title: string) => {
    setForm(prev => ({ ...prev, title, slug: prev.slug || slugify(title) }))
  }

  const handleCreate = async () => {
    if (!form.title || !form.slug) return
    setSaving(true)
    try {
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
      // reload
      const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[])
      setForm({ title: "", slug: "", content: "", imageUrl: "", ctaText: "", ctaHref: "", audience: "all", status: "draft", priority: 0 })
    } finally {
      setSaving(false)
    }
  }

  const handlePublishToggle = async (id?: string, current?: CampaignStatus) => {
    if (!id) return
    const next: CampaignStatus = current === 'published' ? 'draft' : 'published'
    await updateCampaign(id, { status: next })
    const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
    const snap = await getDocs(q)
    setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[])
  }

  const handleDelete = async (id?: string) => {
    if (!id) return
    await deleteCampaign(id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Campaigns</h1>
          <p className="text-slate-600 text-sm">Create, publish, and manage promotional campaigns.</p>
        </div>

        {/* Create Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">New Campaign</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input value={form.title} onChange={e => handleTitleChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Summer Health Camp" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
              <input value={form.slug} onChange={e => setForm(prev => ({ ...prev, slug: slugify(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg" placeholder="summer-health-camp" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
              <select value={form.audience} onChange={e => setForm(prev => ({ ...prev, audience: e.target.value as CampaignAudience }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="all">All</option>
                <option value="patients">Patients</option>
                <option value="doctors">Doctors</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as CampaignStatus }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
              <input value={form.imageUrl} onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CTA Text</label>
                <input value={form.ctaText} onChange={e => setForm(prev => ({ ...prev, ctaText: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Learn more" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CTA Link</label>
                <input value={form.ctaHref} onChange={e => setForm(prev => ({ ...prev, ctaHref: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="/patient-dashboard/services" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Content (short HTML or text)</label>
              <textarea value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" rows={4} placeholder="Describe the campaign..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <input type="number" value={form.priority ?? 0} onChange={e => setForm(prev => ({ ...prev, priority: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="mt-4">
            <button disabled={saving || !form.title} onClick={handleCreate} className="px-4 py-2 bg-slate-800 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">All Campaigns</h2>
          <select value={filter.status} onChange={e => setFilter({ status: e.target.value as CampaignStatus|"all" })} className="px-3 py-2 border rounded-lg text-sm">
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-start justify-between">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full border">
                    {c.audience}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                    {c.status}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-800">{c.title}</h3>
                <p className="text-sm text-slate-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: c.content }} />
                {c.ctaText && c.ctaHref && (
                  <p className="text-xs text-slate-500 mt-1">CTA: {c.ctaText} → {c.ctaHref}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePublishToggle(c.id, c.status)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded">
                  {c.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded">Delete</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">No campaigns yet.</div>
          )}
        </div>
      </main>
    </div>
  )
}


