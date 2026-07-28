export type VisitType = "opd" | "ipd" | "day_care" | "minor_ot" | "major_ot"

export const DEFAULT_VISIT_TYPE: VisitType = "opd"

export const VISIT_TYPE_OPTIONS: Array<{
  value: VisitType
  label: string
  shortLabel: string
  description: string
}> = [
  {
    value: "opd",
    label: "Outpatient (OPD)",
    shortLabel: "OPD",
    description: "Standard outpatient consultation and checkup",
  },
  {
    value: "ipd",
    label: "Inpatient (IPD)",
    shortLabel: "IPD",
    description: "Inpatient room admission and care",
  },
  {
    value: "day_care",
    label: "Day Care",
    shortLabel: "Day Care",
    description: "Short stay procedures or observation without overnight stay",
  },
  {
    value: "minor_ot",
    label: "Minor OT",
    shortLabel: "Minor OT",
    description: "Minor surgical procedure or operation theatre visit",
  },
  {
    value: "major_ot",
    label: "Major OT",
    shortLabel: "Major OT",
    description: "Major operation theatre procedure foundation",
  },
]

export const ADMISSION_VISIT_TYPE_OPTIONS = VISIT_TYPE_OPTIONS.filter(
  (opt) => opt.value !== "opd"
)

export function normalizeVisitType(raw?: unknown): VisitType {
  if (!raw || typeof raw !== "string") return DEFAULT_VISIT_TYPE
  const normalized = raw.trim().toLowerCase()
  if (
    normalized === "opd" ||
    normalized === "ipd" ||
    normalized === "day_care" ||
    normalized === "minor_ot" ||
    normalized === "major_ot"
  ) {
    return normalized as VisitType
  }
  // Fallbacks for common string variations
  if (normalized.includes("day")) return "day_care"
  if (normalized.includes("minor")) return "minor_ot"
  if (normalized.includes("major")) return "major_ot"
  if (normalized.includes("ipd") || normalized.includes("inpatient")) return "ipd"
  return DEFAULT_VISIT_TYPE
}

export function normalizeAdmissionVisitType(raw?: unknown): VisitType {
  if (!raw || typeof raw !== "string") return "ipd"
  const normalized = raw.trim().toLowerCase()
  if (
    normalized === "ipd" ||
    normalized === "day_care" ||
    normalized === "minor_ot" ||
    normalized === "major_ot" ||
    normalized === "opd"
  ) {
    return normalized as VisitType
  }
  if (normalized.includes("day")) return "day_care"
  if (normalized.includes("minor")) return "minor_ot"
  if (normalized.includes("major")) return "major_ot"
  return "ipd"
}

export function getVisitTypeLabel(type?: string): string {
  const normalized = normalizeVisitType(type)
  const option = VISIT_TYPE_OPTIONS.find((opt) => opt.value === normalized)
  return option ? option.label : "Outpatient (OPD)"
}

export function getVisitTypeShortLabel(type?: string): string {
  const normalized = normalizeVisitType(type)
  const option = VISIT_TYPE_OPTIONS.find((opt) => opt.value === normalized)
  return option ? option.shortLabel : "OPD"
}

export function getVisitTypeBadgeClass(type?: string): string {
  const normalized = normalizeVisitType(type)
  switch (normalized) {
    case "opd":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "ipd":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "day_care":
      return "bg-amber-50 text-amber-800 border-amber-200"
    case "minor_ot":
      return "bg-rose-50 text-rose-700 border-rose-200"
    case "major_ot":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-blue-50 text-blue-700 border-blue-200"
  }
}
