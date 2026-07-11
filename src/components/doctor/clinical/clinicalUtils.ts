/** Shared clinical UI helpers — no business logic. */

export function getPatientInitials(name?: string): string {
  if (!name?.trim()) return "P"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}
