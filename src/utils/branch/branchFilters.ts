/**
 * Shared branch-filter helpers for Hospital Admin (and shared admin tabs).
 *
 * IMPORTANT: Call sites historically used two rules for missing/empty branch fields.
 * Do not collapse them — pass `unassigned: "keep" | "exclude"` explicitly.
 *
 * - "keep": unassigned/legacy rows stay visible when a branch is selected
 *   (dashboard overview patients/appointments/billing, PatientManagement, BillingManagement)
 * - "exclude": only exact branch matches (analytics hooks, appointment admin table, staff)
 */

export type BranchSelectionId = string | null | undefined

export type UnassignedBranchMode = "keep" | "exclude"

export function isAllBranches(selectedBranchId: BranchSelectionId): boolean {
  return selectedBranchId == null || selectedBranchId === "" || selectedBranchId === "all"
}

export function isUnassignedBranchValue(value: unknown): boolean {
  return value == null || value === ""
}

/**
 * Whether a single branch field matches the current selection.
 */
export function matchesSelectedBranch(
  value: unknown,
  selectedBranchId: BranchSelectionId,
  unassigned: UnassignedBranchMode = "exclude"
): boolean {
  if (isAllBranches(selectedBranchId)) return true
  if (isUnassignedBranchValue(value)) return unassigned === "keep"
  return value === selectedBranchId
}

export function filterByBranchField<T>(
  items: T[],
  selectedBranchId: BranchSelectionId,
  getBranchId: (item: T) => unknown,
  unassigned: UnassignedBranchMode = "exclude"
): T[] {
  if (isAllBranches(selectedBranchId)) return items
  return items.filter((item) =>
    matchesSelectedBranch(getBranchId(item), selectedBranchId, unassigned)
  )
}

/** Patients: uses `defaultBranchId`. */
export function filterPatientsByBranch<T>(
  items: T[],
  selectedBranchId: BranchSelectionId,
  options?: { unassigned?: UnassignedBranchMode }
): T[] {
  return filterByBranchField(
    items,
    selectedBranchId,
    (p) => (p as { defaultBranchId?: string | null }).defaultBranchId,
    options?.unassigned ?? "exclude"
  )
}

/** Appointments: uses `branchId`. */
export function filterAppointmentsByBranch<T>(
  items: T[],
  selectedBranchId: BranchSelectionId,
  options?: { unassigned?: UnassignedBranchMode }
): T[] {
  return filterByBranchField(
    items,
    selectedBranchId,
    (a) => (a as { branchId?: string | null }).branchId,
    options?.unassigned ?? "exclude"
  )
}

/**
 * Billing records: uses `branchId`.
 * Default unassigned mode is "keep" (matches BillingManagement + dashboard billing sums).
 */
export function filterBillingByBranch<T>(
  items: T[],
  selectedBranchId: BranchSelectionId,
  options?: { unassigned?: UnassignedBranchMode }
): T[] {
  return filterByBranchField(
    items,
    selectedBranchId,
    (b) => (b as { branchId?: string | null }).branchId,
    options?.unassigned ?? "keep"
  )
}

/**
 * Financial analytics billing filter:
 * match record.branchId, else linked appointment already in the branch-filtered list.
 */
export function filterBillingByBranchOrAppointmentLink<T, A>(
  records: T[],
  appointments: A[],
  selectedBranchId: BranchSelectionId
): T[] {
  if (isAllBranches(selectedBranchId)) return records
  return records.filter((record) => {
    const row = record as { branchId?: string | null; appointmentId?: string | null }
    if (row.branchId && row.branchId === selectedBranchId) return true
    if (row.appointmentId) {
      const apt = appointments.find(
        (a) => (a as { id: string }).id === row.appointmentId
      ) as { branchId?: string | null } | undefined
      return Boolean(apt && apt.branchId === selectedBranchId)
    }
    return false
  })
}

/** Staff / receptionists / pharmacists: uses `branchId` (strict). */
export function filterStaffByBranch<T>(
  items: T[],
  selectedBranchId: BranchSelectionId
): T[] {
  return filterByBranchField(
    items,
    selectedBranchId,
    (s) => (s as { branchId?: string | null }).branchId,
    "exclude"
  )
}

/** Doctors: uses `branchIds` membership (strict; no unassigned keep). */
export function filterDoctorsByBranch<T>(
  items: T[],
  selectedBranchId: BranchSelectionId
): T[] {
  if (isAllBranches(selectedBranchId)) return items
  return items.filter((doctor) => {
    const branchIds = (doctor as { branchIds?: string[] | null }).branchIds || []
    return Array.isArray(branchIds) && branchIds.includes(selectedBranchId as string)
  })
}

/** Branch entities: filter list by selected branch id. */
export function filterBranchesBySelection<T extends { id: string }>(
  items: T[],
  selectedBranchId: BranchSelectionId
): T[] {
  if (isAllBranches(selectedBranchId)) return items
  return items.filter((b) => b.id === selectedBranchId)
}
