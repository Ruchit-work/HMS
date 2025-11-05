'use client'

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import AdminProtected from "@/components/AdminProtected"
import { Campaign, CampaignAudience, CampaignStatus, createCampaign, deleteCampaign, slugify, updateCampaign } from "@/utils/campaigns"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { db } from "@/firebase/config"

export default function CampaignManagement({ disableAdminGuard = true }: { disableAdminGuard?: boolean } = {}) {
  const { user, loading: authLoading } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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
    if (!user || authLoading) return
    const load = async () => {
      const q = query(collection(db, 'campaigns'), orderBy('updatedAt', 'desc'))
      const snap = await getDocs(q)
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[])
    }
    load()
  }, [user, authLoading])

  const filtered = useMemo(() => {
    if (filter.status === 'all') return campaigns
    return campaigns.filter(c => c.status === filter.status)
  }, [campaigns, filter])

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
      setSuccessMessage("Campaign created successfully!")
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
      setSuccessMessage("Campaign deleted successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Error deleting campaign:", error)
    }
  }

  const content = (
    <div className="relative">
      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 transform transition-all duration-300 ease-in-out animate-pulse"
             style={{
                 animation: 'slideInRight 0.3s ease-out'
             }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{successMessage}</span>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="ml-2 text-green-200 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Create Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Campaign</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input 
              value={form.title} 
              onChange={e => handleTitleChange(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              placeholder="Summer Health Camp" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input 
              value={form.slug} 
              onChange={e => setForm(prev => ({ ...prev, slug: slugify(e.target.value) }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              placeholder="summer-health-camp" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select 
              value={form.audience} 
              onChange={e => setForm(prev => ({ ...prev, audience: e.target.value as CampaignAudience }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="patients">Patients</option>
              <option value="doctors">Doctors</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              value={form.status} 
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value as CampaignStatus }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input 
              value={form.imageUrl} 
              onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              placeholder="https://..." 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
              <input 
                value={form.ctaText} 
                onChange={e => setForm(prev => ({ ...prev, ctaText: e.target.value }))} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                placeholder="Learn more" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
              <input 
                value={form.ctaHref} 
                onChange={e => setForm(prev => ({ ...prev, ctaHref: e.target.value }))} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                placeholder="/patient-dashboard/services" 
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content (short HTML or text)</label>
            <textarea 
              value={form.content} 
              onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
              rows={4} 
              placeholder="Describe the campaign..." 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input 
              type="number" 
              value={form.priority ?? 0} 
              onChange={e => setForm(prev => ({ ...prev, priority: Number(e.target.value) }))} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
            />
          </div>
        </div>
        <div className="mt-4">
          <button 
            disabled={saving || !form.title} 
            onClick={handleCreate} 
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Create Campaign'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">All Campaigns ({filtered.length})</h3>
            <select 
              value={filter.status} 
              onChange={e => setFilter({ status: e.target.value as CampaignStatus|"all" })} 
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(c => (
              <div key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start justify-between">
                <div className="pr-4 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-700">
                      {c.audience}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">{c.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: c.content }} />
                  {c.ctaText && c.ctaHref && (
                    <p className="text-xs text-gray-500 mt-1">CTA: {c.ctaText} → {c.ctaHref}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePublishToggle(c.id, c.status)} 
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {c.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button 
                    onClick={() => handleDelete(c.id)} 
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">No campaigns yet.</div>
            )}
          </div>
        </div>
      </div>
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

