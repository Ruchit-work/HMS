import type { DocumentMetadata, DocumentType } from "@/types/document"

export type ClinicalReportCategory =
  | "all"
  | "lab"
  | "radiology"
  | "prescription"
  | "clinical"
  | "discharge"

export interface ClinicalReportEntry {
  id: string
  document: DocumentMetadata
  category: Exclude<ClinicalReportCategory, "all">
  displayDate: string
  displayDoctor: string
  statusLabel: string
  statusTone: "neutral" | "linked" | "critical" | "archived"
  isCritical: boolean
  criticalSnippet?: string
  isLinkedToCurrentVisit: boolean
}

const CRITICAL_PATTERNS = [
  /\bcritical\b/i,
  /\babnormal\b/i,
  /\burgent\b/i,
  /\balert\b/i,
  /\bpositive\b/i,
  /\belevated\b/i,
  /\bhigh[\s-]?risk\b/i,
  /\bmalignant\b/i,
  /\bcancer\b/i,
  /\btumor\b/i,
  /\bfracture\b/i,
  /\bhemorrhage\b/i,
  /\binfarction\b/i,
  /\bsepsis\b/i,
  /\bacute\b/i,
  /\bsevere\b/i,
  /\bout of range\b/i,
  /\bflagged\b/i,
  /\bneeds? review\b/i,
  /\bimpression:\s*.+critical/i,
]

const DISCHARGE_PATTERNS = [/\bdischarge\b/i, /\bsummary\b/i, /\bdischarge summary\b/i]

export function detectCriticalFindings(doc: DocumentMetadata): {
  isCritical: boolean
  snippet?: string
} {
  const haystack = [
    doc.originalFileName,
    doc.description,
    doc.specialty,
    ...(doc.tags || []),
  ]
    .filter(Boolean)
    .join(" ")

  if (!haystack.trim()) return { isCritical: false }

  const matched = CRITICAL_PATTERNS.find((p) => p.test(haystack))
  if (!matched) return { isCritical: false }

  const source = doc.description?.trim() || doc.originalFileName
  return {
    isCritical: true,
    snippet: source.length > 120 ? `${source.slice(0, 117)}…` : source,
  }
}

export function categorizeDocument(doc: DocumentMetadata): Exclude<ClinicalReportCategory, "all"> {
  if (doc.fileType === "laboratory-report") return "lab"
  if (doc.fileType === "radiology-report" || doc.fileType === "cardiology-report") return "radiology"
  if (doc.fileType === "prescription") return "prescription"

  const text = `${doc.originalFileName} ${doc.description || ""} ${(doc.tags || []).join(" ")}`
  if (DISCHARGE_PATTERNS.some((p) => p.test(text))) return "discharge"
  return "clinical"
}

export function getReportCategoryLabel(category: Exclude<ClinicalReportCategory, "all">): string {
  const labels: Record<Exclude<ClinicalReportCategory, "all">, string> = {
    lab: "Lab report",
    radiology: "Radiology",
    prescription: "Prescription",
    clinical: "Clinical document",
    discharge: "Discharge summary",
  }
  return labels[category]
}

export function getReportCategoryIcon(category: Exclude<ClinicalReportCategory, "all">): string {
  const icons: Record<Exclude<ClinicalReportCategory, "all">, string> = {
    lab: "🧪",
    radiology: "🩻",
    prescription: "💊",
    clinical: "📋",
    discharge: "📄",
  }
  return icons[category]
}

export function formatReportDate(doc: DocumentMetadata): string {
  const raw = doc.appointmentDate || doc.uploadedAt
  return new Date(raw).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function getReportDoctor(doc: DocumentMetadata): string {
  if (doc.doctorName?.trim()) return doc.doctorName.trim()
  if (doc.uploadedBy?.name?.trim()) return doc.uploadedBy.name.trim()
  return "—"
}

export function buildClinicalReportEntries(
  documents: DocumentMetadata[],
  currentAppointmentId?: string
): ClinicalReportEntry[] {
  return documents
    .map((document) => {
      const category = categorizeDocument(document)
      const { isCritical, snippet } = detectCriticalFindings(document)
      const isLinkedToCurrentVisit = Boolean(
        currentAppointmentId && document.appointmentId === currentAppointmentId
      )

      let statusLabel = "Available"
      let statusTone: ClinicalReportEntry["statusTone"] = "neutral"

      if (document.status === "archived") {
        statusLabel = "Archived"
        statusTone = "archived"
      } else if (isCritical) {
        statusLabel = "Needs review"
        statusTone = "critical"
      } else if (isLinkedToCurrentVisit) {
        statusLabel = "This visit"
        statusTone = "linked"
      } else if (document.isLinkedToAppointment) {
        statusLabel = "Linked"
        statusTone = "linked"
      }

      return {
        id: document.id,
        document,
        category,
        displayDate: formatReportDate(document),
        displayDoctor: getReportDoctor(document),
        statusLabel,
        statusTone,
        isCritical,
        criticalSnippet: snippet,
        isLinkedToCurrentVisit,
      }
    })
    .sort((a, b) => {
      const aTime = new Date(a.document.appointmentDate || a.document.uploadedAt).getTime()
      const bTime = new Date(b.document.appointmentDate || b.document.uploadedAt).getTime()
      return bTime - aTime
    })
}

export function filterReportEntries(
  entries: ClinicalReportEntry[],
  category: ClinicalReportCategory
): ClinicalReportEntry[] {
  if (category === "all") return entries
  return entries.filter((e) => e.category === category)
}

export function countReportsByCategory(entries: ClinicalReportEntry[]) {
  return {
    all: entries.length,
    lab: entries.filter((e) => e.category === "lab").length,
    radiology: entries.filter((e) => e.category === "radiology").length,
    prescription: entries.filter((e) => e.category === "prescription").length,
    clinical: entries.filter((e) => e.category === "clinical").length,
    discharge: entries.filter((e) => e.category === "discharge").length,
    critical: entries.filter((e) => e.isCritical).length,
  }
}

export function getFileTypeLabel(fileType: DocumentType): string {
  return getReportCategoryLabel(categorizeDocument({ fileType } as DocumentMetadata))
}
