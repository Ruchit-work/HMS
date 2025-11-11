'use client'

import { useEffect, useMemo, useState } from 'react'
import PasswordRequirements, { isPasswordValid } from '@/components/forms/PasswordRequirements'
import { qualifications, specializationCategories, qualificationSpecializationMap } from '@/constants/signup'

export interface DoctorProfileFormValues {
  firstName: string
  lastName: string
  email: string
  gender: string
  specialization: string
  qualification: string
  experience: string
  consultationFee: number
  status: 'active' | 'inactive' | 'pending'
  password: string
}

interface DoctorProfileFormProps {
  mode: 'public' | 'admin'
  initialValues?: Partial<Omit<DoctorProfileFormValues, 'status'> & { status?: DoctorProfileFormValues['status'] }>
  loading?: boolean
  submitLabel?: string
  onSubmit: (values: DoctorProfileFormValues) => Promise<void> | void
  onCancel?: () => void
  showStatusField?: boolean
  requirePasswordStrength?: boolean
  externalError?: string | null
  onErrorClear?: () => void
}

type SpecializationCategoryId = string

export default function DoctorProfileForm({
  mode,
  initialValues,
  loading,
  submitLabel,
  onSubmit,
  onCancel,
  showStatusField = mode === 'admin',
  requirePasswordStrength = true,
  externalError,
  onErrorClear,
}: DoctorProfileFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '')
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [gender, setGender] = useState(initialValues?.gender ?? '')
  const [experience, setExperience] = useState(initialValues?.experience ?? '')
  const [consultationFee, setConsultationFee] = useState(
    initialValues?.consultationFee !== undefined ? String(initialValues.consultationFee) : ''
  )
  const [status, setStatus] = useState<DoctorProfileFormValues['status']>(
    showStatusField ? initialValues?.status ?? 'active' : mode === 'admin' ? 'active' : 'pending'
  )
  const [password, setPassword] = useState(initialValues?.password ?? '')
  const [confirmPassword, setConfirmPassword] = useState(initialValues?.password ?? '')

  const [specializationCategory, setSpecializationCategory] = useState<SpecializationCategoryId>(
    () => {
      if (!initialValues?.specialization) return ''
      const matchedCategory = specializationCategories.find((cat) =>
        cat.specializations.includes(initialValues.specialization!)
      )
      return matchedCategory ? matchedCategory.id : initialValues.specialization === '' ? '' : 'other'
    }
  )
  const [specialization, setSpecialization] = useState(
    initialValues?.specialization && specializationCategories.some((cat) => cat.specializations.includes(initialValues.specialization!))
      ? initialValues.specialization
      : ''
  )
  const [customSpecialization, setCustomSpecialization] = useState(
    specializationCategory === 'other' ? initialValues?.specialization ?? '' : ''
  )

  const [qualification, setQualification] = useState(() => {
    if (!initialValues?.qualification) return ''
    return qualifications.includes(initialValues.qualification) ? initialValues.qualification : 'Other'
  })
  const [customQualification, setCustomQualification] = useState(
    qualification === 'Other' ? initialValues?.qualification ?? '' : ''
  )

  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false)
  const [showQualificationDropdown, setShowQualificationDropdown] = useState(false)

  const allSpecializations = useMemo(
    () => specializationCategories.flatMap((cat) => cat.specializations),
    []
  )

  const specializationQualificationMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    Object.entries(qualificationSpecializationMap).forEach(([qual, specs]) => {
      specs.forEach((spec) => {
        if (!map.has(spec)) {
          map.set(spec, new Set())
        }
        map.get(spec)!.add(qual)
      })
    })
    return map
  }, [])

  const allowedSpecializationSet = useMemo(() => {
    if (!qualification || qualification === 'Other') {
      return null
    }
    const allowed = qualificationSpecializationMap[qualification]
    if (!allowed || allowed.length === 0) {
      return null
    }
    return new Set(allowed)
  }, [qualification])

  const availableSpecializationCategories = useMemo(() => {
    if (!allowedSpecializationSet) {
      return specializationCategories
    }
    return specializationCategories
      .map((cat) => {
        if (cat.id === 'other') {
          return cat
        }
        const filtered = cat.specializations.filter((spec) => allowedSpecializationSet.has(spec))
        return { ...cat, specializations: filtered }
      })
      .filter((cat) => cat.id === 'other' || cat.specializations.length > 0)
  }, [allowedSpecializationSet])

  const hasSpecializationOptions = useMemo(
    () => availableSpecializationCategories.some((cat) => cat.id !== 'other' && cat.specializations.length > 0),
    [availableSpecializationCategories]
  )

  const availableQualifications = useMemo(() => {
    if (!specialization || specializationCategory === 'other') {
      return qualifications
    }
    const allowed = specializationQualificationMap.get(specialization)
    if (!allowed || allowed.size === 0) {
      return qualifications
    }
    const allowedArray = qualifications.filter((qual) => allowed.has(qual))
    const merged = Array.from(new Set([...allowedArray, 'Other']))
    return merged.filter((qual) => qualifications.includes(qual))
  }, [specialization, specializationCategory, specializationQualificationMap])

  useEffect(() => {
    setFormError(null)
  }, [externalError])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (
        !target.closest('[data-dropdown-toggle="specialization"]') &&
        !target.closest('[data-dropdown-menu="specialization"]')
      ) {
        setShowSpecializationDropdown(false)
      }
      if (
        !target.closest('[data-dropdown-toggle="qualification"]') &&
        !target.closest('[data-dropdown-menu="qualification"]')
      ) {
        setShowQualificationDropdown(false)
      }
    }

    if (showSpecializationDropdown || showQualificationDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSpecializationDropdown, showQualificationDropdown])

  useEffect(() => {
    if (!qualification || qualification === 'Other') return
    const allowed = qualificationSpecializationMap[qualification]
    if (!allowed || allowed.length === 0) return
    if (specializationCategory !== 'other' && specialization && !allowed.includes(specialization)) {
      setSpecialization('')
      setSpecializationCategory('')
      setCustomSpecialization('')
    }
    if (specializationCategory && specializationCategory !== 'other') {
      const category = specializationCategories.find((cat) => cat.id === specializationCategory)
      const hasAny = category?.specializations.some((spec) => allowed.includes(spec))
      if (!hasAny) {
        setSpecializationCategory('')
        setSpecialization('')
        setCustomSpecialization('')
      }
    }
  }, [qualification, specialization, specializationCategory, specializationCategories])

  useEffect(() => {
    if (!specialization || specializationCategory === 'other') return
    const allowed = specializationQualificationMap.get(specialization)
    if (!allowed || allowed.size === 0) return
    if (qualification && qualification !== 'Other' && !allowed.has(qualification)) {
      setQualification('')
      setCustomQualification('')
    }
  }, [specialization, specializationCategory, qualification, specializationQualificationMap])

  const finalSpecializationLabel = useMemo(() => {
    if (specializationCategory === 'other') {
      return customSpecialization.trim()
    }
    return specialization.trim()
  }, [specializationCategory, specialization, customSpecialization])

  const finalQualificationLabel = useMemo(() => {
    if (qualification === 'Other') {
      return customQualification.trim()
    }
    return qualification.trim()
  }, [qualification, customQualification])

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

    if (!finalSpecializationLabel) {
      return setFormError('Please select a specialization')
    }

    if (!finalQualificationLabel) {
      return setFormError('Please select a qualification')
    }

    if (!experience.trim()) {
      return setFormError('Please enter experience')
    }

    if (!consultationFee.trim()) {
      return setFormError('Please enter consultation fee')
    }

    const feeNumber = Number(consultationFee)
    if (Number.isNaN(feeNumber) || feeNumber < 0) {
      return setFormError('Consultation fee must be a positive number')
    }

    if (!password) {
      return setFormError('Please provide a password')
    }

    if (requirePasswordStrength && !isPasswordValid(password)) {
      return setFormError('Password does not meet requirements')
    }

    if (password !== confirmPassword) {
      return setFormError('Passwords do not match')
    }

    const payload: DoctorProfileFormValues = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: trimmedEmail,
      gender,
      specialization: finalSpecializationLabel,
      qualification: finalQualificationLabel,
      experience: experience.trim(),
      consultationFee: Math.round(feeNumber),
      status: showStatusField ? status : mode === 'admin' ? 'active' : 'pending',
      password,
    }

    try {
      await onSubmit(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong when saving the doctor profile.'
      setFormError(message)
    }
  }

  const renderSpecializationStep = () => {
    return (
      <div className="mb-4">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization *</label>

        {specializationCategory !== 'other' && finalSpecializationLabel && (
          <div className="bg-teal-50 border-2 border-teal-300 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span className="text-sm font-semibold text-teal-800">{finalSpecializationLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSpecialization('')
                  setSpecializationCategory('')
                }}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {!finalSpecializationLabel && (
          <div>
            <p className="text-xs text-slate-600 mb-2">Step 1: Select your medical field</p>
            <div className="relative">
              <button
                data-dropdown-toggle="specialization"
                onClick={() => {
                  clearErrors()
                  setShowSpecializationDropdown((prev) => !prev)
                  setShowQualificationDropdown(false)
                }}
                className="w-full pl-12 pr-10 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 text-left flex items-center justify-between hover:border-slate-400 transition-all duration-200"
                type="button"
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🩺</span>
                <span className="text-slate-700">
                  {specializationCategory
                    ? specializationCategories.find((cat) => cat.id === specializationCategory)?.name ?? 'Medical Field'
                    : 'Select Medical Field'}
                </span>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    showSpecializationDropdown ? 'rotate-180' : ''
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
                data-dropdown-menu="specialization"
                className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${
                  showSpecializationDropdown ? 'block' : 'hidden'
                }`}
              >
                <ul className="py-2 text-sm text-gray-700 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setSpecializationCategory('')
                        setSpecialization('')
                        setCustomSpecialization('')
                        setShowSpecializationDropdown(false)
                      }}
                      className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                    >
                      Select Medical Field
                    </button>
                  </li>
                  {availableSpecializationCategories
                    .filter((cat) => cat.id !== 'other')
                    .map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSpecializationCategory(cat.id)
                          setSpecialization('')
                          setCustomSpecialization('')
                          setShowSpecializationDropdown(false)
                        }}
                        className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                      >
                        {cat.name}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setSpecializationCategory('other')
                        setSpecialization('')
                        setShowSpecializationDropdown(false)
                      }}
                      className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                    >
                      Other / Custom
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            {allowedSpecializationSet && !hasSpecializationOptions && (
              <p className="mt-2 text-xs text-amber-600">
                No predefined specializations match this qualification. Choose a different qualification or use the
                custom option.
              </p>
            )}
          </div>
        )}

        {specializationCategory && specializationCategory !== 'other' && !specialization && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-600 font-medium">Step 2: Choose your specialization</p>
              <button
                type="button"
                onClick={() => setSpecializationCategory('')}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                ← Change field
              </button>
            </div>
            {!hasSpecializationOptions && allowedSpecializationSet && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                No specializations match this qualification. Choose a different qualification or use a custom specialization.
              </div>
            )}
            <div className="border-2 border-teal-200 bg-teal-50/30 rounded-lg p-3">
              <div className="grid grid-cols-1 gap-2">
                {availableSpecializationCategories
                  .find((cat) => cat.id === specializationCategory)
                  ?.specializations.map((spec) => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setSpecialization(spec)}
                      className="text-left px-4 py-3 bg-white border-2 border-slate-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-all text-sm font-medium text-slate-800 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                        {spec}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {specializationCategory === 'other' && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-600 font-medium">Step 2: Enter your specialization</p>
              <button
                type="button"
                onClick={() => {
                  setSpecializationCategory('')
                  setCustomSpecialization('')
                }}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                ← Change field
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">✏️</span>
              <input
                type="text"
                value={customSpecialization}
                onChange={(e) => setCustomSpecialization(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                placeholder="Enter your specialization (e.g., Sports Medicine)"
                required
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderQualificationStep = () => (
    <div className="mb-4">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qualification *</label>
      <div className="relative">
        <button
          data-dropdown-toggle="qualification"
          onClick={() => {
            clearErrors()
            setShowQualificationDropdown((prev) => !prev)
            setShowSpecializationDropdown(false)
          }}
          className="w-full pl-12 pr-10 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 text-left flex items-center justify-between hover:border-slate-400 transition-all duration-200"
          type="button"
        >
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🎓</span>
          <span className="text-slate-700">{qualification || 'Select Qualification'}</span>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              showQualificationDropdown ? 'rotate-180' : ''
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
          data-dropdown-menu="qualification"
          className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${
            showQualificationDropdown ? 'block' : 'hidden'
          }`}
        >
          <ul className="py-2 text-sm text-gray-700 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <li>
              <button
                type="button"
                onClick={() => {
                  setQualification('')
                  setCustomQualification('')
                  setShowQualificationDropdown(false)
                }}
                className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
              >
                Select Qualification
              </button>
            </li>
            {availableQualifications.map((qual) => (
              <li key={qual}>
                <button
                  type="button"
                  onClick={() => {
                    setQualification(qual)
                    if (qual !== 'Other') {
                      setCustomQualification('')
                    }
                    setShowQualificationDropdown(false)
                  }}
                  className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                >
                  {qual}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {qualification === 'Other' && (
        <div className="relative mt-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">✏️</span>
          <input
            type="text"
            value={customQualification}
            onChange={(e) => setCustomQualification(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
            placeholder="Enter your qualification"
            required
          />
        </div>
      )}
    </div>
  )

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
            placeholder="doctor@hospital.com"
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

      {renderSpecializationStep()}
      {renderQualificationStep()}

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Experience <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">⏱️</span>
            <input
              type="text"
              value={experience}
              onChange={(e) => {
                setExperience(e.target.value)
                clearErrors()
              }}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
              placeholder="5 years"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Consultation Fee (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💰</span>
            <input
              type="number"
              value={consultationFee}
              onChange={(e) => {
                setConsultationFee(e.target.value)
                clearErrors()
              }}
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
              placeholder="500"
              min="0"
              step="50"
              required
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Per consultation</p>
        </div>
      </div>

      {showStatusField && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as DoctorProfileFormValues['status'])
              clearErrors()
            }}
            className="w-full px-3 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 transition-all duration-200"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
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
        {requirePasswordStrength && <PasswordRequirements password={password} />}
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
            className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none transition-all duration-200"
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
          className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg font-semibold shadow-sm hover:shadow-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
              <span>{submitLabel ?? (mode === 'public' ? 'Create Doctor Account' : 'Save Doctor')}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

