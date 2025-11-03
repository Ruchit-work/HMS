import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/firebase/config";

export type CampaignAudience = 'all' | 'patients' | 'doctors'
export type CampaignStatus = 'draft' | 'published'

export interface Campaign {
  id?: string
  title: string
  slug: string
  content: string
  imageUrl?: string
  ctaText?: string
  ctaHref?: string
  audience: CampaignAudience
  status: CampaignStatus
  priority?: number
  startAt?: Timestamp | null
  endAt?: Timestamp | null
  createdBy?: string
  updatedBy?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function createCampaign(campaign: Omit<Campaign, 'id'|'createdAt'|'updatedAt'>) {
  const ref = await addDoc(collection(db, 'campaigns'), {
    ...campaign,
    priority: campaign.priority ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCampaign(id: string, updates: Partial<Campaign>) {
  await updateDoc(doc(db, 'campaigns', id), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCampaign(id: string) {
  await deleteDoc(doc(db, 'campaigns', id))
}

export async function fetchPublishedCampaignsForAudience(audience: CampaignAudience, now: Date = new Date()) {
  const base = [
    where('status', '==', 'published'),
    orderBy('priority', 'desc'),
    orderBy('updatedAt', 'desc'),
  ] as const

  // For homepage we only want audience == 'all' without using 'in' (must be distinct values)
  const campaignsQuery = audience === 'all'
    ? query(collection(db, 'campaigns'), where('audience', '==', 'all'), ...base)
    : query(collection(db, 'campaigns'), where('audience', 'in', ['all', audience]), ...base)
  const snap = await getDocs(campaignsQuery)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[]

  const nowMs = now.getTime()
  return list.filter(c => {
    const startOk = !c.startAt || (c.startAt instanceof Timestamp ? c.startAt.toMillis() <= nowMs : true)
    const endOk = !c.endAt || (c.endAt instanceof Timestamp ? c.endAt.toMillis() >= nowMs : true)
    return startOk && endOk
  })
}


