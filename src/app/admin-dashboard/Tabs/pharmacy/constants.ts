export const CASH_DENOMS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

/** TEMP: set to true before production — handover note required when closing a cash shift */
export const REQUIRE_SHIFT_HANDOVER_NOTE = false

export const RETURN_REASON_OPTIONS: Array<{
  value: 'damaged' | 'wrong_medicine' | 'doctor_changed' | 'patient_request' | 'expired' | 'other'
  label: string
}> = [
  { value: 'damaged', label: 'Damaged item' },
  { value: 'wrong_medicine', label: 'Wrong medicine dispensed' },
  { value: 'doctor_changed', label: 'Doctor changed prescription' },
  { value: 'patient_request', label: 'Customer requested return' },
  { value: 'expired', label: 'Near expiry / expiry concern' },
  { value: 'other', label: 'Other reason' },
]

export const createEmptyCashNotes = (): Record<string, string> => ({
  '500': '',
  '200': '',
  '100': '',
  '50': '',
  '20': '',
  '10': '',
  '5': '',
  '2': '',
  '1': '',
})
