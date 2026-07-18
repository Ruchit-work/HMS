export interface SlotCheckResult {
  available: boolean
  error?: string
}

/** Shared slot availability check used by patient and receptionist booking flows. */
export async function checkAppointmentSlot(
  doctorId: string,
  date: string,
  time: string
): Promise<SlotCheckResult> {
  const params = new URLSearchParams({ doctorId, date, time })
  const res = await fetch(`/api/appointments/check-slot?${params.toString()}`)
  const data = await res.json().catch(() => ({} as { available?: boolean; error?: string }))

  if (!res.ok) {
    return {
      available: false,
      error: data?.error || "This slot is already booked. Please choose another time.",
    }
  }

  if (!data?.available) {
    return {
      available: false,
      error: data?.error || "This slot is already booked. Please choose another time.",
    }
  }

  return { available: true }
}

/** Throws when the slot is unavailable (convenience for submit handlers). */
export async function assertAppointmentSlotAvailable(
  doctorId: string,
  date: string,
  time: string
): Promise<void> {
  const result = await checkAppointmentSlot(doctorId, date, time)
  if (!result.available) {
    throw new Error(result.error)
  }
}
