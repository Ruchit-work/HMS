'use client'
import { fetchBranches } from "@/services/BranchService"

import { useEffect, useMemo, useState } from 'react'
import PasswordRequirements, { isPasswordValid } from '@/features/forms/PasswordComponents'
import { qualifications, specializationCategories, qualificationSpecializationMap } from '@/constants/signup'
import { VisitingHours } from '@/types/patient'
import { DEFAULT_VISITING_HOURS } from '@/shared/utils/timeSlots'
import VisitingHoursEditor from '@/features/doctor/schedule/VisitingHoursEditor'
import { Branch } from '@/types/branch'
import { useMultiHospital } from '@/providers/MultiHospitalProvider'
import { Button } from '@/shared/components'
import { FormSection, FormErrorBanner, FormActions, FormField } from '@/shared/components'

export interface DoctorProfileFormValues {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  gender: string
  specialization: string
  qualification: string
  experience: string
  consultationFee: number
  status: 'active' | 'inactive' | 'pending'
  password: string
  branchIds?: string[]
  visitingHours?: VisitingHours
  branchTimings?: { [branchId: string]: VisitingHours }
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
  const [phoneNumber, setPhoneNumber] = useState(initialValues?.phoneNumber ?? '')
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
  
  // Branch and visiting hours state
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(initialValues?.branchIds || [])
  const [visitingHours, setVisitingHours] = useState<VisitingHours>(
    initialValues?.visitingHours || DEFAULT_VISITING_HOURS
  )
  const [branchTimings, setBranchTimings] = useState<{ [branchId: string]: VisitingHours }>(
    initialValues?.branchTimings || {}
  )
  const [showBranchTimings, setShowBranchTimings] = useState<{ [branchId: string]: boolean }>({})


  const { activeHospitalId } = useMultiHospital()

