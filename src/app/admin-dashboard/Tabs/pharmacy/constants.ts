export const CASH_DENOMS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

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

export const PHARMACY_UI = {
  primary: '#2563EB',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E5E7EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

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
