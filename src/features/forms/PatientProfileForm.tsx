'use client'

import { useEffect, useMemo, useState } from 'react'
import PasswordRequirements, { isPasswordValid } from '@/features/forms/PasswordComponents'
import { bloodGroups } from '@/constants/signup'
import { Button } from '@/shared/components'
import type { AddPatientFieldConfig } from '@/types/hospital'
import { useMultiHospital } from '@/providers/MultiHospitalProvider'
import { usePatients } from '@/shared/hooks/usePatients'

export interface PatientProfileFormValues {
  firstName: string
  lastName: string
  email: string
  gender: string
  phone: string
  countryCode: string
  dateOfBirth: string
  bloodGroup: string
  address: string
  heightCm: string
  weightKg: string
  status: 'active' | 'inactive'
  password: string
  city?: string
  state?: string
  pincode?: string
  alternatePhone?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  maritalStatus?: string
  occupation?: string
  insuranceProvider?: string
  insurancePolicyNumber?: string
  attachedFiles?: File[]
}

interface PatientProfileFormProps {
  mode: 'public' | 'admin'
  isEditMode?: boolean
  initialValues?: Partial<Omit<PatientProfileFormValues, 'status'>> & { status?: PatientProfileFormValues['status'] }
  loading?: boolean
  submitLabel?: string
  onSubmit: (values: PatientProfileFormValues) => Promise<void> | void
  onCancel?: () => void
  showStatusField?: boolean
  enableCountryCode?: boolean
  externalError?: string | null
  onErrorClear?: () => void
  /** When true (receptionist add-patient): default password 123456, min 6 chars only, no OTP */
  receptionistMode?: boolean
  /** Hospital-specific field visibility config */
  fieldConfig?: AddPatientFieldConfig | null
}

const RECEPTIONIST_DEFAULT_PASSWORD = '123456'