  // Fetch branches on mount
  useEffect(() => {
    const loadBranches = async () => {
      if (!activeHospitalId) return
      try {
        const result = await fetchBranches(activeHospitalId)
        if (result.success) {
          setBranches(result.branches)
        }
      } catch {
      }
    }
    loadBranches()
  }, [activeHospitalId])

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
  }, [qualification, specialization, specializationCategory])

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
    const trimmedPhone = phoneNumber.trim()

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

    if (!trimmedPhone) {
      return setFormError('Please provide a phone number')
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
      phoneNumber: trimmedPhone,
      gender,
      specialization: finalSpecializationLabel,
      qualification: finalQualificationLabel,
      experience: experience.trim(),
      consultationFee: Math.round(feeNumber),
      status: showStatusField ? status : mode === 'admin' ? 'active' : 'pending',
      password,
      branchIds: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
      visitingHours: visitingHours,
      branchTimings: Object.keys(branchTimings).length > 0 ? branchTimings : undefined,
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
        <label className="rx-form-label">Specialization <span className="rx-required">*</span></label>

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
            <p className="rx-form-helper mb-2">Step 1: Select your medical field</p>
            <div className="relative">
              <button
                data-dropdown-toggle="specialization"
                onClick={() => {
                  clearErrors()
                  setShowSpecializationDropdown((prev) => !prev)
                  setShowQualificationDropdown(false)
                }}
                className="rx-form-input flex items-center justify-between text-left"
                type="button"
              >
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
              <p className="rx-form-helper !mt-0 font-medium">Step 2: Choose your specialization</p>
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
              <p className="rx-form-helper !mt-0 font-medium">Step 2: Enter your specialization</p>
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
              <input
                type="text"
                value={customSpecialization}
                onChange={(e) => setCustomSpecialization(e.target.value)}
                className="rx-form-input"
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
      <label className="rx-form-label">Qualification <span className="rx-required">*</span></label>
      <div className="relative">
        <button
          data-dropdown-toggle="qualification"
          onClick={() => {
            clearErrors()
            setShowQualificationDropdown((prev) => !prev)
            setShowSpecializationDropdown(false)
          }}
          className="rx-form-input flex items-center justify-between text-left"
          type="button"
        >
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
          <input
            type="text"
            value={customQualification}
            onChange={(e) => setCustomQualification(e.target.value)}
            className="rx-form-input"
            placeholder="Enter your qualification"
            required
          />
        </div>
      )}
    </div>
  )

  return (
    <form className="rx-form" onSubmit={handleSubmit}>
      {(formError || externalError) && (
        <FormErrorBanner message={formError ?? externalError ?? ''} onDismiss={clearErrors} />
      )}

      <FormSection
        title="Personal Information"
        description="Basic identity and contact details for the doctor"
        icon={
          <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="First Name" required>
            <input
              type="text"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); clearErrors() }}
              className="rx-form-input"
              placeholder="John"
              required
            />
          </FormField>
          <FormField label="Last Name" required>
            <input
              type="text"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); clearErrors() }}
              className="rx-form-input"
              placeholder="Smith"
              required
            />
          </FormField>
        </div>

        <FormField label="Email Address" required>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearErrors() }}
            className="rx-form-input"
            placeholder="doctor@hospital.com"
            required
          />
        </FormField>

        <FormField label="Phone Number" required hint="Include country code for OTP (e.g., +91 9876543210)">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => { setPhoneNumber(e.target.value); clearErrors() }}
            className="rx-form-input"
            placeholder="+91 98765 43210"
            required
          />
        </FormField>

        <FormField label="Gender">
          <div className="grid grid-cols-3 gap-2">
            {[{ label: 'Male' }, { label: 'Female' }, { label: 'Other' }].map((option) => (
              <label
                key={option.label}
                className={`rx-form-tile ${gender === option.label ? 'rx-form-tile--active' : ''}`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={option.label}
                  checked={gender === option.label}
                  onChange={(e) => { setGender(e.target.value); clearErrors() }}
                  className="sr-only"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </FormField>
      </FormSection>

      <FormSection
        title="Professional Details"
        description="Specialization, credentials, experience, and fees"
        icon={
          <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      >
        {renderQualificationStep()}
        {renderSpecializationStep()}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Experience" required>
            <input
              type="text"
              value={experience}
              onChange={(e) => { setExperience(e.target.value); clearErrors() }}
              className="rx-form-input"
              placeholder="5 years"
              required
            />
          </FormField>
          <FormField label="Consultation Fee (₹)" required hint="Per consultation">
            <input
              type="number"
              value={consultationFee}
              onChange={(e) => { setConsultationFee(e.target.value); clearErrors() }}
              className="rx-form-input"
              placeholder="500"
              min="0"
              step="50"
              required
            />
          </FormField>
        </div>

        {showStatusField && (
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as DoctorProfileFormValues['status'])
                clearErrors()
              }}
              className="rx-form-select"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </FormField>
        )}
      </FormSection>

      <FormSection
        title="Branches and Schedule"
        description="Assign branches and set visiting hours"
        icon={
          <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      >
        {branches.length > 0 && (
          <FormField label="Branches" hint="Select branches where this doctor works">
            <div className="space-y-2">
              {branches.map((branch) => {
                const isSelected = selectedBranchIds.includes(branch.id)
                return (
                  <label
                    key={branch.id}
                    className={`rx-form-choice ${isSelected ? 'rx-form-choice--active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBranchIds([...selectedBranchIds, branch.id])
                          if (!branchTimings[branch.id]) {
                            setBranchTimings({
                              ...branchTimings,
                              [branch.id]: DEFAULT_VISITING_HOURS,
                            })
                          }
                        } else {
                          setSelectedBranchIds(selectedBranchIds.filter((id) => id !== branch.id))
                          const updated = { ...branchTimings }
                          delete updated[branch.id]
                          setBranchTimings(updated)
                          setShowBranchTimings({ ...showBranchTimings, [branch.id]: false })
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">{branch.name}</div>
                      <div className="text-xs text-slate-500">{branch.location}</div>
                    </div>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowBranchTimings({
                            ...showBranchTimings,
                            [branch.id]: !showBranchTimings[branch.id],
                          })
                        }}
                        className="shrink-0 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100"
                      >
                        {showBranchTimings[branch.id] ? 'Hide' : 'Set'} Timings
                      </button>
                    )}
                  </label>
                )
              })}
            </div>

            {selectedBranchIds.map((branchId) => {
              const branch = branches.find((b) => b.id === branchId)
              if (!branch || !showBranchTimings[branchId]) return null

              return (
                <div key={branchId} className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-700">
                    Visiting Hours for {branch.name}
                  </h4>
                  <VisitingHoursEditor
                    value={branchTimings[branchId] || DEFAULT_VISITING_HOURS}
                    onChange={(hours) => {
                      setBranchTimings({
                        ...branchTimings,
                        [branchId]: hours,
                      })
                    }}
                  />
                </div>
              )
            })}
          </FormField>
        )}

        <FormField label="General Visiting Hours" hint="Used as fallback if branch timings are not set">
          <VisitingHoursEditor value={visitingHours} onChange={setVisitingHours} />
        </FormField>
      </FormSection>

      <FormSection
        title="Account Security"
        description="Login credentials for the doctor portal"
        icon={
          <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Password" required>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearErrors() }}
              className="rx-form-input"
              placeholder="Enter password"
              minLength={6}
              required
            />
            {requirePasswordStrength && <PasswordRequirements password={password} />}
          </FormField>

          <FormField label="Confirm Password" required>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearErrors() }}
              className={`rx-form-input ${
                confirmPassword && password !== confirmPassword
                  ? 'rx-form-input--error'
                  : confirmPassword && password === confirmPassword
                    ? 'rx-form-input--success'
                    : ''
              }`}
              placeholder="Re-enter password"
              minLength={6}
              required
            />
            {confirmPassword && (
              <p className={`text-xs font-semibold ${password === confirmPassword ? 'text-emerald-600' : 'text-red-600'}`}>
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </FormField>
        </div>
      </FormSection>

      <FormActions>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" loading={loading} loadingText={submitLabel ?? 'Saving…'}>
          {submitLabel ?? (mode === 'public' ? 'Create Doctor Account' : 'Save Doctor')}
        </Button>
      </FormActions>
    </form>
  )
}
