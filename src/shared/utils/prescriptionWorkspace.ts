import type { CompletionFormEntry } from "@/types/appointments"
import type { Appointment } from "@/types/patient"
import type { MedicineSuggestion } from "@/shared/utils/medicineSuggestions"
import { parsePrescription as parsePrescriptionUtil } from "@/shared/utils/appointments/prescriptionParsers"

export interface PrescriptionTemplate {
  id: string
  name: string
  medicines: CompletionFormEntry["medicines"]
  createdAt: string
}

export interface FavoriteMedicine {
  name: string
  dosage?: string
  frequency?: string
  duration?: string
  addedAt: string
}

type MedicineRow = CompletionFormEntry["medicines"][number]

const FAVORITES_KEY = "hms-doctor-favorite-medicines"
const TEMPLATES_KEY = "hms-doctor-prescription-templates"

function storageKey(base: string, doctorUid: string) {
  return `${base}:${doctorUid}`
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getFavoriteMedicines(doctorUid: string): FavoriteMedicine[] {
  return readJson<FavoriteMedicine[]>(storageKey(FAVORITES_KEY, doctorUid), [])
}

export function toggleFavoriteMedicine(
  doctorUid: string,
  medicine: MedicineRow
): FavoriteMedicine[] {
  const key = storageKey(FAVORITES_KEY, doctorUid)
  const current = getFavoriteMedicines(doctorUid)
  const normalized = medicine.name.trim().toLowerCase()
  const exists = current.find((m) => m.name.trim().toLowerCase() === normalized)
  const next = exists
    ? current.filter((m) => m.name.trim().toLowerCase() !== normalized)
    : [
        {
          name: medicine.name.trim(),
          dosage: medicine.dosage,
          frequency: medicine.frequency,
          duration: medicine.duration,
          addedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 24)
  writeJson(key, next)
  return next
}

export function isFavoriteMedicine(doctorUid: string, name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return getFavoriteMedicines(doctorUid).some((m) => m.name.trim().toLowerCase() === normalized)
}

export function getPrescriptionTemplates(doctorUid: string): PrescriptionTemplate[] {
  return readJson<PrescriptionTemplate[]>(storageKey(TEMPLATES_KEY, doctorUid), [])
}

export function savePrescriptionTemplate(
  doctorUid: string,
  name: string,
  medicines: CompletionFormEntry["medicines"]
): PrescriptionTemplate[] {
  const key = storageKey(TEMPLATES_KEY, doctorUid)
  const trimmed = name.trim()
  if (!trimmed || medicines.length === 0) return getPrescriptionTemplates(doctorUid)

  const template: PrescriptionTemplate = {
    id: `tpl-${Date.now()}`,
    name: trimmed,
    medicines: medicines.map((m) => ({ ...m })),
    createdAt: new Date().toISOString(),
  }
  const next = [template, ...getPrescriptionTemplates(doctorUid)].slice(0, 12)
  writeJson(key, next)
  return next
}

export function deletePrescriptionTemplate(doctorUid: string, templateId: string): PrescriptionTemplate[] {
  const key = storageKey(TEMPLATES_KEY, doctorUid)
  const next = getPrescriptionTemplates(doctorUid).filter((t) => t.id !== templateId)
  writeJson(key, next)
  return next
}

export function getFrequentlyUsedMedicines(
  medicineSuggestions: MedicineSuggestion[],
  limit = 10
): MedicineRow[] {
  return medicineSuggestions.slice(0, limit).map((s) => ({
    name: s.name,
    dosage: s.dosageOptions?.[0]?.value ?? "",
    frequency: s.frequencyOptions?.[0]?.value ?? "",
    duration: s.durationOptions?.[0]?.value ?? "7 days",
  }))
}

export function getRecentPrescriptionsFromHistory(
  patientHistory: Appointment[],
  doctorId: string,
  currentAppointmentId: string,
  limit = 5
): Array<{ label: string; medicines: MedicineRow[] }> {
  const results: Array<{ label: string; medicines: MedicineRow[] }> = []

  patientHistory
    .filter(
      (h) =>
        h.doctorId === doctorId &&
        h.id !== currentAppointmentId &&
        h.status === "completed" &&
        h.medicine
    )
    .slice(0, limit)
    .forEach((visit) => {
      const parsed = parsePrescriptionUtil(visit.medicine!)
      if (!parsed?.medicines?.length) return
      const date = new Date(visit.appointmentDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
      results.push({
        label: `${date} · ${visit.chiefComplaint || "Visit"}`,
        medicines: parsed.medicines.map((m) => ({
          name: m.name || "",
          dosage: m.dosage || "",
          frequency: m.frequency || "",
          duration: m.duration || "",
        })),
      })
    })

  return results
}

export function mergeMedicines(
  existing: MedicineRow[],
  toAdd: MedicineRow[]
): MedicineRow[] {
  const seen = new Set(existing.map((m) => m.name.trim().toLowerCase()))
  const merged = [...existing]
  toAdd.forEach((med) => {
    const key = med.name.trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    merged.push(med)
  })
  return merged
}