export default function PatientProfileForm({
  mode,
  isEditMode = false,
  initialValues,
  loading,
  submitLabel,
  onSubmit,
  onCancel,
  showStatusField = mode === 'admin',
  enableCountryCode = mode === 'public',
  externalError,
  onErrorClear,
  receptionistMode = false,
  fieldConfig,
}: PatientProfileFormProps) {
  const { activeHospitalId } = useMultiHospital()
  const { patients } = usePatients(activeHospitalId, { enabled: Boolean(activeHospitalId) })

  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '')
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [gender, setGender] = useState(initialValues?.gender ?? '')
  const [phone, setPhone] = useState(initialValues?.phone ?? '')
  const [countryCode, setCountryCode] = useState(initialValues?.countryCode ?? '+91')
  const [dateOfBirth, setDateOfBirth] = useState(initialValues?.dateOfBirth ?? '')
  const [bloodGroup, setBloodGroup] = useState(initialValues?.bloodGroup ?? '')
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [city, setCity] = useState(initialValues?.city ?? '')
  const [state, setState] = useState(initialValues?.state ?? '')
  const [pincode, setPincode] = useState(initialValues?.pincode ?? '')
  const [alternatePhone, setAlternatePhone] = useState(initialValues?.alternatePhone ?? '')
  const [emergencyContactName, setEmergencyContactName] = useState(initialValues?.emergencyContactName ?? '')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialValues?.emergencyContactPhone ?? '')
  const [maritalStatus, setMaritalStatus] = useState(initialValues?.maritalStatus ?? '')
  const [occupation, setOccupation] = useState(initialValues?.occupation ?? '')
  const [insuranceProvider, setInsuranceProvider] = useState(initialValues?.insuranceProvider ?? '')
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState(initialValues?.insurancePolicyNumber ?? '')
  const [heightCm, setHeightCm] = useState(initialValues?.heightCm ?? '')
  const [weightKg, setWeightKg] = useState(initialValues?.weightKg ?? '')
  const [status, setStatus] = useState<PatientProfileFormValues['status']>(
    showStatusField ? initialValues?.status ?? 'active' : 'active'
  )

  const [password, setPassword] = useState(initialValues?.password ?? (receptionistMode ? RECEPTIONIST_DEFAULT_PASSWORD : ''))
  const [confirmPassword, setConfirmPassword] = useState(initialValues?.password ?? (receptionistMode ? RECEPTIONIST_DEFAULT_PASSWORD : ''))
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false)
  const [documentNames, setDocumentNames] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Email is only mandatory for public self-signup (it is the portal login).
  // Admin/receptionist registration works without an email.
  const emailRequired = mode === 'public'

  useEffect(() => {
    setFormError(null)
  }, [externalError])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('[data-dropdown-toggle="blood-group"]') && !target.closest('[data-dropdown-menu="blood-group"]')) {
        setShowBloodGroupDropdown(false)
      }
    }
    if (showBloodGroupDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBloodGroupDropdown])

  // Filter hospital patients matching entered phone number
  const matchingExistingPatients = useMemo(() => {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 7) return []
    const searchLast10 = digits.length >= 10 ? digits.slice(-10) : digits

    return patients.filter((p: any) => {
      const pPhoneDigits = (p.phone || p.phoneNumber || p.contact || "").replace(/\D/g, "")
      if (!pPhoneDigits) return false
      const pLast10 = pPhoneDigits.length >= 10 ? pPhoneDigits.slice(-10) : pPhoneDigits
      return pLast10.includes(searchLast10) || searchLast10.includes(pLast10)
    })
  }, [patients, phone])

  if (fieldConfig === null) {
    return (
      <div className="p-6 space-y-6 animate-pulse bg-white rounded-xl">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-slate-200 rounded-md" />
          <div className="h-3.5 w-64 bg-slate-100 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-slate-200 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
        </div>
        <div className="space-y-2 pt-4">
          <div className="h-5 w-32 bg-slate-200 rounded-md" />
          <div className="h-10 bg-slate-200 rounded-xl" />
        </div>
      </div>
    )
  }

  const clearErrors = () => {
    setFormError(null)
    setFieldErrors({})
    onErrorClear?.()
  }

  // Field-level validation functions
  const validateField = (fieldName: string, value: string): string | null => {
    switch (fieldName) {
      case 'firstName':
        if (!value.trim()) return 'First name is required'
        return null
      case 'lastName':
        if (!value.trim()) return 'Last name is required'
        return null
      case 'email': {
        if (!value.trim()) return emailRequired ? 'Email address is required' : null
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value.trim())) return 'Please enter a valid email address'
        return null
      }
      case 'phone':
        if (value.trim()) {
          const normalizedCountryCode = (countryCode || '+91').trim() || '+91'
          const cleanedCountryCode = normalizedCountryCode.replace(/\D/g, '')
          const cleanedPhone = value.replace(/\D/g, '')
          const totalDigits = (cleanedCountryCode + cleanedPhone).length
          if (totalDigits < 7 || totalDigits > 15) {
            return 'Phone number should contain 7-15 digits including country code'
          }
        }
        return null
      case 'dateOfBirth':
        if (mode === 'public' && !value) return 'Date of birth is required'
        return null
      case 'password':
        if (!value) return 'Password is required'
        if (!isPasswordValid(value)) return 'Password does not meet requirements'
        return null
      case 'confirmPassword':
        if (value !== password) return 'Passwords do not match'
        return null
      default:
        return null
    }
  }

  const handleFieldBlur = (fieldName: string, value: string) => {
    const error = validateField(fieldName, value)
    if (error) {
      setFieldErrors(prev => ({ ...prev, [fieldName]: error }))
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearErrors()

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedFirst) {
      return setFormError('Please enter first name')
    }
    if (!trimmedLast) {
      return setFormError('Please enter last name')
    }
    if (emailRequired && !trimmedEmail) {
      return setFormError('Please enter email address')
    }
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        return setFormError('Please enter a valid email address')
      }
    }

    if (trimmedPhone) {
      const normalizedCountryCode = (countryCode || '+91').trim() || '+91'
      const cleanedCountryCode = normalizedCountryCode.replace(/\D/g, '')
      const cleanedPhone = trimmedPhone.replace(/\D/g, '')
      const totalDigits = (cleanedCountryCode + cleanedPhone).length
      if (totalDigits < 7 || totalDigits > 15) {
        return setFormError('Phone number should contain 7-15 digits including country code')
      }
    }

    if (mode === 'public' && !dateOfBirth) {
      return setFormError('Please enter your date of birth')
    }

    const trimmedHeight = heightCm.trim()
    const trimmedWeight = weightKg.trim()
    if (trimmedHeight && (!Number.isFinite(Number(trimmedHeight)) || Number(trimmedHeight) <= 0)) {
      return setFormError('Please enter a valid height in cm')
    }
    if (trimmedWeight && (!Number.isFinite(Number(trimmedWeight)) || Number(trimmedWeight) <= 0)) {
      return setFormError('Please enter a valid weight in kg')
    }

    if (!isEditMode) {
      if (!password) {
        return setFormError('Please provide a password')
      }

      if (receptionistMode) {
        if (password.length < 6) return setFormError('Password must be at least 6 characters')
      } else if (!isPasswordValid(password)) {
        return setFormError('Password does not meet requirements')
      }

      if (password !== confirmPassword) {
        return setFormError('Passwords do not match')
      }
    }

    const normalizedCountryCode = (countryCode || '+91').trim() || '+91'

    const payload: PatientProfileFormValues = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: trimmedEmail,
      gender,
      phone: trimmedPhone,
      countryCode: normalizedCountryCode,
      dateOfBirth,
      bloodGroup,
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      alternatePhone: alternatePhone.trim(),
      emergencyContactName: emergencyContactName.trim(),
      emergencyContactPhone: emergencyContactPhone.trim(),
      maritalStatus: maritalStatus.trim(),
      occupation: occupation.trim(),
      insuranceProvider: insuranceProvider.trim(),
      insurancePolicyNumber: insurancePolicyNumber.trim(),
      heightCm: trimmedHeight,
      weightKg: trimmedWeight,
      status: showStatusField ? status : 'active',
      password: isEditMode ? '' : password,
      attachedFiles: selectedFiles,
    }

    setIsSubmitting(true)
    try {
      await onSubmit(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong when saving the patient profile.'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-0" onSubmit={handleSubmit}>

      {/* ── Global error banner ── */}
      {(formError || externalError) && (
        <div className="rx-form-error-banner mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500">
              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-red-800">{formError ?? externalError}</p>
          </div>
          <button type="button" onClick={clearErrors} aria-label="Dismiss error"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════
          Section 1 — Personal Information
          ══════════════════════════════════════ */}
      <div className="rx-form-section">
        <div className="rx-form-section-header">
          <div className="rx-form-section-icon">
            <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="rx-form-section-title">Personal Information</p>
            <p className="rx-form-section-desc">Basic identification and contact details for the patient record</p>
          </div>
        </div>

        {/* ── Contact / Phone Number (TOP FIELD) ── */}
        <div className="rx-form-field mb-4">
          <label className="rx-form-label">
            Contact / Phone Number <span className="rx-required">*</span>
          </label>
          <div className="flex gap-2">
            {enableCountryCode && (
              <input
                type="text"
                value={countryCode}
                onChange={(e) => { setCountryCode(e.target.value); clearErrors() }}
                className="rx-form-input w-20 shrink-0"
                placeholder="+91"
              />
            )}
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (fieldErrors.phone) {
                  setFieldErrors(prev => { const n = { ...prev }; delete n.phone; return n })
                }
                clearErrors()
              }}
              onBlur={(e) => handleFieldBlur('phone', e.target.value)}
              className={`rx-form-input flex-1 ${fieldErrors.phone ? 'rx-form-input--error' : ''}`}
              placeholder={enableCountryCode ? '98765 43210' : 'Enter phone number (e.g. 7359057367)'}
              required
            />
          </div>
          {fieldErrors.phone && (
            <p className="rx-form-error-text mt-1">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {fieldErrors.phone}
            </p>
          )}

          {/* Compact Informational List for Existing Patients sharing this phone number */}
          {matchingExistingPatients.length > 0 && (
            <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs space-y-1.5 shadow-2xs">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Existing patients using this contact number:
              </p>
              <ul className="space-y-1 pl-1">
                {matchingExistingPatients.map((p: any) => {
                  const pName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unnamed Patient"
                  const pId = p.patientId ? `#${p.patientId}` : `#${p.id.slice(0, 6)}`
                  const pPhone = p.phone || p.phoneNumber || p.contact || phone
                  return (
                    <li key={p.id} className="text-amber-800 font-medium leading-tight">
                      • {pName} — Patient ID: {pId} — {pPhone}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Name row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rx-form-field">
            <label className="rx-form-label">
              First Name <span className="rx-required">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                if (fieldErrors.firstName) {
                  setFieldErrors(prev => { const n = { ...prev }; delete n.firstName; return n })
                }
                clearErrors()
              }}
              onBlur={(e) => handleFieldBlur('firstName', e.target.value)}
              className={`rx-form-input ${fieldErrors.firstName ? 'rx-form-input--error' : ''}`}
              placeholder="e.g. Rahul"
              required
            />
            {fieldErrors.firstName && (
              <p className="rx-form-error-text">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {fieldErrors.firstName}
              </p>
            )}
          </div>
          <div className="rx-form-field">
            <label className="rx-form-label">
              Last Name <span className="rx-required">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                if (fieldErrors.lastName) {
                  setFieldErrors(prev => { const n = { ...prev }; delete n.lastName; return n })
                }
                clearErrors()
              }}
              onBlur={(e) => handleFieldBlur('lastName', e.target.value)}
              className={`rx-form-input ${fieldErrors.lastName ? 'rx-form-input--error' : ''}`}
              placeholder="e.g. Sharma"
              required
            />
            {fieldErrors.lastName && (
              <p className="rx-form-error-text">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {fieldErrors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Gender */}
        {fieldConfig?.gender !== false && (
          <div className="rx-form-field mt-4">
            <label className="rx-form-label">Gender</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Male', icon: (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )},
                { label: 'Female', icon: (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )},
                { label: 'Other', icon: (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                )},
              ].map((option) => (
                <label key={option.label}
                  className={`rx-form-tile ${gender === option.label ? 'rx-form-tile--active' : ''}`}>
                  <input type="radio" name="gender" value={option.label}
                    checked={gender === option.label}
                    onChange={(e) => { setGender(e.target.value); clearErrors() }}
                    className="sr-only"
                  />
                  {option.icon}
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* DOB + Blood Group */}
        {(fieldConfig?.dateOfBirth !== false || fieldConfig?.bloodGroup !== false) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
            {fieldConfig?.dateOfBirth !== false && (
              <div className="rx-form-field">
                <label className="rx-form-label">
                  Date of Birth
                  {mode === 'public' && <span className="rx-required">*</span>}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => { setDateOfBirth(e.target.value); clearErrors() }}
                  max={today}
                  className="rx-form-input"
                  required={mode === 'public'}
                />
                <p className="rx-form-helper">Used to calculate age and apply age-specific protocols</p>
              </div>
            )}
            {fieldConfig?.bloodGroup !== false && (
              <div className="rx-form-field">
                <label className="rx-form-label">Blood Group</label>
                <div className="relative">
                  <button
                    data-dropdown-toggle="blood-group"
                    onClick={() => { clearErrors(); setShowBloodGroupDropdown((prev) => !prev) }}
                    className="rx-form-input flex items-center justify-between text-left"
                    type="button"
                  >
                    <span className={bloodGroup ? 'text-slate-900' : 'text-slate-400'}>
                      {bloodGroup || 'Select blood group'}
                    </span>
                    <svg className={`h-4 w-4 text-slate-400 transition-transform ${showBloodGroupDropdown ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 10 6">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                    </svg>
                  </button>
                  <div data-dropdown-menu="blood-group"
                    className={`absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ${showBloodGroupDropdown ? 'block' : 'hidden'}`}>
                    <ul className="max-h-48 overflow-y-auto py-1 text-sm">
                      <li>
                        <button type="button" onClick={() => { setBloodGroup(''); setShowBloodGroupDropdown(false) }}
                          className="block w-full px-3 py-2 text-left text-slate-400 hover:bg-slate-50">
                          Select blood group
                        </button>
                      </li>
                      {bloodGroups.map((group) => (
                        <li key={group}>
                          <button type="button"
                            onClick={() => { setBloodGroup(group); setShowBloodGroupDropdown(false) }}
                            className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-cyan-50 hover:text-cyan-800">
                            {group}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="rx-form-helper">Critical for emergency transfusions and surgical preparation</p>
              </div>
            )}
          </div>
        )}

        {/* Height + Weight */}
        {fieldConfig?.heightWeight !== false && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
            <div className="rx-form-field">
              <label className="rx-form-label">Height (cm)</label>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={heightCm}
                onChange={(e) => { setHeightCm(e.target.value); clearErrors() }}
                className="rx-form-input"
                placeholder="e.g. 170"
              />
              <p className="rx-form-helper">Optional — recorded in the patient's vitals</p>
            </div>
            <div className="rx-form-field">
              <label className="rx-form-label">Weight (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={weightKg}
                onChange={(e) => { setWeightKg(e.target.value); clearErrors() }}
                className="rx-form-input"
                placeholder="e.g. 65"
              />
              <p className="rx-form-helper">Optional — recorded in the patient's vitals</p>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          Section 2 — Contact & Address Details
          ══════════════════════════════════════ */}
      {!receptionistMode && (fieldConfig?.email !== false || fieldConfig?.alternatePhone !== false || fieldConfig?.address !== false || fieldConfig?.cityStatePincode !== false) && (
        <div className="rx-form-section">
          <div className="rx-form-section-header">
            <div className="rx-form-section-icon">
              <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="rx-form-section-title">Contact & Address Details</p>
              <p className="rx-form-section-desc">Email, address, and alternate contact information</p>
            </div>
          </div>

          {/* Email */}
          {fieldConfig?.email !== false && (
            <div className="rx-form-field">
              <label className="rx-form-label">
                Email Address
                {emailRequired && <span className="rx-required">*</span>}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) {
                    setFieldErrors(prev => { const n = { ...prev }; delete n.email; return n })
                  }
                  clearErrors()
                }}
                onBlur={(e) => handleFieldBlur('email', e.target.value)}
                className={`rx-form-input ${fieldErrors.email ? 'rx-form-input--error' : ''}`}
                placeholder="patient@example.com"
                required={emailRequired}
              />
              {fieldErrors.email ? (
                <p className="rx-form-error-text">
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {fieldErrors.email}
                </p>
              ) : (
                <p className="rx-form-helper">{emailRequired ? 'Used for appointment reminders, reports, and portal login' : 'Optional — used for appointment reminders, reports, and portal login'}</p>
              )}
            </div>
          )}

          {/* Alternate Phone */}
          {fieldConfig?.alternatePhone !== false && (
            <div className="rx-form-field mt-4">
              <label className="rx-form-label">Alternate Phone Number</label>
              <input
                type="tel"
                value={alternatePhone}
                onChange={(e) => { setAlternatePhone(e.target.value); clearErrors() }}
                className="rx-form-input"
                placeholder="Landline or family member number"
              />
            </div>
          )}

          {/* Address */}
          {fieldConfig?.address !== false && (
            <div className="rx-form-field mt-4">
              <label className="rx-form-label">Residential Address</label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => { setAddress(e.target.value); clearErrors() }}
                className="rx-form-input"
                placeholder="House/flat no., street, landmark..."
              />
            </div>
          )}

          {/* City, State, Pincode */}
          {fieldConfig?.cityStatePincode !== false && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
              <div className="rx-form-field">
                <label className="rx-form-label">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="e.g. Mumbai"
                />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => { setState(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="e.g. Maharashtra"
                />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">PIN Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => { setPincode(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="e.g. 400001"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          Section 3 — Emergency & Additional Details
          ══════════════════════════════════════ */}
      {(fieldConfig?.emergencyContact !== false ||
        fieldConfig?.maritalStatus !== false ||
        fieldConfig?.occupation !== false ||
        fieldConfig?.insurance !== false) && (
        <div className="rx-form-section">
          <div className="rx-form-section-header">
            <div className="rx-form-section-icon">
              <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="rx-form-section-title">Emergency & Additional Info</p>
              <p className="rx-form-section-desc">Emergency contact, occupation, and insurance</p>
            </div>
          </div>

          {/* Emergency Contact */}
          {fieldConfig?.emergencyContact !== false && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rx-form-field">
                <label className="rx-form-label">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => { setEmergencyContactName(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="e.g. Spouse / Parent name"
                />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => { setEmergencyContactPhone(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="Phone number"
                />
              </div>
            </div>
          )}

          {/* Marital Status + Occupation */}
          {(fieldConfig?.maritalStatus !== false || fieldConfig?.occupation !== false) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
              {fieldConfig?.maritalStatus !== false && (
                <div className="rx-form-field">
                  <label className="rx-form-label">Marital Status</label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => { setMaritalStatus(e.target.value); clearErrors() }}
                    className="rx-form-input"
                  >
                    <option value="">Select marital status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              )}
              {fieldConfig?.occupation !== false && (
                <div className="rx-form-field">
                  <label className="rx-form-label">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => { setOccupation(e.target.value); clearErrors() }}
                    className="rx-form-input"
                    placeholder="e.g. Engineer, Business"
                  />
                </div>
              )}
            </div>
          )}

          {/* Insurance Provider + Policy Number */}
          {fieldConfig?.insurance !== false && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
              <div className="rx-form-field">
                <label className="rx-form-label">Insurance Provider</label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => { setInsuranceProvider(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="e.g. Star Health, HDFC ERGO"
                />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Insurance Policy Number</label>
                <input
                  type="text"
                  value={insurancePolicyNumber}
                  onChange={(e) => { setInsurancePolicyNumber(e.target.value); clearErrors() }}
                  className="rx-form-input"
                  placeholder="Policy ID / Member No."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          Section 4 — Documents Upload (ID / Medical)
          ══════════════════════════════════════ */}
      {fieldConfig?.documents !== false && (
        <div className="rx-form-section">
          <div className="rx-form-section-header">
            <div className="rx-form-section-icon">
              <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="rx-form-section-title">Documents Upload</p>
              <p className="rx-form-section-desc">Attach ID proof or prior medical records (Optional)</p>
            </div>
          </div>

          <div className="rx-form-field">
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => {
                const files = e.target.files
                if (files && files.length > 0) {
                  const fileArray = Array.from(files)
                  setSelectedFiles(prev => [...prev, ...fileArray])
                  setDocumentNames(prev => [...prev, ...fileArray.map(f => f.name)])
                }
              }}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer rounded-xl border border-slate-200 bg-white p-2"
            />
            {documentNames.length > 0 && (
              <ul className="space-y-1.5 mt-3">
                {documentNames.map((name, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <span className="truncate max-w-[300px]">📄 {name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
                        setDocumentNames(prev => prev.filter((_, i) => i !== idx))
                      }}
                      className="text-slate-400 hover:text-red-500 font-bold ml-2"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          Section 5 — Account & Access Settings
          ══════════════════════════════════════ */}
      {(!receptionistMode && (!isEditMode || showStatusField)) && (
        <div className="rx-form-section">
          <div className="rx-form-section-header">
            <div className="rx-form-section-icon">
              <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="rx-form-section-title">Account & Access</p>
              <p className="rx-form-section-desc">Portal login credentials and account status</p>
            </div>
          </div>

          {!isEditMode && !receptionistMode && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rx-form-field">
                  <label className="rx-form-label">
                    Password <span className="rx-required">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) {
                        setFieldErrors(prev => { const n = { ...prev }; delete n.password; return n })
                      }
                      clearErrors()
                    }}
                    onBlur={(e) => handleFieldBlur('password', e.target.value)}
                    className={`rx-form-input ${fieldErrors.password ? 'rx-form-input--error' : ''}`}
                    placeholder="Set password"
                    required
                  />
                  {fieldErrors.password ? (
                    <p className="rx-form-error-text">
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {fieldErrors.password}
                    </p>
                  ) : (
                    <PasswordRequirements password={password} />
                  )}
                </div>
                <div className="rx-form-field">
                  <label className="rx-form-label">
                    Confirm Password <span className="rx-required">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors(prev => { const n = { ...prev }; delete n.confirmPassword; return n })
                      }
                      clearErrors()
                    }}
                    onBlur={(e) => handleFieldBlur('confirmPassword', e.target.value)}
                    className={`rx-form-input ${fieldErrors.confirmPassword ? 'rx-form-input--error' : ''}`}
                    placeholder="Re-enter password"
                    required
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="rx-form-error-text">
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
          )}

          {showStatusField && !receptionistMode && (
            <div className="rx-form-field mt-4">
              <label className="rx-form-label">Account Status</label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                    className="w-4 h-4 text-cyan-600 focus:ring-cyan-500 border-slate-300"
                  />
                  <span>Active</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={status === 'inactive'}
                    onChange={() => setStatus('inactive')}
                    className="w-4 h-4 text-slate-400 focus:ring-slate-400 border-slate-300"
                  />
                  <span>Inactive</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          Form Actions Footer
          ══════════════════════════════════════ */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 mt-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <Button
          type="submit"
          disabled={loading || isSubmitting}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50"
        >
          {loading || isSubmitting ? 'Saving...' : submitLabel ?? (isEditMode ? 'Update Patient' : 'Register Patient')}
        </Button>
      </div>
    </form>
  )
}
