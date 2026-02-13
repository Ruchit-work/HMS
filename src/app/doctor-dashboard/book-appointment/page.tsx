"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { getAvailableTimeSlots, isSlotInPast, normalizeTime } from "@/utils/timeSlots"
import { isDateBlocked } from "@/utils/analytics/blockedDates"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"
import Notification from "@/components/ui/feedback/Notification"
import VoiceInput from "@/components/ui/VoiceInput"

type PatientMode = "existing" | "new"

interface NewPatientForm {
  firstName: string
  lastName: string
  phone: string
}

const initialNewPatient: NewPatientForm = {
  firstName: "",
  lastName: "",
  phone: "",
}

export default function DoctorBookAppointmentPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth("doctor")
  const { activeHospitalId } = useMultiHospital()
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const [doctorProfile, setDoctorProfile] = useState<{
    visitingHours?: any
    blockedDates?: any[]
    consultationFee?: number
  } | null>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [patientMode, setPatientMode] = useState<PatientMode>("existing")
  const [searchPatient, setSearchPatient] = useState("")
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [newPatient, setNewPatient] = useState<NewPatientForm>(initialNewPatient)
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [durationMinutes, setDurationMinutes] = useState(15)
  const [bookLoading, setBookLoading] = useState(false)

  useEffect(() => {
    if (!user?.uid || !activeHospitalId) return
    const load = async () => {
      const doctorSnap = await getDoc(doc(db, "doctors", user.uid))
      if (doctorSnap.exists()) {
        const d = doctorSnap.data()
        const fee = d?.consultationFee ?? 0
        setDoctorProfile({
          visitingHours: d?.visitingHours,
          blockedDates: d?.blockedDates || [],
          consultationFee: fee,
        })
        setPaymentAmount((prev) => (prev === 0 ? fee : prev))
      } else {
        setDoctorProfile({})
      }
      const patientsQuery = query(
        getHospitalCollection(activeHospitalId, "patients"),
        where("status", "in", ["active", "inactive"])
      )
      const patientSnap = await getDocs(patientsQuery)
      setPatients(patientSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    }
    load()
  }, [user?.uid, activeHospitalId])

  const filteredPatients = useMemo(() => {
    if (!searchPatient) return patients
    const s = searchPatient.toLowerCase().trim()
    return patients.filter(
      (p: any) =>
        `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase().includes(s) ||
        (p.email || "").toLowerCase().includes(s) ||
        (p.phone || "").toLowerCase().includes(s) ||
        (p.patientId ? String(p.patientId).toLowerCase().includes(s) : false)
    )
  }, [patients, searchPatient])

  const handleExistingPatientSearch = useCallback((value: string) => {
    setSearchPatient(value)
    setShowPatientSuggestions(value.trim().length > 0)
    const valLower = value.toLowerCase().trim()
    const match = patients.find((p: any) => {
      const label = `${p.firstName || ""} ${p.lastName || ""} — ${p.email || ""}`.trim()
      if (label.toLowerCase() === valLower) return true
      if (p.patientId && String(p.patientId).toLowerCase() === valLower) return true
      return false
    })
    setSelectedPatientId(match ? match.id : "")
  }, [patients])

  const isSelectedDateBlocked =
    !!appointmentDate &&
    !!doctorProfile?.blockedDates &&
    isDateBlocked(appointmentDate, doctorProfile.blockedDates)

  useEffect(() => {
    if (!user?.uid || !appointmentDate || !doctorProfile) {
      setAvailableSlots([])
      setAppointmentTime("")
      return
    }
    if (isSelectedDateBlocked) {
      setAvailableSlots([])
      setAppointmentTime("")
      return
    }
    const compute = async () => {
      setAvailableSlots([])
      setAppointmentTime("")
      try {
        const aptQuery = query(
          getHospitalCollection(activeHospitalId!, "appointments"),
          where("doctorId", "==", user.uid),
          where("appointmentDate", "==", appointmentDate)
        )
        const aptSnap = await getDocs(aptQuery)
        const existing = aptSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const slotsQuery = query(
          collection(db, "appointmentSlots"),
          where("doctorId", "==", user.uid),
          where("appointmentDate", "==", appointmentDate)
        )
        const slotsSnap = await getDocs(slotsQuery)
        const bookedSlots = new Set<string>()
        slotsSnap.docs.forEach((docSnap) => {
          const data = docSnap.data()
          if (data.appointmentTime) bookedSlots.add(normalizeTime(data.appointmentTime))
        })
        const dateObj = new Date(`${appointmentDate}T00:00:00`)
        const slots = getAvailableTimeSlots(
          { ...doctorProfile, visitingHours: doctorProfile?.visitingHours, blockedDates: doctorProfile?.blockedDates } as any,
          dateObj,
          existing as any
        )
        const filtered = slots.filter((s) => {
          if (isSlotInPast(s, appointmentDate)) return false
          if (bookedSlots.has(normalizeTime(s))) return false
          return true
        })
        setAvailableSlots(filtered)
      } catch {
        setAvailableSlots([])
      }
    }
    compute()
  }, [user?.uid, appointmentDate, doctorProfile, activeHospitalId, isSelectedDateBlocked])

  const createPatient = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error("Not logged in")
    const res = await fetch("/api/receptionist/create-patient", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        patientData: {
          ...newPatient,
          email: "",
          status: "active",
          createdBy: "doctor",
        },
        password: "",
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || "Failed to create patient")
    }
    return res.json()
  }, [newPatient])

  const createAppointment = useCallback(
    async (patientId: string, payload: { firstName?: string; lastName?: string; email?: string; phone?: string }) => {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Not logged in")
      const patientName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim()
      const phone = (payload as any).phone || (payload as any).phoneNumber || ""
      const res = await fetch("/api/doctor/create-appointment", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentData: {
            patientId,
            patientName: patientName || "Patient",
            patientEmail: payload.email || "",
            patientPhone: phone,
            appointmentDate,
            appointmentTime,
            chiefComplaint: chiefComplaint || "General consultation",
            medicalHistory: "",
            status: "confirmed",
            paymentAmount: paymentAmount ?? doctorProfile?.consultationFee ?? 0,
            paymentMethod: "cash",
            paymentType: "full",
            durationMinutes: durationMinutes || 15,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to book appointment")
      }
      return res.json()
    },
    [appointmentDate, appointmentTime, chiefComplaint, doctorProfile?.consultationFee, paymentAmount, durationMinutes]
  )

  const handleBook = async () => {
    try {
      setBookLoading(true)
      setNotification(null)
      if (!appointmentDate || !appointmentTime) throw new Error("Select date and time")
      if (!availableSlots.includes(appointmentTime)) throw new Error("Selected time is not available")
      if (isSelectedDateBlocked) throw new Error("You are not available on this date")

      let patientId: string
      let payload: any

      if (patientMode === "new") {
        if (!newPatient.firstName?.trim() || !newPatient.lastName?.trim())
          throw new Error("Enter first name and last name for new patient")
        const created = await createPatient()
        patientId = created.id
        payload = { ...newPatient, email: "" }
      } else {
        if (!selectedPatientId) throw new Error("Select a patient")
        const p = patients.find((x: any) => x.id === selectedPatientId)
        if (!p) throw new Error("Patient not found")
        patientId = selectedPatientId
        payload = {
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone || p.phoneNumber,
        }
      }

      const slotCheck = await fetch(
        `/api/appointments/check-slot?doctorId=${user!.uid}&date=${appointmentDate}&time=${appointmentTime}`
      )
      const slotData = await slotCheck.json().catch(() => ({}))
      if (!slotData?.available) throw new Error(slotData?.error || "Slot no longer available")

      await createAppointment(patientId, payload)
      setNotification({ type: "success", message: "Appointment booked successfully." })
      setSelectedPatientId("")
      setSearchPatient("")
      setNewPatient(initialNewPatient)
      setAppointmentDate("")
      setAppointmentTime("")
      setChiefComplaint("")
    } catch (e) {
      setNotification({ type: "error", message: (e as Error).message })
    } finally {
      setBookLoading(false)
    }
  }

  if (authLoading || !user) {
    return <LoadingSpinner message="Loading..." />
  }

  const inputBase = "w-full h-11 rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-300 ease-out focus:border-[#0d6efd] focus:ring-2 focus:ring-[#0d6efd]/25 focus:outline-none"
  const iconWrapper = "absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center text-slate-400 pointer-events-none [&>svg]:block [&>svg]:shrink-0"
  const IconUser = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  const IconPhone = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
  const IconCalendar = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  const IconClock = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  const IconHeart = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
  const IconCurrency = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>

  return (
    <div className="min-h-screen relative overflow-hidden bg-white pt-20 pb-10 px-4 sm:px-6">
      {/* Subtle background accents */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-blue-50/30" />
      <div className="fixed inset-0 -z-10 opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(13,110,253,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_80%,rgba(255,77,79,0.05),transparent_50%)]" />
      </div>

      <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6">
          {/* Left: Visual panel - hidden on mobile */}
          <div className="hidden lg:flex lg:w-[280px] lg:flex-shrink-0 lg:sticky lg:top-24">
            <div className="relative w-full rounded-2xl bg-gradient-to-br from-[#0d6efd] to-[#0a58ca] p-6 shadow-lg overflow-hidden transition-shadow duration-300 hover:shadow-xl">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#ff4d4f] rounded-full translate-y-1/2 -translate-x-1/2 opacity-60" />
              </div>
              <div className="relative z-10 text-white">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm">
                  <IconCalendar />
                </div>
                <h2 className="text-xl font-semibold tracking-tight mb-2">Quick & Easy Booking</h2>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Book for existing or new patients in seconds. Appointments are confirmed under your name and synced to your schedule.
                </p>
              </div>
              <div className="relative z-10 mt-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-white/15 flex items-center justify-center">
                  <IconHeart />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="flex-1 min-w-0 w-full">
            <div className="mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Book Appointment</h1>
              <p className="text-slate-600 mt-1 text-sm">Book for an existing or new patient. Appointment will be under your name.</p>
            </div>

            {notification && (
              <div className="mb-4 transition-opacity duration-300">
                <Notification
                  type={notification.type}
                  message={notification.message}
                  onClose={() => setNotification(null)}
                />
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-md shadow-slate-200/40 p-5 sm:p-6 space-y-5 transition-all duration-300">
          {/* Patient mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Patient</label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPatientMode("existing")}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  patientMode === "existing"
                    ? "bg-[#0d6efd] text-white shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Existing patient
              </button>
              <button
                type="button"
                onClick={() => setPatientMode("new")}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  patientMode === "new"
                    ? "bg-[#0d6efd] text-white shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                New patient
              </button>
            </div>
          </div>

          {patientMode === "existing" ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Search patient</label>
              <div className="relative h-11">
                <span className={iconWrapper}><IconUser /></span>
                <input
                  type="text"
                  value={searchPatient}
                  onChange={(e) => handleExistingPatientSearch(e.target.value)}
                  placeholder="Search by name, email, phone, or patient ID — or use voice"
                  className={`${inputBase} pl-10 pr-12`}
                />
                <div className="absolute right-2 inset-y-0 flex items-center justify-end pointer-events-none">
                  <div className="pointer-events-auto">
                    <VoiceInput
                      onTranscript={(text) => {
                        handleExistingPatientSearch(text)
                        setShowPatientSuggestions(true)
                      }}
                      language="en-IN"
                      useMedicalModel={false}
                      variant="inline"
                    />
                  </div>
                </div>
              </div>
              <div className="relative w-full">
                {showPatientSuggestions && searchPatient.trim().length > 0 && (
                  <div
                    className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg transition-shadow duration-300"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredPatients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
                    ) : (
                      filteredPatients.slice(0, 10).map((p: any) => {
                        const label = `${p.firstName || ""} ${p.lastName || ""} — ${p.email || ""}`.trim()
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full px-4 py-3 text-left text-sm transition-colors duration-300 hover:bg-blue-50/80 border-b border-slate-100 last:border-b-0 first:rounded-t-xl"
                            onClick={() => {
                              setSelectedPatientId(p.id)
                              setSearchPatient(label)
                              setShowPatientSuggestions(false)
                            }}
                          >
                            <div className="font-medium text-slate-900">
                              {p.firstName} {p.lastName}
                            </div>
                            <div className="text-xs text-slate-600">
                              {p.email || ""}
                              {p.phone ? ` • ${p.phone}` : ""}
                            </div>
                            {p.patientId && (
                              <div className="text-[11px] font-mono text-slate-500">ID: {p.patientId}</div>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
              {selectedPatientId && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Selected: {searchPatient}
                </span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">First name *</label>
                <div className="relative h-11">
                <span className={iconWrapper}><IconUser /></span>
                <input
                  type="text"
                  value={newPatient.firstName}
                  onChange={(e) => setNewPatient((p) => ({ ...p, firstName: e.target.value }))}
                  className={inputBase}
                  placeholder="First name"
                />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label>
                <div className="relative h-11">
                <span className={iconWrapper}><IconUser /></span>
                <input
                  type="text"
                  value={newPatient.lastName}
                  onChange={(e) => setNewPatient((p) => ({ ...p, lastName: e.target.value }))}
                  className={inputBase}
                  placeholder="Last name"
                />
                </div>
              </div>
              <div className="relative sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <div className="relative h-11">
                <span className={iconWrapper}><IconPhone /></span>
                <input
                  type="tel"
                  value={newPatient.phone}
                  onChange={(e) => setNewPatient((p) => ({ ...p, phone: e.target.value }))}
                  className={inputBase}
                  placeholder="Phone number"
                />
                </div>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <div className="relative h-11">
            <span className={iconWrapper}><IconCalendar /></span>
            <input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className={inputBase}
            />
            </div>
            {isSelectedDateBlocked && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                You have marked this date as unavailable.
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
            <div className="relative h-11">
            <span className={iconWrapper}><IconClock /></span>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className={`${inputBase} cursor-pointer pr-10`}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
            </div>
          </div>

          {/* Time */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Time *</label>
            <div className="relative h-11">
            <span className={iconWrapper}><IconClock /></span>
            <select
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              className={`${inputBase} cursor-pointer pr-10`}
              disabled={!appointmentDate || availableSlots.length === 0}
            >
              <option value="">Select time</option>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot} ({durationMinutes} min)
                </option>
              ))}
            </select>
            </div>
            {appointmentDate && availableSlots.length === 0 && !isSelectedDateBlocked && (
              <p className="text-xs text-slate-500 mt-1.5">No slots available on this date.</p>
            )}
          </div>

          {/* Payment */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment (₹)</label>
            <div className="relative h-11">
            <span className={iconWrapper}><IconCurrency /></span>
            <input
              type="number"
              min={0}
              step={1}
              value={paymentAmount || ""}
              onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
              className={inputBase}
              placeholder={String(doctorProfile?.consultationFee ?? 0)}
            />
            </div>
          </div>

          {/* Reason (optional) */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
            <div className="relative h-11">
            <span className={iconWrapper}><IconHeart /></span>
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className={inputBase}
              placeholder="e.g. Follow-up, General checkup"
            />
            </div>
          </div>

          <button
            type="button"
            onClick={handleBook}
            disabled={bookLoading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#0d6efd] to-[#0a58ca] text-white font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 shadow-md"
          >
            {bookLoading ? "Booking..." : "Book Appointment"}
          </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
