"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import PaymentMethodSection, {
  PaymentData as BookingPaymentData,
  PaymentMethodOption as BookingPaymentMethod,
} from "@/components/payments/PaymentMethodSection"
import PasswordRequirements, { isPasswordValid } from "@/components/forms/PasswordRequirements"
import AppointmentSuccessModal from "@/components/patient/AppointmentSuccessModal"
import OTPVerificationModal from "@/components/forms/OTPVerificationModal"
import { bloodGroups } from "@/constants/signup"
import { SYMPTOM_CATEGORIES } from "@/components/patient/SymptomSelector"
import { getAvailableTimeSlots, isSlotInPast, formatTimeDisplay } from "@/utils/timeSlots"

interface BookAppointmentPanelProps {
  patientMode: "existing" | "new"
  onPatientModeChange: (_mode: "existing" | "new") => void
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
}

interface NewPatientForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  bloodGroup: string
  dateOfBirth: string
  address: string
}

const initialNewPatient: NewPatientForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  bloodGroup: "",
  dateOfBirth: "",
  address: "",
}

const emptyBookingPayment: BookingPaymentData = {
  cardNumber: "",
  cardName: "",
  expiryDate: "",
  cvv: "",
  upiId: "",
}

export default function BookAppointmentPanel({ patientMode, onPatientModeChange, onNotification }: BookAppointmentPanelProps) {
  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookErrorFade, setBookErrorFade] = useState(false)

  const [doctors, setDoctors] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])

  const [searchPatient, setSearchPatient] = useState("")
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<any | null>(null)
  const [patientInfoLoading, setPatientInfoLoading] = useState(false)
  const [patientInfoError, setPatientInfoError] = useState<string | null>(null)

  const [newPatient, setNewPatient] = useState<NewPatientForm>(initialNewPatient)
  const [newPatientPassword, setNewPatientPassword] = useState("")
  const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState("")

  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const [selectedDoctorFee, setSelectedDoctorFee] = useState<number | null>(null)
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")

  const [symptomCategory, setSymptomCategory] = useState("")
  const [customSymptom, setCustomSymptom] = useState("")

  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod | null>(null)
  const [paymentData, setPaymentData] = useState<BookingPaymentData>(emptyBookingPayment)

  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const paymentAmount = useMemo(() => selectedDoctorFee || 0, [selectedDoctorFee])

  const paymentMethods = useMemo<BookingPaymentMethod[]>(() => {
    return patientMode === "new" ? ["card", "upi", "cash"] : ["card", "upi", "cash", "wallet"]
  }, [patientMode])

  useEffect(() => {
    if (patientMode === "new" && paymentMethod === "wallet") {
      setPaymentMethod(null)
    }
  }, [patientMode, paymentMethod])

  const isSelectedDateBlocked = useMemo(() => {
    if (!selectedDoctorId || !appointmentDate) return false
    const docObj: any = doctors.find((d: any) => d.id === selectedDoctorId)
    if (!docObj) return false
    const rawBlocked: any[] = Array.isArray(docObj?.blockedDates) ? docObj.blockedDates : []
    const normalized: string[] = rawBlocked
      .map((b: any) => {
        if (!b) return ""
        if (typeof b === "string") return b.slice(0, 10)
        if (typeof b === "object" && typeof b.date === "string") return String(b.date).slice(0, 10)
        if (b?.toDate) {
          const dt = b.toDate() as Date
          const y = dt.getFullYear()
          const m = String(dt.getMonth() + 1).padStart(2, "0")
          const d = String(dt.getDate()).padStart(2, "0")
          return `${y}-${m}-${d}`
        }
        if (b?.seconds) {
          const dt = new Date(b.seconds * 1000)
          const y = dt.getFullYear()
          const m = String(dt.getMonth() + 1).padStart(2, "0")
          const d = String(dt.getDate()).padStart(2, "0")
          return `${y}-${m}-${d}`
        }
        return ""
      })
      .filter(Boolean)
    return normalized.includes(appointmentDate)
  }, [selectedDoctorId, appointmentDate, doctors])

  const filteredPatients = useMemo(() => {
    if (!searchPatient) return patients
    const s = searchPatient.toLowerCase()
    return patients.filter((p: any) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.phone?.toLowerCase().includes(s) ||
      (p.patientId ? String(p.patientId).toLowerCase().includes(s) : false)
    )
  }, [patients, searchPatient])

  const suggestedDoctors = useMemo(() => {
    if (!symptomCategory || symptomCategory === "custom") return doctors
    const category = SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)
    if (!category) return doctors
    const specs = category.relatedSpecializations.map((s) => s.toLowerCase())
    const filtered = doctors.filter((d: any) => specs.some((spec) => String(d.specialization || "").toLowerCase().includes(spec)))
    return filtered.length ? filtered : doctors
  }, [symptomCategory, doctors])

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  useEffect(() => {
    const doctorsQuery = query(collection(db, "doctors"), where("status", "==", "active"))
    const unsubscribe = onSnapshot(doctorsQuery, (snap) => {
      setDoctors(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    ;(async () => {
      try {
        const patientsQuery = query(collection(db, "patients"), where("status", "in", ["active", "inactive"]))
        const patientSnap = await getDocs(patientsQuery)
        setPatients(patientSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (error) {
        console.error("Failed to preload patients", error)
      }
    })()

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (patientMode === "existing") {
      setNewPatient(initialNewPatient)
      setNewPatientPassword("")
      setNewPatientPasswordConfirm("")
    } else {
      setSearchPatient("")
      setSelectedPatientId("")
      setSelectedPatientInfo(null)
    }
  }, [patientMode])

  useEffect(() => {
    if (!patientMode || patientMode !== "existing") return
    if (!selectedPatientId) {
      setSelectedPatientInfo(null)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        setPatientInfoLoading(true)
        setPatientInfoError(null)
        const snap = await getDoc(doc(db, "patients", selectedPatientId))
        if (!cancelled) {
          if (snap.exists()) {
            setSelectedPatientInfo({ id: snap.id, ...snap.data() })
          } else {
            setPatientInfoError("Patient not found")
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPatientInfoError(error instanceof Error ? error.message : "Failed to load patient")
        }
      } finally {
        if (!cancelled) {
          setPatientInfoLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId, patientMode])

  useEffect(() => {
    const computeSlots = async () => {
      setAvailableSlots([])
      setAppointmentTime("")
      if (!selectedDoctorId || !appointmentDate) return

      const doctor = doctors.find((d: any) => d.id === selectedDoctorId) || {}
      const rawBlocked: any[] = Array.isArray((doctor as any)?.blockedDates) ? (doctor as any).blockedDates : []
      const blockedNorm: string[] = rawBlocked
        .map((b: any) => {
          if (!b) return ""
          if (typeof b === "string") return b.slice(0, 10)
          if (typeof b === "object" && typeof b.date === "string") return String(b.date).slice(0, 10)
          if (b?.toDate) {
            const dt = b.toDate() as Date
            const y = dt.getFullYear()
            const m = String(dt.getMonth() + 1).padStart(2, "0")
            const d = String(dt.getDate()).padStart(2, "0")
            return `${y}-${m}-${d}`
          }
          if (b?.seconds) {
            const dt = new Date(b.seconds * 1000)
            const y = dt.getFullYear()
            const m = String(dt.getMonth() + 1).padStart(2, "0")
            const d = String(dt.getDate()).padStart(2, "0")
            return `${y}-${m}-${d}`
          }
          return ""
        })
        .filter(Boolean)
      if (blockedNorm.includes(appointmentDate)) {
        setAvailableSlots([])
        return
      }

      try {
        const aptQuery = query(
          collection(db, "appointments"),
          where("doctorId", "==", selectedDoctorId),
          where("appointmentDate", "==", appointmentDate)
        )
        const aptSnap = await getDocs(aptQuery)
        const existing = aptSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        const dateObj = new Date(`${appointmentDate}T00:00:00`)
        const slots = getAvailableTimeSlots(doctor as any, dateObj, existing as any)
        const filtered = slots.filter((s) => !isSlotInPast(s, appointmentDate))
        setAvailableSlots(filtered)
      } catch (error) {
        console.error("Failed to compute time slots", error)
        setAvailableSlots([])
      }
    }

    computeSlots()
  }, [selectedDoctorId, appointmentDate, doctors])

  useEffect(() => {
    if (!bookError) return
    setBookErrorFade(false)
    const fadeTimer = setTimeout(() => setBookErrorFade(true), 4000)
    const clearTimer = setTimeout(() => setBookError(null), 5000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
    }
  }, [bookError])

  const handleExistingPatientSearch = (value: string) => {
    const valLower = value.toLowerCase()
    setSearchPatient(value)
    setShowPatientSuggestions(value.trim().length > 0)
    const match = patients.find((p: any) => {
      const label = `${p.firstName} ${p.lastName} — ${p.email}`
      if (label.toLowerCase() === valLower) return true
      if (p.patientId && String(p.patientId).toLowerCase() === valLower) return true
      return false
    })
    setSelectedPatientId(match ? match.id : "")
  }

  const resetBookingForm = useCallback(() => {
    onPatientModeChange("existing")
    setSearchPatient("")
    setSelectedPatientId("")
    setSelectedPatientInfo(null)
    setNewPatient(initialNewPatient)
    setNewPatientPassword("")
    setNewPatientPasswordConfirm("")
    setSelectedDoctorId("")
    setSelectedDoctorFee(null)
    setAppointmentDate("")
    setAppointmentTime("")
    setSymptomCategory("")
    setCustomSymptom("")
    setPaymentMethod(null)
    setPaymentData(emptyBookingPayment)
    setAvailableSlots([])
  }, [onPatientModeChange])

  const createPatientForBooking = useCallback(async () => {
    const res = await fetch("/api/receptionist/create-patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientData: {
          ...newPatient,
          status: "active",
          createdBy: "receptionist",
          createdAt: new Date().toISOString(),
        },
        password: newPatientPassword,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || "Failed to create patient")
    }
    return res.json()
  }, [newPatient, newPatientPassword])

  const createAppointment = useCallback(
    async (patientId: string, patientPayload: any) => {
      const doctor = doctors.find((x: any) => x.id === selectedDoctorId)
      const appointmentData = {
        patientId,
        patientName: `${patientPayload.firstName || ""} ${patientPayload.lastName || ""}`.trim(),
        patientEmail: patientPayload.email || "",
        patientPhone: patientPayload.phone || "",
        doctorId: doctor?.id,
        doctorName: `${doctor?.firstName || ""} ${doctor?.lastName || ""}`.trim(),
        doctorSpecialization: doctor?.specialization || "",
        appointmentDate,
        appointmentTime,
        status: "confirmed",
        paymentAmount: paymentAmount,
        paymentMethod: paymentMethod,
        paymentType: "full",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "receptionist",
      }
      const res = await fetch("/api/receptionist/create-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentData }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to create appointment")
      }
      return appointmentData
    },
    [appointmentDate, appointmentTime, doctors, paymentAmount, paymentMethod, selectedDoctorId]
  )

  const preventDuplicateAppointment = useCallback(
    async (patientId: string) => {
      try {
        const dupQuery = query(
          collection(db, "appointments"),
          where("patientId", "==", patientId),
          where("appointmentDate", "==", appointmentDate),
          where("status", "==", "confirmed")
        )
        const dupSnap = await getDocs(dupQuery)
        if (!dupSnap.empty) {
          throw new Error("This patient already has an appointment on this date")
        }
      } catch (error) {
        if (error instanceof Error) throw error
      }
    },
    [appointmentDate]
  )

  const handleBookAppointment = async () => {
    try {
      setBookLoading(true)
      setBookError(null)

      if (!selectedDoctorId) throw new Error("Please select a doctor")
      if (!appointmentDate || !appointmentTime) throw new Error("Please select date and time")
      if (!availableSlots.includes(appointmentTime)) throw new Error("Selected time is not available")
      if (isSelectedDateBlocked) throw new Error("Doctor is not available on the selected date")
      if (!paymentMethod) throw new Error("Please select a payment method")
      if (paymentMethod === "card") {
        if (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiryDate || !paymentData.cvv) {
          throw new Error("Enter complete card details")
        }
      }
      if (paymentMethod === "upi" && !paymentData.upiId) {
        throw new Error("Enter UPI ID")
      }

      let patientId = selectedPatientId
      let patientPayload: any = null

      if (patientMode === "new") {
        if (!newPatient.firstName || !newPatient.lastName || !newPatient.email) {
          throw new Error("Fill first name, last name, email")
        }
        if (!isPasswordValid(newPatientPassword)) {
          throw new Error("Password does not meet requirements")
        }
        if (newPatientPassword !== newPatientPasswordConfirm) {
          throw new Error("Passwords do not match")
        }
        if ((newPatient.phone || "").trim()) {
          setOtpModalOpen(true)
          return
        }
        const result = await createPatientForBooking()
        patientId = result.id
        patientPayload = { ...newPatient }
      } else {
        if (!patientId) {
          throw new Error("Please select an existing patient")
        }
        const patient = selectedPatientInfo || patients.find((x: any) => x.id === patientId)
        patientPayload = patient
      }

      await preventDuplicateAppointment(patientId)
      const appointmentData = await createAppointment(patientId, patientPayload)

      const txnId = `RCPT${Date.now()}`
      setSuccessData({
        doctorName: appointmentData.doctorName,
        doctorSpecialization: appointmentData.doctorSpecialization,
        appointmentDate,
        appointmentTime,
        transactionId: txnId,
        paymentAmount: appointmentData.paymentAmount,
        paymentType: "full",
        patientName: appointmentData.patientName,
      })
      setSuccessOpen(true)
      resetBookingForm()
      notify({ type: "success", message: "Appointment booked successfully." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to book appointment"
      setBookError(message)
      notify({ type: "error", message })
    } finally {
      setBookLoading(false)
    }
  }

  const handleOtpVerified = async () => {
    try {
      setBookLoading(true)
      setBookError(null)
      const result = await createPatientForBooking()
      const patientId = result.id
      const patientPayload: any = { ...newPatient }

      await preventDuplicateAppointment(patientId)
      const appointmentData = await createAppointment(patientId, patientPayload)

      const txnId = `RCPT${Date.now()}`
      setSuccessData({
        doctorName: appointmentData.doctorName,
        doctorSpecialization: appointmentData.doctorSpecialization,
        appointmentDate,
        appointmentTime,
        transactionId: txnId,
        paymentAmount: appointmentData.paymentAmount,
        paymentType: "full",
        patientName: appointmentData.patientName,
      })
      setSuccessOpen(true)
      setOtpModalOpen(false)
      resetBookingForm()
      notify({ type: "success", message: "Appointment booked successfully." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to book appointment"
      setBookError(message)
      notify({ type: "error", message })
    } finally {
      setBookLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Book Appointment — {patientMode === "existing" ? "Existing Patient" : "New Patient"}</h2>

      {bookError && (
        <div
          className={`bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded transition-opacity duration-1000 ease-out ${
            bookErrorFade ? "opacity-0" : "opacity-100"
          }`}
        >
          {bookError}
        </div>
      )}

      <div>
        {patientMode === "existing" ? (
          <div className="relative">
            <input
              value={searchPatient}
              onChange={(e) => handleExistingPatientSearch(e.target.value)}
              placeholder="Search patient by name, email, phone, or patient ID"
              className="w-full px-3 py-2 border rounded"
            />
            {showPatientSuggestions && searchPatient.trim().length > 0 && (
              <div
                className="absolute z-10 mt-1 w-full bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-lg max-h-64 overflow-auto"
                onMouseDown={(e) => e.preventDefault()}
                onBlur={() => setShowPatientSuggestions(false)}
              >
                {filteredPatients.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                ) : (
                  filteredPatients.slice(0, 10).map((p: any) => {
                    const label = `${p.firstName} ${p.lastName} — ${p.email}`
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        onClick={() => {
                          setSelectedPatientId(p.id)
                          setSearchPatient(label)
                          setShowPatientSuggestions(false)
                        }}
                      >
                        <div className="font-medium text-gray-900">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-xs text-gray-600">
                          {p.email}
                          {p.phone ? ` • ${p.phone}` : ""}
                        </div>
                        {p.patientId && (
                          <div className="text-[11px] text-gray-500 font-mono">ID: {p.patientId}</div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="First name"
              className="px-3 py-2 border rounded"
              value={newPatient.firstName}
              onChange={(e) => setNewPatient((v) => ({ ...v, firstName: e.target.value }))}
            />
            <input
              placeholder="Last name"
              className="px-3 py-2 border rounded"
              value={newPatient.lastName}
              onChange={(e) => setNewPatient((v) => ({ ...v, lastName: e.target.value }))}
            />
            <input
              placeholder="Email"
              type="email"
              className="px-3 py-2 border rounded"
              value={newPatient.email}
              onChange={(e) => setNewPatient((v) => ({ ...v, email: e.target.value }))}
            />
            <input
              placeholder="Phone"
              className="px-3 py-2 border rounded"
              value={newPatient.phone}
              onChange={(e) => setNewPatient((v) => ({ ...v, phone: e.target.value }))}
            />
            <div className="sm:col-span-1">
              <input
                placeholder="Password"
                type="password"
                className="w-full px-3 py-2 border rounded"
                value={newPatientPassword}
                onChange={(e) => setNewPatientPassword(e.target.value)}
              />
              <PasswordRequirements password={newPatientPassword} />
            </div>
            <input
              placeholder="Confirm Password"
              type="password"
              className="px-3 py-2 border rounded"
              value={newPatientPasswordConfirm}
              onChange={(e) => setNewPatientPasswordConfirm(e.target.value)}
            />
            <select
              className="px-3 py-2 border rounded"
              value={newPatient.gender}
              onChange={(e) => setNewPatient((v) => ({ ...v, gender: e.target.value }))}
            >
              <option value="">Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <select
              className="px-3 py-2 border rounded"
              value={newPatient.bloodGroup}
              onChange={(e) => setNewPatient((v) => ({ ...v, bloodGroup: e.target.value }))}
            >
              <option value="">Blood group</option>
              {bloodGroups.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-gray-600">Birthday</label>
              <input
                type="date"
                className="px-3 py-2 border rounded"
                max={todayStr}
                value={newPatient.dateOfBirth}
                onChange={(e) => setNewPatient((v) => ({ ...v, dateOfBirth: e.target.value }))}
              />
            </div>
            <input
              placeholder="Address"
              className="px-3 py-2 border rounded sm:col-span-2"
              value={newPatient.address}
              onChange={(e) => setNewPatient((v) => ({ ...v, address: e.target.value }))}
            />
          </div>
        )}
      </div>

      {patientMode === "existing" && selectedPatientId && (
        <div className="mt-3">
          {patientInfoLoading && <div className="text-xs text-gray-500">Loading patient details…</div>}
          {patientInfoError && <div className="text-xs text-red-600">{patientInfoError}</div>}
          {selectedPatientInfo && !patientInfoLoading && !patientInfoError && (
            <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">
                  {selectedPatientInfo.firstName} {selectedPatientInfo.lastName}
                </div>
                {selectedPatientInfo.bloodGroup && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                    {selectedPatientInfo.bloodGroup}
                  </span>
                )}
              </div>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                <div>
                  <span className="text-xs text-gray-500">Email:</span> {selectedPatientInfo.email || "—"}
                </div>
                <div>
                  <span className="text-xs text-gray-500">Phone:</span> {selectedPatientInfo.phone || "—"}
                </div>
                <div>
                  <span className="text-xs text-gray-500">Patient ID:</span> {selectedPatientInfo.patientId || "—"}
                </div>
                <div>
                  <span className="text-xs text-gray-500">Gender:</span> {selectedPatientInfo.gender || "—"}
                </div>
                <div>
                  <span className="text-xs text-gray-500">DOB:</span> {selectedPatientInfo.dateOfBirth || "—"}
                </div>
                {selectedPatientInfo.address && (
                  <div className="sm:col-span-2">
                    <span className="text-xs text-gray-500">Address:</span> {selectedPatientInfo.address}
                  </div>
                )}
                {(selectedPatientInfo.allergies || selectedPatientInfo.currentMedications) && (
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    {selectedPatientInfo.allergies && (
                      <div>
                        <span className="text-xs text-gray-500">Allergies:</span> {selectedPatientInfo.allergies}
                      </div>
                    )}
                    {selectedPatientInfo.currentMedications && (
                      <div>
                        <span className="text-xs text-gray-500">Medications:</span> {selectedPatientInfo.currentMedications}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Symptoms (suggest doctor)</label>
          <select
            value={symptomCategory}
            onChange={(e) => {
              setSymptomCategory(e.target.value)
              setSelectedDoctorId("")
              setSelectedDoctorFee(null)
              if (e.target.value !== "custom") setCustomSymptom("")
            }}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Select symptoms (optional)</option>
            {SYMPTOM_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
            <option value="custom">Custom...</option>
          </select>
          {symptomCategory === "custom" && (
            <div className="mt-2">
              <input
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                placeholder="Describe patient symptom (e.g., severe back pain)"
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">Doctor list isn't auto-filtered for custom text. Please pick a doctor.</p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Doctor</label>
          <select
            value={selectedDoctorId}
            onChange={(e) => {
              const doctorId = e.target.value
              setSelectedDoctorId(doctorId)
              const selectedDoctor = doctors.find((d: any) => d.id === doctorId)
              setSelectedDoctorFee(selectedDoctor?.consultationFee || null)
            }}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Select doctor</option>
            {suggestedDoctors.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.firstName} {d.lastName} — {d.specialization}
              </option>
            ))}
          </select>
          {selectedDoctorFee !== null && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Consultation Fee:</span>
                <span className="text-lg font-bold text-green-700">₹{selectedDoctorFee}</span>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Date</label>
          <input
            type="date"
            min={todayStr}
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            className={`w-full px-3 py-2 border rounded ${isSelectedDateBlocked ? "border-red-400 bg-red-50" : ""}`}
          />
          {isSelectedDateBlocked && <p className="text-xs text-red-600 mt-1">Doctor is not available on this date.</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Available Time</label>
          <select
            value={appointmentTime}
            onChange={(e) => setAppointmentTime(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            disabled={!selectedDoctorId || !appointmentDate || isSelectedDateBlocked}
          >
            <option value="">
              {!selectedDoctorId || !appointmentDate
                ? "Select doctor and date first"
                : isSelectedDateBlocked
                ? "Doctor not available on selected date"
                : availableSlots.length
                ? "Select time"
                : "No slots available"}
            </option>
            {availableSlots.map((s) => (
              <option key={s} value={s}>
                {formatTimeDisplay(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDoctorFee !== null && (
        <PaymentMethodSection
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentData={paymentData}
          setPaymentData={(data) => setPaymentData(data as BookingPaymentData)}
          amountToPay={paymentAmount}
          title="Payment Mode"
          methods={paymentMethods}
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          disabled={bookLoading}
          onClick={handleBookAppointment}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {bookLoading ? "Booking..." : "Book Appointment"}
        </button>
      </div>

      <AppointmentSuccessModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} appointmentData={successData} />

      {otpModalOpen && (
        <OTPVerificationModal
          isOpen={otpModalOpen}
          onClose={() => setOtpModalOpen(false)}
          phone={newPatient.phone || ""}
          onChangePhone={() => setOtpModalOpen(false)}
          onVerified={handleOtpVerified}
        />
      )}
    </div>
  )
}
