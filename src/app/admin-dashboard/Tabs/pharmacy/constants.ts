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

/** Align with @theme tokens in globals.css */
export const PHARMACY_UI = {
  primary: '#0891b2',
  primaryDark: '#0e7490',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
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
