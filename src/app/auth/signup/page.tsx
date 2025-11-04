"use client"
import { useState, useEffect, Suspense } from "react"
import { auth, db } from "@/firebase/config"
import { createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { useRouter, useSearchParams } from "next/navigation"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import PasswordRequirements, { isPasswordValid } from "@/components/PasswordRequirements"
import Notification from "@/components/Notification"
import { sendOTP, verifyOTP } from "@/utils/twilioOTP"

function SignUpContent() {
  const searchParams = useSearchParams()
  const role = searchParams.get("role") as "patient" | "doctor" | null
  const router = useRouter()
  // Common fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState("")
  // Patient-only fields
  const [phone, setPhone] = useState("")
  const [countryCode, setCountryCode] = useState("+91")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [address, setAddress] = useState("")
  // Doctor-only fields
  const [specialization, setSpecialization] = useState("")
  const [customSpecialization, setCustomSpecialization] = useState("")
  const [specializationCategory, setSpecializationCategory] = useState("")
  const [qualification, setQualification] = useState("")
  const [customQualification, setCustomQualification] = useState("")
  const [experience, setExperience] = useState("")
  const [consultationFee, setConsultationFee] = useState("")
  // UI state
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false)
  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false)
  const [showQualificationDropdown, setShowQualificationDropdown] = useState(false)
  const [validating, setValidating] = useState(false)
  // OTP state (for patients only)
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOTP, setSendingOTP] = useState(false)
  const [verifyingOTP, setVerifyingOTP] = useState(false)
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [modalError, setModalError] = useState("")
  // Protect route - redirect if already authenticated
  const { loading: checking } = usePublicRoute()


  // Redirect if no role specified or attempting admin signup (disabled)
  useEffect(() => {
    if (!role || (role !== "patient" && role !== "doctor")) {
      router.replace("/")
    }
  }, [role, router])

  // Auto-send OTP when modal opens
  useEffect(() => {
    if (showOTPModal && role === "patient" && !otpSent && !sendingOTP && phone) {
      const sendOTPOnModalOpen = async () => {
        await handleSendOTP(false)
      }
      sendOTPOnModalOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOTPModal])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('[data-dropdown-toggle]') && !target.closest('[id*="Dropdown"]')) {
        setShowBloodGroupDropdown(false)
        setShowSpecializationDropdown(false)
        setShowQualificationDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])



  // Medical specializations organized by category
  const specializationCategories = [
    {
      id: "general",
      name: "General & Primary Care",
      icon: "🩺",
      specializations: ["General Physician", "Family Medicine Specialist"]
    },
    {
      id: "heart",
      name: "Heart & Circulatory System",
      icon: "❤️",
      specializations: ["Cardiologist", "Cardiothoracic Surgeon", "Vascular Surgeon"]
    },
    {
      id: "brain",
      name: "Brain, Nerves & Mental Health",
      icon: "🧠",
      specializations: ["Neurologist", "Neurosurgeon", "Psychiatrist", "Psychologist"]
    },
    {
      id: "lungs",
      name: "Lungs & Respiratory System",
      icon: "🫁",
      specializations: ["Pulmonologist"]
    },
    {
      id: "digestive",
      name: "Digestive System",
      icon: "🍽️",
      specializations: ["Gastroenterologist", "Hepatologist"]
    },
    {
      id: "hormones",
      name: "Hormones & Metabolism",
      icon: "💉",
      specializations: ["Endocrinologist"]
    },
    {
      id: "blood_cancer",
      name: "Blood & Cancer",
      icon: "🩸",
      specializations: ["Hematologist", "Oncologist", "Radiation Oncologist"]
    },
    {
      id: "bones",
      name: "Bones, Muscles & Movement",
      icon: "🦴",
      specializations: ["Orthopedic Surgeon", "Rheumatologist", "Physiotherapist"]
    },
    {
      id: "infections",
      name: "Infections & Immunity",
      icon: "🧬",
      specializations: ["Infectious Disease Specialist", "Immunologist / Allergist"]
    },
    {
      id: "eye_ear",
      name: "Eye, Ear, Nose & Throat",
      icon: "👁️",
      specializations: ["Ophthalmologist", "ENT Specialist (Otorhinolaryngologist)"]
    },
    {
      id: "skin",
      name: "Skin, Hair & Nails",
      icon: "🧴",
      specializations: ["Dermatologist"]
    },
    {
      id: "women_children",
      name: "Women & Children",
      icon: "🤰",
      specializations: ["Gynecologist / Obstetrician (OB/GYN)", "Pediatrician", "Neonatologist"]
    },
    {
      id: "urinary",
      name: "Urinary & Reproductive System",
      icon: "🧍‍♂️",
      specializations: ["Urologist", "Andrologist"]
    },
    {
      id: "dental",
      name: "Dental & Oral",
      icon: "🦷",
      specializations: ["Dentist / Oral Surgeon"]
    },
    {
      id: "advanced",
      name: "Other Advanced Specialties",
      icon: "🧑‍⚕️",
      specializations: ["Nephrologist", "Anesthesiologist", "Pathologist", "Radiologist", "Emergency Medicine Specialist", "Geriatrician"]
    },
    {
      id: "other",
      name: "Other / Custom",
      icon: "✏️",
      specializations: ["Other"]
    }
  ]

  // List of medical qualifications with full names
  const qualifications = [
    // 🩺 Undergraduate (Basic Medical Degrees)
    "MBBS – Bachelor of Medicine, Bachelor of Surgery",
    "BDS – Bachelor of Dental Surgery",
    "BHMS – Bachelor of Homeopathic Medicine & Surgery",
    "BAMS – Bachelor of Ayurvedic Medicine & Surgery",
    "BUMS – Bachelor of Unani Medicine & Surgery",
    "BSMS – Bachelor of Siddha Medicine & Surgery",
    "BNYS – Bachelor of Naturopathy and Yogic Sciences",
    "BVSc & AH – Bachelor of Veterinary Science and Animal Husbandry",

    // 🎓 Postgraduate (Medical Specializations)
    "MD – Doctor of Medicine",
    "MS – Master of Surgery",
    "DNB – Diplomate of National Board",
    "PG Diploma – Post Graduate Diploma in Medicine",
    "MCh – Magister Chirurgiae (Master of Surgery)",
    "DM – Doctorate of Medicine",

    // 🧠 Super-Specialization & Fellowships
    "FNB – Fellowship of National Board",
    "FRCS – Fellowship of the Royal College of Surgeons",
    "MRCP – Membership of the Royal College of Physicians",
    "MRCS – Membership of the Royal College of Surgeons",
    "FRCOG – Fellowship of the Royal College of Obstetricians & Gynecologists",
    "FRCPath – Fellowship of the Royal College of Pathologists",

    // 🧬 Allied & Paramedical
    "BPT – Bachelor of Physiotherapy",
    "MPT – Master of Physiotherapy",
    "BPharm – Bachelor of Pharmacy",
    "MPharm – Master of Pharmacy",
    "BSc Nursing",
    "MSc Nursing",
    "BMLT – Bachelor of Medical Laboratory Technology",
    "MMLT – Master of Medical Laboratory Technology",
    "BSc Optometry",
    "BSc Radiology / Imaging Technology",

    // Other
    "Other"
  ]

  const passwordValid = isPasswordValid(password)

  // Send OTP function (for patients only)
  const handleSendOTP = async (showSuccess = true) => {
    if (role !== "patient") return

    // Validate phone number first
    if (!phone) {
      setError("Please enter your phone number")
      return false
    }

    // Clean phone number and country code
    const cleanedPhone = phone.replace(/\D/g, "")
    const cleanedCountryCode = countryCode.replace(/\D/g, "")
    const totalDigits = cleanedCountryCode + cleanedPhone

    if (totalDigits.length < 7 || totalDigits.length > 15) {
      setError(`Phone number should contain 7-15 digits total (including country code). Current: ${totalDigits.length} digits.`)
      return false
    }

    setError("")
    setSendingOTP(true)

    try {
      const fullPhoneNumber = `${countryCode}${phone}`.replace(/\s+/g, "")
      const result = await sendOTP(fullPhoneNumber)

      if (result.success) {
        setOtpSent(true)
        if (showSuccess) {
          setNotification({
            type: "success",
            message: "OTP sent successfully! Please check your phone."
          })
        }
        return true
      } else {
        const errorMsg = result.error || "Failed to send OTP. Please try again."
        setError(errorMsg)
        setModalError(errorMsg)
        return false
      }
    } catch (error) {
      const errorMsg = "Failed to send OTP. Please try again."
      setError(errorMsg)
      setModalError(errorMsg)
      return false
    } finally {
      setSendingOTP(false)
    }
  }

  // Verify OTP function (for patients only)
  const handleVerifyOTP = async () => {
    if (role !== "patient" || !otp) {
      setError("Please enter the OTP")
      return false
    }

    if (otp.length !== 6) {
      setError("OTP must be 6 digits")
      return false
    }

    setError("")
    setVerifyingOTP(true)

    try {
      const fullPhoneNumber = `${countryCode}${phone}`.replace(/\s+/g, "")
      const result = await verifyOTP(fullPhoneNumber, otp)

      if (result.success) {
        setOtpVerified(true)
        // Create account after OTP verification
        await createAccountAfterOTP()
        return true
      } else {
        const errorMsg = result.error || "Invalid OTP. Please try again."
        const fullError = result.remainingAttempts !== undefined 
          ? `${errorMsg} (${result.remainingAttempts} attempts remaining)`
          : errorMsg
        setError(fullError)
        setModalError(fullError)
        return false
      }
    } catch (error) {
      const errorMsg = "Failed to verify OTP. Please try again."
      setError(errorMsg)
      setModalError(errorMsg)
      return false
    } finally {
      setVerifyingOTP(false)
    }
  }

  // Form submission handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setValidating(true)

    await new Promise(resolve => setTimeout(resolve, 500))//animation delay

    setValidating(false)
    setLoading(true)

    // ============================================
    // STEP 1: VALIDATE ALL FORM FIELDS FIRST
    // ============================================

    // Validate required common fields
    if (!firstName || firstName.trim() === "") {
        setError("Please enter your first name")
        setLoading(false)
        return
    }

    if (!lastName || lastName.trim() === "") {
        setError("Please enter your last name")
        setLoading(false)
        return
    }

    // Validate email format
    if (!email || email.trim() === "") {
        setError("Please enter your email address")
        setLoading(false)
        return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        setError("Please enter a valid email address")
        setLoading(false)
        return
    }

    // Validate password requirements
    if (!passwordValid) {
        setError("Password does not meet all requirements")
        setLoading(false)
        return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
        setError("Passwords do not match")
        setLoading(false)
        return
    }

    // Validate patient-specific fields
    if (role === "patient") {
      if (!phone) {
        setError("Please enter your phone number")
        setLoading(false)
        return
      }

      // Clean phone number and country code (remove non-digits)
      const cleanedPhone = phone.replace(/\D/g, "")
      const cleanedCountryCode = countryCode.replace(/\D/g, "")
      const totalDigits = cleanedCountryCode + cleanedPhone

      // Check if combined phone number (country code + phone) has 7-15 digits
      if (totalDigits.length < 7 || totalDigits.length > 15) {
        setError(`Phone number should contain 7-15 digits total (including country code). Current: ${totalDigits.length} digits.`)
        setLoading(false)
        return
      }

      // Also ensure the phone field itself has at least some digits
      if (cleanedPhone.length === 0) {
        setError("Please enter a valid phone number")
        setLoading(false)
        return
      }

      if (!dateOfBirth) {
        setError("Please enter your date of birth")
        setLoading(false)
        return
      }

      // All validations passed for patient - now open OTP modal
      setOtp("")
      setOtpSent(false)
      setOtpVerified(false)
      setError("")
      setModalError("")
      setShowOTPModal(true)

      setLoading(false)
      return // Stop here, account creation will happen after OTP verification
    }

    // Validate doctor-specific fields
    if (role === "doctor") {
      if (!specialization || specialization.trim() === "") {
        setError("Please select your specialization")
        setLoading(false)
        return
      }

      if (specialization === "Other" && (!customSpecialization || customSpecialization.trim() === "")) {
        setError("Please enter your custom specialization")
        setLoading(false)
        return
      }

      if (!qualification || qualification.trim() === "") {
        setError("Please select your qualification")
        setLoading(false)
        return
      }

      if (qualification === "Other" && (!customQualification || customQualification.trim() === "")) {
        setError("Please enter your custom qualification")
        setLoading(false)
        return
      }

      if (!experience || experience.trim() === "") {
        setError("Please enter your experience")
        setLoading(false)
        return
      }

      if (!consultationFee || consultationFee.trim() === "") {
        setError("Please enter your consultation fee")
        setLoading(false)
        return
      }

      // All validations passed for doctor - proceed to create account
      try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        // Use custom values if "Other" was selected
        const finalSpecialization = specialization === "Other" ? customSpecialization : specialization
        const finalQualification = qualification === "Other" ? customQualification : qualification

        await setDoc(doc(db, "doctors", user.uid), {
          email: email,
          status: "active",
          firstName: firstName,
          lastName: lastName,
          gender: gender,
          specialization: finalSpecialization,
          qualification: finalQualification,
          experience: experience,
          consultationFee: parseInt(consultationFee) || 500,
          createdAt: new Date().toISOString(),
          createdBy: "self"
        })

        // Show success notification
        setNotification({
          type: "success",
          message: " Doctor account created successfully! Redirecting to login..."
        })

        // Sign out and redirect to login page
        await signOut(auth)
        setTimeout(() => {
          router.push("/auth/login?role=doctor")
        }, 3000)
      } catch (err: unknown) {
        const firebaseError = err as { code?: string; message?: string }
        let errorMessage = "Failed to sign up"

        if (firebaseError.code === "auth/email-already-in-use") {
          errorMessage = "This email is already registered. Please use a different email or sign in."
        } else if (firebaseError.code === "auth/invalid-email") {
          errorMessage = "Invalid email address. Please enter a valid email."
        } else if (firebaseError.code === "auth/weak-password") {
          errorMessage = "Password is too weak. Please use a stronger password."
        } else {
          errorMessage = firebaseError.message || "Failed to create account. Please try again."
        }

        setError(errorMessage)
      } finally {
        setLoading(false)
      }
      return
    }

    // This should not be reached, but keeping as fallback
    setLoading(false)
  }

  // Create account after OTP verification (only for patients)
  const createAccountAfterOTP = async () => {
    if (role !== "patient") return // Only for patients
    
    setLoading(true)
    setModalError("") // Clear any previous modal errors

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Save user info to Firestore
      await setDoc(doc(db, "patients", user.uid), {
        email: email,
        status: "active",
        firstName: firstName,
        lastName: lastName,
        phone: `${countryCode}${phone}`,
        phoneCountryCode: countryCode,
        phoneNumber: phone,
        dateOfBirth: dateOfBirth,
        gender: gender,
        bloodGroup: bloodGroup,
        address: address,
        createdAt: new Date().toISOString(),
        createdBy: "self"
      })

      // Show success notification
      setNotification({
        type: "success",
        message: "Patient account created successfully! Redirecting to login..."
      })

      // Close modal
      setShowOTPModal(false)

      // Sign out and redirect to login page
      await signOut(auth)
      setTimeout(() => {
        router.push("/auth/login?role=patient")
      }, 3000)
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string }
      let errorMessage = "Failed to sign up"

      // Handle specific Firebase Auth errors
      if (firebaseError.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please use a different email or sign in."
      } else if (firebaseError.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please enter a valid email."
      } else if (firebaseError.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password."
      } else {
        errorMessage = firebaseError.message || "Failed to create account. Please try again."
      }

      // Show error in modal and also close it so user can see the error on form
      setModalError(errorMessage)
      setError(errorMessage)
      
      // Close modal after a short delay so user can see the error
      setTimeout(() => {
        setShowOTPModal(false)
        setOtp("")
        setOtpSent(false)
        setOtpVerified(false)
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking authentication
  if (checking) {
    return <LoadingSpinner />
  }

  return (
    <>
      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-8 px-4">
        <div className="w-full max-w-2xl animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">H</span>
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-slate-900">HMS</h1>
                <p className="text-xs text-slate-500 font-medium">Hospital Management System</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {role === "doctor" ? "Doctor Registration" : "Patient Registration"}
            </h2>
            <p className="text-slate-600">
              {role === "doctor" ? "Join as a healthcare provider" : "Create your patient account"}
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 mb-6 py-4 border-y border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Secure Registration</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg className="w-4 h-4 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
              </svg>
              <span className="font-medium">Encrypted</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 p-4 mb-6 rounded-xl shadow-lg animate-shake-fade-in">
              <div className="flex items-center justify-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce-in">
                  <span className="text-white text-lg font-bold">!</span>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-sm text-red-800 font-semibold leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => setError("")}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Close error"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl max-h-[80vh] sm:max-h-[75vh] lg:max-h-[70vh] overflow-y-auto">

            <form onSubmit={handleSignUp} className="space-y-5">

              {/* Basic Information (Common) */}
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
                      onChange={(e) => setFirstName(e.target.value)}
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
                      onChange={(e) => setLastName(e.target.value)}
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                    placeholder={role === "doctor" ? "doctor@hospital.com" : "patient@email.com"}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${gender === "Male"
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                      : 'border-slate-300 hover:border-cyan-400 hover:bg-slate-50 text-slate-700'
                    }`}>
                    <input  type="radio"  name="gender"  value="Male" checked={gender === "Male"}
                      onChange={(e) => setGender(e.target.value)}  className="sr-only"   />
                    <span className="text-lg">👨</span>
                    <span className="text-sm font-semibold">Male</span>
                  </label>

                  <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${gender === "Female"
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-slate-300 hover:border-pink-400 hover:bg-slate-50 text-slate-700'
                    }`}>
                    <input  type="radio"  name="gender" value="Female"  checked={gender === "Female"}
                      onChange={(e) => setGender(e.target.value)} className="sr-only"  />
                    <span className="text-lg">👩</span>
                    <span className="text-sm font-semibold">Female</span>
                  </label>

                  <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${gender === "Other"
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50 text-slate-700'
                    }`}>
                    <input type="radio" name="gender" value="Other" checked={gender === "Other"}
                      onChange={(e) => setGender(e.target.value)} className="sr-only"  />
                    <span className="text-lg">⚧️</span>
                    <span className="text-sm font-semibold">Other</span>
                  </label>
                </div>
              </div>

              {/* Patient-specific fields */}
              {role === "patient" && (
                <>
                  {/* Phone and DOB - 2 Column Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="tel" 
                        value={phone}   
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                        placeholder="7359057367"  
                        pattern="[0-9\s-]+" 
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Date of Birth <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📅</span>
                        <input  type="date"   value={dateOfBirth}  onChange={(e) => setDateOfBirth(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 transition-all duration-200"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Blood Group
                    </label>
                    <button id="bloodGroupDropdownButton" data-dropdown-toggle="bloodGroupDropdown"
                      onClick={() => {
                        setShowBloodGroupDropdown(!showBloodGroupDropdown)
                        // Close other dropdowns
                        setShowSpecializationDropdown(false)
                        setShowQualificationDropdown(false)
                      }}
                      className="w-full px-4 pr-10 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 text-left flex items-center justify-between hover:border-slate-400 transition-all duration-200"
                      type="button"
                    >
                      <span className="text-slate-700">{bloodGroup || "Select Blood Group"}</span>
                      <svg className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showBloodGroupDropdown ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    <div
                      id="bloodGroupDropdown"
                      className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${showBloodGroupDropdown ? 'block' : 'hidden'}`}
                    >
                      <ul className="py-2 text-sm text-gray-700 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" aria-labelledby="bloodGroupDropdownButton">
                        <li>
                          <button type="button"
                            onClick={() => {
                              setBloodGroup("")
                              setShowBloodGroupDropdown(false)
                            }}
                            className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                          > Select Blood Group </button>
                        </li>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => (
                          <li key={group}>
                            <button type="button"
                              onClick={() => {
                                setBloodGroup(group)
                                setShowBloodGroupDropdown(false)
                              }}
                              className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                            >{group} </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Address
                    </label>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200 resize-none"
                      placeholder="123 Main St, City, State, ZIP"   rows={3}/>
                  </div>
                </>
              )}

              {/* Doctor-specific fields */}
              {role === "doctor" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Specialization <span className="text-red-500">*</span>
                    </label>

                    {/* Show selected specialization if already chosen */}
                    {specialization && specialization !== "Other" && (
                      <div className="bg-teal-50 border-2 border-teal-300 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✅</span>
                            <span className="text-sm font-semibold text-teal-800">{specialization}</span>
                          </div>
                          <button type="button"
                            onClick={() => {
                              setSpecialization("")
                              setSpecializationCategory("")
                            }}
                            className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                          > Change </button>
                        </div>
                      </div>
                    )}

                    {/* Step 1: Category Dropdown (only if no specialization selected) */}
                    {!specialization && (
                      <div>
                        <p className="text-xs text-slate-600 mb-2">Step 1: Select your medical field</p>
                        <div className="relative">
                          <button
                            id="specializationDropdownButton"
                            data-dropdown-toggle="specializationDropdown"
                            onClick={() => {
                              setShowSpecializationDropdown(!showSpecializationDropdown)
                              // Close other dropdowns
                              setShowBloodGroupDropdown(false)
                              setShowQualificationDropdown(false)
                            }}
                            className="w-full pl-12 pr-10 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 text-left flex items-center justify-between hover:border-slate-400 transition-all duration-200"
                            type="button">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🩺</span>
                            <span className="text-slate-700">
                              {specializationCategory
                                ? specializationCategories.find(cat => cat.id === specializationCategory)?.name || " Medical Field "
                                : "Select Medical Field "
                              }
                            </span>
                            <svg className="w-5 h-5 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                            </svg>
                          </button>

                          {/* Dropdown menu */}
                          <div
                            id="specializationDropdown"
                            className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${showSpecializationDropdown ? 'block' : 'hidden'}`}
                          >
                            <ul className="py-2 text-sm text-gray-700 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" aria-labelledby="specializationDropdownButton">
                              <li>
                                <button type="button"
                                  onClick={() => {
                                    setSpecializationCategory("")
                                    setShowSpecializationDropdown(false)
                                  }}
                                  className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                                > Select Medical Field  </button>
                              </li>
                              {specializationCategories.map((cat) => (
                                <li key={cat.id}>
                                  <button type="button"
                                    onClick={() => {
                                      setSpecializationCategory(cat.id)
                                      setShowSpecializationDropdown(false)
                                    }}
                                    className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                                  >{cat.name} </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Specialization Selection (appears after category selected) */}
                    {!specialization && specializationCategory && specializationCategory !== "other" && (
                      <div className="mt-3 animate-slide-down">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-600 font-medium">Step 2: Choose your specialization</p>
                          <button
                            type="button"
                            onClick={() => setSpecializationCategory("")}
                            className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                          >
                            ← Change field
                          </button>
                        </div>
                        <div className="border-2 border-teal-200 bg-teal-50/30 rounded-lg p-3">
                          <div className="grid grid-cols-1 gap-2">
                            {specializationCategories
                              .find(cat => cat.id === specializationCategory)
                              ?.specializations.map((spec) => (
                                <button
                                  key={spec}
                                  type="button"
                                  onClick={() => setSpecialization(spec)}
                                  className="text-left px-4 py-3 bg-white border-2 border-slate-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-all text-sm font-medium text-slate-800 hover:shadow-md"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-teal-400"></div>
                                    {spec}
                                  </div>
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* If "Other/Custom" category selected, directly show input */}
                    {!specialization && specializationCategory === "other" && (
                      <div className="mt-3 animate-slide-down">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-600 font-medium">Step 2: Enter your specialization</p>
                          <button
                            type="button"
                            onClick={() => setSpecializationCategory("")}
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
                            onChange={(e) => {
                              setCustomSpecialization(e.target.value)
                              setSpecialization("Other")
                            }}
                            className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                            placeholder="Enter your specialization (e.g., Sports Medicine)"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Qualification <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        id="qualificationDropdownButton"
                        data-dropdown-toggle="qualificationDropdown"
                        onClick={() => {
                          setShowQualificationDropdown(!showQualificationDropdown)
                          // Close other dropdowns
                          setShowBloodGroupDropdown(false)
                          setShowSpecializationDropdown(false)
                        }}
                        className="w-full pl-12 pr-10 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 text-left flex items-center justify-between hover:border-slate-400 transition-all duration-200"
                        type="button"
                      >
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🎓</span>
                        <span className="text-slate-700">
                          {qualification || " Select Qualification "}
                        </span>
                        <svg className="w-5 h-5 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                        </svg>
                      </button>

                      {/* Dropdown menu */}
                      <div
                        id="qualificationDropdown"
                        className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${showQualificationDropdown ? 'block' : 'hidden'}`}
                      >
                        <ul className="py-2 text-sm text-gray-700 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" aria-labelledby="qualificationDropdownButton">
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                setQualification("")
                                setShowQualificationDropdown(false)
                              }}
                              className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                            >
                              Select Qualification
                            </button>
                          </li>
                          {qualifications.map((qual) => (
                            <li key={qual}>
                              <button
                                type="button"
                                onClick={() => {
                                  setQualification(qual)
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

                    {qualification === "Other" && (
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

                  {/* Experience and Fee - 2 Column Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Experience <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">⏱️</span>
                        <input  type="text"  value={experience} onChange={(e) => setExperience(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                          placeholder="5 years" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Consultation Fee (₹) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💰</span>
                        <input  type="number" value={consultationFee}
                          onChange={(e) => setConsultationFee(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                          placeholder="500"  min="0" step="50" required />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Per consultation</p>
                    </div>
                  </div>
                </>
              )}

              {/* Password fields */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                  <input
                    type="password"value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-200"
                    placeholder="••••••••" minLength={8} required
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
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-12 pr-12 py-3 border-2 rounded-lg focus:outline-none transition-all duration-200 ${confirmPassword && password !== confirmPassword
                        ? 'border-red-400 focus:border-red-500'
                        : confirmPassword && password === confirmPassword && passwordValid
                          ? 'border-green-400 focus:border-green-500'
                          : 'border-slate-300 focus:border-slate-500'
                      }`}
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                    tabIndex={-1} >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="mt-2">
                    {password !== confirmPassword ? (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <span>✕</span> Passwords do not match
                      </p>
                    ) : passwordValid ? (
                      <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <span>✓</span> Passwords match
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <span>⚠</span> Complete password requirements above
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || validating}
                className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white py-4 rounded-lg font-bold text-base transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {validating ? (
                  <span className="flex items-center justify-center gap-3 animate-pulse">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-semibold">
                      Validating Information...
                    </span>
                  </span>
                ) : loading ? (
                  <span className="flex items-center justify-center gap-3 animate-pulse">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-semibold">
                      Creating {role === "doctor" ? "Doctor" : "Patient"} Account...
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-lg">🚀</span>
                    <span className="font-semibold">
                      Create {role === "doctor" ? "Doctor" : "Patient"} Account
                    </span>
                  </span>
                )}
              </button>
            </form>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <a  href={`/auth/login?role=${role}`}  className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
                >  Sign in </a>
              </p>
            </div>

            {/* Footer Trust Badges */}
            <div className="mt-8 flex items-center justify-center gap-8 text-slate-400">
              <div className="text-center">
                <div className="text-2xl mb-1">🏥</div>
                <p className="text-xs font-medium">Certified</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🔒</div>
                <p className="text-xs font-medium">Secure</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">⚡</div>
                <p className="text-xs font-medium">Fast</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal (for patients only) */}
      {showOTPModal && role === "patient" && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
                <span className="text-3xl">📱</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Verify Your Phone Number</h3>
              <p className="text-sm text-slate-600">
                We've sent a 6-digit verification code to
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {countryCode}{phone}
              </p>
            </div>

            {(error || modalError) && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded-r-lg">
                <p className="text-sm text-red-700 font-medium">{modalError || error}</p>
              </div>
            )}

            {!otpSent ? (
              <div className="text-center py-4">
                <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-slate-600 mt-4">Sending OTP...</p>
              </div>
            ) : !otpVerified ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-4 py-4 border-2 border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none bg-white text-slate-900 text-center text-3xl font-bold tracking-widest"
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={verifyingOTP || otp.length !== 6}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {verifyingOTP ? "Verifying..." : "Verify & Create Account"}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOtp("")
                    setOtpSent(false)
                    setModalError("")
                    await handleSendOTP(false)
                  }}
                  disabled={sendingOTP}
                  className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50"
                >
                  {sendingOTP ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <span className="text-3xl text-green-600">✓</span>
                </div>
                <p className="text-sm font-medium text-green-700">Verifying and creating account...</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (!otpVerified && !verifyingOTP) {
                  setShowOTPModal(false)
                  setOtp("")
                  setOtpSent(false)
                  setOtpVerified(false)
                  setError("")
                  setModalError("")
                }
              }}
              disabled={verifyingOTP || otpVerified}
              className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {otpVerified ? "" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function SignUp() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading signup page..." />}>
      <SignUpContent />
    </Suspense>
  )
}

// Force dynamic rendering to prevent prerender errors
export const dynamic = 'force-dynamic'