'use client'

import { useEffect, useMemo, useState } from 'react'
import PasswordRequirements, { isPasswordValid } from '@/features/forms/PasswordComponents'
import { bloodGroups } from '@/constants/signup'
import { Button } from '@/shared/components'

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
  status: 'active' | 'inactive'
  password: string
}

interface PatientProfileFormProps {
  mode: 'public' | 'admin'
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
}

const RECEPTIONIST_DEFAULT_PASSWORD = '123456'

export default function PatientProfileForm({
  mode,
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
}: PatientProfileFormProps) {
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
  const [status, setStatus] = useState<PatientProfileFormValues['status']>(
    showStatusField ? initialValues?.status ?? 'active' : 'active'
  )

  const [password, setPassword] = useState(initialValues?.password ?? (receptionistMode ? RECEPTIONIST_DEFAULT_PASSWORD : ''))
  const [confirmPassword, setConfirmPassword] = useState(initialValues?.password ?? (receptionistMode ? RECEPTIONIST_DEFAULT_PASSWORD : ''))
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

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
      case 'email':
        if (!value.trim()) return 'Email address is required'
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value.trim())) return 'Please enter a valid email address'
        return null
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
    if (!trimmedEmail) {
      return setFormError('Please enter email address')
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      return setFormError('Please enter a valid email address')
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
      status: showStatusField ? status : 'active',
      password,
    }

    try {
      await onSubmit(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong when saving the patient profile.'
      setFormError(message)
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
            <p className="rx-form-section-desc">Basic identification details for the patient record</p>
          </div>
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
          <p className="rx-form-helper">Select the patient's biological sex for medical records</p>
        </div>

        {/* DOB + Blood Group */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
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
        </div>
      </div>

      {/* ══════════════════════════════════════
          Section 2 — Contact Details
          ══════════════════════════════════════ */}
      <div className="rx-form-section">
        <div className="rx-form-section-header">
          <div className="rx-form-section-icon">
            <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="rx-form-section-title">Contact Details</p>
            <p className="rx-form-section-desc">How the hospital and patient portal reach this patient</p>
          </div>
        </div>

        {/* Email */}
        <div className="rx-form-field">
          <label className="rx-form-label">
            Email Address <span className="rx-required">*</span>
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
            required
          />
          {fieldErrors.email ? (
            <p className="rx-form-error-text">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {fieldErrors.email}
            </p>
          ) : (
            <p className="rx-form-helper">Used for appointment reminders, reports, and portal login</p>
          )}
        </div>

        {/* Phone */}
        <div className="rx-form-field mt-4">
          <label className="rx-form-label">
            Phone Number
            {mode === 'public' && <span className="rx-required">*</span>}
          </label>
          <div className="flex gap-2">
            {enableCountryCode && (
              <input type="text" value={countryCode}
                onChange={(e) => { setCountryCode(e.target.value); clearErrors() }}
                className="rx-form-input w-20 shrink-0"
                placeholder="+91"
              />
            )}
            <input type="tel" value={phone}
              onChange={(e) => { setPhone(e.target.value); clearErrors() }}
              className="rx-form-input flex-1"
              placeholder={enableCountryCode ? '98765 43210' : 'Mobile number'}
            />
          </div>
          <p className="rx-form-helper">For SMS alerts and WhatsApp appointment confirmations</p>
        </div>

        {/* Address */}
        <div className="rx-form-field mt-4">
          <label className="rx-form-label">Home Address</label>
          <textarea
            value={address}
            onChange={(e) => { setAddress(e.target.value); clearErrors() }}
            className="rx-form-textarea"
            placeholder="Street, area, city, state, PIN code"
            rows={2}
          />
          <p className="rx-form-helper">Used for home-care coordination and delivery of reports</p>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Section 3 — Account Settings (admin)
          ══════════════════════════════════════ */}
      {showStatusField && (
        <div className="rx-form-section">
          <div className="rx-form-section-header">
            <div className="rx-form-section-icon">
              <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="rx-form-section-title">Account Settings</p>
              <p className="rx-form-section-desc">Control the patient's access to the portal</p>
            </div>
          </div>
          <div className="rx-form-field">
            <label className="rx-form-label">Account Status</label>
            <select value={status}
              onChange={(e) => { setStatus(e.target.value as PatientProfileFormValues['status']); clearErrors() }}
              className="rx-form-select">
              <option value="active">Active — Patient can log in and book appointments</option>
              <option value="inactive">Inactive — Portal access disabled</option>
            </select>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          Section 4 — Account Security
          ══════════════════════════════════════ */}
      <div className="rx-form-section">
        <div className="rx-form-section-header">
          <div className="rx-form-section-icon">
            <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="rx-form-section-title">Account Security</p>
            <p className="rx-form-section-desc">Login credentials for the patient portal</p>
          </div>
        </div>

        {receptionistMode && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-cyan-800">Default password is pre-filled</p>
              <p className="mt-0.5 text-[11px] text-cyan-700">The patient can change this password after their first login from the patient dashboard.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Password */}
          <div className="rx-form-field">
            <label className="rx-form-label">
              Password <span className="rx-required">*</span>
            </label>
            <input type="password" value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) {
                  setFieldErrors(prev => { const n = { ...prev }; delete n.password; return n })
                }
                clearErrors()
              }}
              onBlur={(e) => handleFieldBlur('password', e.target.value)}
              className={`rx-form-input ${fieldErrors.password ? 'rx-form-input--error' : ''}`}
              placeholder="Enter password"
              minLength={6}
              required
            />
            {fieldErrors.password ? (
              <p className="rx-form-error-text">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {fieldErrors.password}
              </p>
            ) : receptionistMode ? (
              <p className="rx-form-helper">Minimum 6 characters</p>
            ) : null}
            {!receptionistMode && <PasswordRequirements password={password} />}
          </div>

          {/* Confirm Password */}
          <div className="rx-form-field">
            <label className="rx-form-label">
              Confirm Password <span className="rx-required">*</span>
            </label>
            <input type="password" value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (fieldErrors.confirmPassword) {
                  setFieldErrors(prev => { const n = { ...prev }; delete n.confirmPassword; return n })
                }
                clearErrors()
              }}
              onBlur={(e) => handleFieldBlur('confirmPassword', e.target.value)}
              className={`rx-form-input ${
                fieldErrors.confirmPassword || (confirmPassword && password !== confirmPassword)
                  ? 'rx-form-input--error'
                  : confirmPassword && password === confirmPassword
                  ? 'rx-form-input--success'
                  : ''
              }`}
              placeholder="Re-enter password"
              minLength={6}
              required
            />
            {fieldErrors.confirmPassword ? (
              <p className="rx-form-error-text">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {fieldErrors.confirmPassword}
              </p>
            ) : confirmPassword ? (
              <p className={`text-xs font-semibold ${password === confirmPassword ? 'text-emerald-600' : 'text-red-600'}`}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            ) : (
              <p className="rx-form-helper">Must exactly match the password above</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" loading={loading} loadingText={submitLabel ?? 'Saving…'}>
          {submitLabel ?? (mode === 'public' ? 'Create Patient Account' : 'Save Patient')}
        </Button>
      </div>
    </form>
  )
}

