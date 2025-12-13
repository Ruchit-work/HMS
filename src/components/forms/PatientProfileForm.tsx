'use client'

import { useEffect, useMemo, useState } from 'react'
import PasswordRequirements, { isPasswordValid } from '@/components/forms/PasswordComponents'
import { bloodGroups } from '@/constants/signup'

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
}

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
}: PatientProfileFormProps) {
  const [formError, setFormError] = useState<string | null>(null)

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

  const [password, setPassword] = useState(initialValues?.password ?? '')
  const [confirmPassword, setConfirmPassword] = useState(initialValues?.password ?? '')
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
    onErrorClear?.()
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

    if (!isPasswordValid(password)) {
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
    <form className="space-y-5" onSubmit={handleSubmit}>
      {(formError || externalError) && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-bold">!</span>
              </div>
              <p className="text-sm text-red-800 font-semibold leading-relaxed">{formError ?? externalError}</p>
            </div>
            <button
              type="button"
              onClick={clearErrors}
              className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            First Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                clearErrors()
              }}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
              placeholder="John"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Last Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                clearErrors()
              }}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
              placeholder="Smith"
              required
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Email Address <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearErrors()
            }}
            className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
            placeholder="patient@email.com"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Male', icon: '👨' },
            { label: 'Female', icon: '👩' },
            { label: 'Other', icon: '⚧️' },
          ].map((option) => (
            <label
              key={option.label}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${
                gender === option.label
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-300 hover:border-cyan-400 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={option.label}
                checked={gender === option.label}
                onChange={(e) => {
                  setGender(e.target.value)
                  clearErrors()
                }}
                className="sr-only"
              />
              <span className="text-lg">{option.icon}</span>
              <span className="text-sm font-semibold">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Phone {mode === 'public' ? <span className="text-red-500">*</span> : null}
          </label>
          <div className="flex gap-2">
            {enableCountryCode && (
              <input
                type="text"
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value)
                  clearErrors()
                }}
                className="w-24 px-3 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                placeholder="+91"
              />
            )}
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                clearErrors()
              }}
              className="w-full px-3 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
              placeholder={enableCountryCode ? '9876543210' : 'Phone number'}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date of Birth {mode === 'public' ? <span className="text-red-500">*</span> : null}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📅</span>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value)
                clearErrors()
              }}
              max={today}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 transition-all duration-200"
              required={mode === 'public'}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Blood Group</label>
        <div className="relative">
          <button
            data-dropdown-toggle="blood-group"
            onClick={() => {
              clearErrors()
              setShowBloodGroupDropdown((prev) => !prev)
            }}
            className="w-full px-4 pr-10 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 text-left flex items-center justify-between hover:border-slate-400 transition-all duration-200"
            type="button"
          >
            <span className="text-slate-700">{bloodGroup || 'Select Blood Group'}</span>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                showBloodGroupDropdown ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 10 6"
            >
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
            </svg>
          </button>

          <div
            data-dropdown-menu="blood-group"
            className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${
              showBloodGroupDropdown ? 'block' : 'hidden'
            }`}
          >
            <ul className="py-2 text-sm text-gray-700 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setBloodGroup('')
                    setShowBloodGroupDropdown(false)
                  }}
                  className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                >
                  Select Blood Group
                </button>
              </li>
              {bloodGroups.map((group) => (
                <li key={group}>
                  <button
                    type="button"
                    onClick={() => {
                      setBloodGroup(group)
                      setShowBloodGroupDropdown(false)
                    }}
                    className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                  >
                    {group}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
        <textarea
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            clearErrors()
          }}
          className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200 resize-none"
          placeholder="123 Main St, City, State, ZIP"
          rows={2}
        />
      </div>

      {showStatusField && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as PatientProfileFormValues['status'])
              clearErrors()
            }}
            className="w-full px-3 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 transition-all duration-200"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearErrors()
            }}
            className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
            placeholder="Enter password"
            minLength={6}
            required
          />
        </div>
        <PasswordRequirements password={password} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              clearErrors()
            }}
            className={`w-full pl-12 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-all duration-200 ${
              confirmPassword && password !== confirmPassword
                ? 'border-red-400 focus:border-red-500'
                : confirmPassword && password === confirmPassword
                ? 'border-emerald-400 focus:border-emerald-500'
                : 'border-slate-300 focus:border-slate-500'
            }`}
            placeholder="Re-enter password"
            minLength={6}
            required
          />
        </div>
        {confirmPassword && (
          <p className={`mt-2 text-xs font-semibold ${password === confirmPassword ? 'text-emerald-600' : 'text-red-600'}`}>
            {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 sm:px-6 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors duration-200 font-medium text-sm sm:text-base"
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold shadow-sm hover:shadow-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{submitLabel ?? 'Saving...'}</span>
            </>
          ) : (
            <>
              <span className="text-lg">🚀</span>
              <span>{submitLabel ?? (mode === 'public' ? 'Create Patient Account' : 'Save Patient')}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

