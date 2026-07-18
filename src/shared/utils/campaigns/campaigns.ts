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
  hospitalId?: string | null // null/undefined = auto-generated (show to all), string = manual (show only to that hospital)
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

export async function fetchPublishedCampaignsForAudience(
  audience: CampaignAudience, 
  patientHospitalId?: string | null,
  now: Date = new Date()
) {
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
    // Filter by date (start/end)
    const startOk = !c.startAt || (c.startAt instanceof Timestamp ? c.startAt.toMillis() <= nowMs : true)
    const endOk = !c.endAt || (c.endAt instanceof Timestamp ? c.endAt.toMillis() >= nowMs : true)
    if (!startOk || !endOk) return false

    // Filter by hospital:
    // All campaigns (both auto-generated and manual) are now hospital-specific
    // Show campaign only if patient's hospital matches the campaign's hospital
    if (!c.hospitalId) {
      // Legacy campaign without hospitalId - skip (shouldn't happen for new campaigns)
      return false
    } else {
      // Campaign with hospitalId - show only if patient's hospital matches
      return c.hospitalId === patientHospitalId
    }
  })
}

// ============================================================================
// Campaign Content Utilities
// ============================================================================

/**
 * Get plain text from HTML (for truncation) - works in browser and server
 */
export function getPlainText(html: string): string {
  if (!html) return ""
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .replace(/&amp;/g, "&") // Replace &amp; with &
    .replace(/&lt;/g, "<") // Replace &lt; with <
    .replace(/&gt;/g, ">") // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim()
}

/**
 * Truncate text to a maximum length at word boundary
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "..."
  }
  return truncated + "..."
}

/**
 * Get first paragraph or first few sentences from HTML content
 */
export function getContentPreview(html: string, maxLength: number = 150): string {
  if (!html) return ""
  
  // Try to extract first paragraph
  // Use [\s\S] instead of . with s flag to match any character including newlines (ES2017 compatible)
  const firstParagraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (firstParagraphMatch) {
    const firstPara = firstParagraphMatch[1]
    const plainText = getPlainText(firstPara)
    if (plainText.length <= maxLength) {
      return `<p>${firstPara}</p>`
    }
    const truncated = truncateText(plainText, maxLength)
    return `<p>${truncated}</p>`
  }
  
  // If no paragraph tags, try to get first sentence or truncate
  const plainText = getPlainText(html)
  if (plainText.length <= maxLength) {
    // Return first sentence if available
    const firstSentence = plainText.match(/^[^.!?]+[.!?]/)
    if (firstSentence && firstSentence[0].length <= maxLength) {
      return `<p>${firstSentence[0]}</p>`
    }
    return html
  }
  
  // Truncate and wrap in paragraph
  const truncated = truncateText(plainText, maxLength)
  return `<p>${truncated}</p>`
}

/**
 * Check if content should be truncated
 */
export function shouldTruncate(html: string, maxLength: number = 150): boolean {
  if (!html) return false
  const plainText = getPlainText(html)
  return plainText.length > maxLength
}

