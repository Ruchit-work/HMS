import { db } from "@/firebase/config"
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
} from "firebase/firestore"

export interface MedicineSuggestionOption {
  value: string
  count: number
  lastUsedAt: string
}

export interface MedicineSuggestion {
  id: string
  name: string
  normalizedName: string
  usageCount: number
  dosageOptions?: MedicineSuggestionOption[]
  frequencyOptions?: MedicineSuggestionOption[]
  durationOptions?: MedicineSuggestionOption[]
  createdAt: string
  updatedAt: string
}

const COLLECTION = "medicineSuggestions"
const MAX_OPTIONS_PER_FIELD = 6
const MAX_FETCH_RESULTS = 200

const cleanValue = (value?: string) => (value || "").trim().replace(/\s+/g, " ")

export const sanitizeMedicineName = (value: string) => {
  let cleaned = cleanValue(value)
  if (!cleaned) return ""
  cleaned = cleaned.replace(/^\d+\.?\s*/, "")
  cleaned = cleaned.replace(/^[\d️⃣]+\.?\s*/, "")
  cleaned = cleaned.replace(/[\*\_]/g, "")
  cleaned = cleaned.replace(/\[[^\]]*\]/g, "")
  cleaned = cleaned.replace(/[-–—]\s*(duration|for).*/i, "")
  cleaned = cleaned.replace(/\b(duration|for)\b.*$/i, "")
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim()
  return cleaned
}

const normalizeName = (value: string) => sanitizeMedicineName(value).toLowerCase()
const createDocId = (value: string) =>
  normalizeName(value).replace(/[^a-z0-9]+/g, "-") || `medicine-${Date.now()}`
const clampResults = (value: number) => Math.min(MAX_FETCH_RESULTS, Math.max(1, Math.floor(value || 50)))

const updateOptionList = (
  existing: MedicineSuggestionOption[] = [],
  rawValue?: string
) => {
  const value = cleanValue(rawValue)
  if (!value) return existing

  const nowIso = new Date().toISOString()
  const normalized = value.toLowerCase()
  const index = existing.findIndex((option) => option.value.toLowerCase() === normalized)

  if (index >= 0) {
    const updated = [...existing]
    const target = updated[index]
    updated[index] = {
      ...target,
      count: (target?.count || 0) + 1,
      lastUsedAt: nowIso,
    }
    return updated.sort((a, b) => b.count - a.count).slice(0, MAX_OPTIONS_PER_FIELD)
  }

  return [
    { value, count: 1, lastUsedAt: nowIso },
    ...existing,
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_OPTIONS_PER_FIELD)
}

export const recordMedicineSuggestions = async (
  medicines: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>
) => {
  if (!Array.isArray(medicines) || medicines.length === 0) return

  const tasks = medicines
    .map((medicine) => ({
      name: sanitizeMedicineName(medicine.name || ""),
      dosage: cleanValue(medicine.dosage),
      frequency: cleanValue(medicine.frequency),
      duration: cleanValue(medicine.duration),
    }))
    .filter((medicine) => medicine.name)
    .map(async (medicine) => {
      const sanitizedName = sanitizeMedicineName(medicine.name)
      const normalizedName = normalizeName(medicine.name)
      const docId = createDocId(medicine.name)
      const docRef = doc(db, COLLECTION, docId)
      const nowIso = new Date().toISOString()

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef)
        const data = snap.exists() ? (snap.data() as MedicineSuggestion) : null

        const payload: MedicineSuggestion = {
          id: docId,
          name: sanitizedName || data?.name || medicine.name,
          normalizedName: normalizedName || data?.normalizedName || "",
          usageCount: (data?.usageCount || 0) + 1,
          dosageOptions: updateOptionList(data?.dosageOptions, medicine.dosage),
          frequencyOptions: updateOptionList(data?.frequencyOptions, medicine.frequency),
          durationOptions: updateOptionList(data?.durationOptions, medicine.duration),
          createdAt: data?.createdAt || nowIso,
          updatedAt: nowIso,
        }

        transaction.set(docRef, payload)
      })
    })

  await Promise.all(tasks)
}

export const fetchMedicineSuggestions = async (maxResults = 50) => {
  const suggestionsRef = collection(db, COLLECTION)
  const safeLimit = clampResults(maxResults)
  const suggestionsQuery = query(
    suggestionsRef,
    orderBy("usageCount", "desc"),
    limit(safeLimit)
  )
  const snapshot = await getDocs(suggestionsQuery)
  return snapshot.docs.map((docSnap) => {
    const raw = docSnap.data() as MedicineSuggestion
    const sanitizedName = sanitizeMedicineName(raw.name)
    return {
      ...raw,
      id: docSnap.id,
      name: sanitizedName || raw.name,
      normalizedName: (sanitizedName || raw.normalizedName || raw.name).toLowerCase(),
    }
  }) as MedicineSuggestion[]
}

