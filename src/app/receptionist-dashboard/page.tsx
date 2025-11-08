'use client'

import { useEffect, useMemo, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
import PatientManagement from "@/app/admin-dashboard/PatientManagement"
import DoctorManagement from "@/app/admin-dashboard/DoctorManagement"
import AppoinmentManagement from "@/app/admin-dashboard/AppoinmentManagement"
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore"
import { bloodGroups } from "@/constants/signup"
import { getAvailableTimeSlots, isSlotInPast, formatTimeDisplay } from "@/utils/timeSlots"
import { SYMPTOM_CATEGORIES } from "@/components/patient/SymptomSelector"
import PasswordRequirements, { isPasswordValid } from "@/components/form/PasswordRequirements"
import PaymentMethodSection, { PaymentData as RPaymentData, PaymentMethodOption as RPaymentMethod } from "@/components/payments/PaymentMethodSection"
import AppointmentSuccessModal from "@/components/patient/AppointmentSuccessModal"
import OTPVerificationModal from "@/components/form/OTPVerificationModal"
import { Admission, AdmissionRequest, BillingRecord, Room } from "@/types/patient"

export default function ReceptionistDashboard() {
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"patients" | "doctors" | "appointments" | "book-appointment" | "admit-requests">("patients")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [userName, setUserName] = useState<string>("")
  // Booking state
  const [bookLoading, setBookLoading] = useState(false)
  const [bookSubOpen, setBookSubOpen] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookErrorFade, setBookErrorFade] = useState(false)
  const [doctors, setDoctors] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [patientMode, setPatientMode] = useState<'existing'|'new'>('existing')
  const [searchPatient, setSearchPatient] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [newPatient, setNewPatient] = useState({ firstName:'', lastName:'', email:'', phone:'', gender:'', bloodGroup:'', dateOfBirth:'', address:'' })
  const [newPatientPassword, setNewPatientPassword] = useState('')
  const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [selectedDoctorFee, setSelectedDoctorFee] = useState<number | null>(null)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "cash" | "wallet" | null>(null)
  const [paymentData, setPaymentData] = useState<{ cardNumber: string; cardName: string; expiryDate: string; cvv: string; upiId: string }>({ cardNumber: "", cardName: "", expiryDate: "", cvv: "", upiId: "" })
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
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
          const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, "0"); const d = String(dt.getDate()).padStart(2, "0")
          return `${y}-${m}-${d}`
        }
        if (b?.seconds) {
          const dt = new Date(b.seconds * 1000)
          const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, "0"); const d = String(dt.getDate()).padStart(2, "0")
          return `${y}-${m}-${d}`
        }
        return ""
      })
      .filter(Boolean)
    return normalized.includes(appointmentDate)
  }, [selectedDoctorId, appointmentDate, doctors])
  const todayStr = useMemo(()=> new Date().toISOString().split('T')[0], [])
  const [symptomCategory, setSymptomCategory] = useState<string>('')
  const [customSymptom, setCustomSymptom] = useState('')
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<any | null>(null)
  const [patientInfoLoading, setPatientInfoLoading] = useState(false)
  const [patientInfoError, setPatientInfoError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)
  const [admitRequests, setAdmitRequests] = useState<AdmissionRequest[]>([])
  const [admitRequestsLoading, setAdmitRequestsLoading] = useState(false)
  const [admitRequestsError, setAdmitRequestsError] = useState<string | null>(null)
  const [selectedAdmitRequest, setSelectedAdmitRequest] = useState<AdmissionRequest | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignRoomType, setAssignRoomType] = useState<Room["roomType"] | "">("")
  const [assignRoomId, setAssignRoomId] = useState("")
  const [assignNotes, setAssignNotes] = useState("")
  const [assignLoading, setAssignLoading] = useState(false)
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null)
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [admissionsLoading, setAdmissionsLoading] = useState(false)
  const [admissionsError, setAdmissionsError] = useState<string | null>(null)
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false)
  const [dischargeDoctorFee, setDischargeDoctorFee] = useState("")
  const [dischargeOtherCharges, setDischargeOtherCharges] = useState("")
  const [dischargeOtherDescription, setDischargeOtherDescription] = useState("")
  const [dischargeNotes, setDischargeNotes] = useState("")
  const [dischargeLoading, setDischargeLoading] = useState(false)
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [billingSearchTerm, setBillingSearchTerm] = useState("")
  const [billingPaymentModalOpen, setBillingPaymentModalOpen] = useState(false)
  const [selectedBillingRecord, setSelectedBillingRecord] = useState<BillingRecord | null>(null)
  const [billingPaymentMethod, setBillingPaymentMethod] = useState<RPaymentMethod>("cash")
  const [billingPaymentData, setBillingPaymentData] = useState<RPaymentData>({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    upiId: "",
  })
  const [processingBillingPayment, setProcessingBillingPayment] = useState(false)
  const suggestedDoctors = useMemo(()=>{
    if (!symptomCategory || symptomCategory === 'custom') return doctors
    const category = SYMPTOM_CATEGORIES.find(c=>c.id===symptomCategory)
    if (!category) return doctors
    const specs = category.relatedSpecializations.map(s=>s.toLowerCase())
    const filtered = doctors.filter((d:any)=> specs.some(spec=> String(d.specialization||'').toLowerCase().includes(spec)))
    return filtered.length ? filtered : doctors
  }, [symptomCategory, doctors])
  const filteredPatients = useMemo(()=>{
    if (!searchPatient) return patients
    const s = searchPatient.toLowerCase()
    return patients.filter((p:any)=>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.phone?.toLowerCase().includes(s) ||
      (p.patientId ? String(p.patientId).toLowerCase().includes(s) : false)
    )
  }, [patients, searchPatient])
  const availableRoomTypes = useMemo(() => {
    const types = new Set<Room["roomType"]>()
    rooms.forEach(room => {
      if (room?.roomType) {
        types.add(room.roomType)
      }
    })
    return Array.from(types)
  }, [rooms])
  const availableRoomsForType = useMemo(() => {
    return rooms.filter(room => {
      if (room.status !== "available") return false
      if (!assignRoomType) return true
      return room.roomType === assignRoomType
    })
  }, [rooms, assignRoomType])
  const roomTypeLabelMap: Record<Room["roomType"], string> = {
    general: "General Ward",
    simple: "Simple Room",
    deluxe: "Deluxe Room",
    vip: "VIP Room"
  }

  const fetchAdmitRequests = async () => {
    try {
      setAdmitRequestsLoading(true)
      setAdmitRequestsError(null)
      const res = await fetch("/api/receptionist/admission-requests")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load admit requests")
      }
      const data = await res.json().catch(() => ({}))
      const requests = Array.isArray(data?.requests) ? data.requests : []
      const formatted: AdmissionRequest[] = requests.map((req: any) => ({
        id: String(req.id || ""),
        appointmentId: String(req.appointmentId || ""),
        patientUid: String(req.patientUid || ""),
        patientId: req.patientId || undefined,
        patientName: req.patientName || null,
        doctorId: String(req.doctorId || ""),
        doctorName: req.doctorName || undefined,
        notes: req.notes ?? null,
        status: req.status || "pending",
        createdAt: req.createdAt || new Date().toISOString(),
        updatedAt: req.updatedAt,
        cancelledAt: req.cancelledAt,
        cancelledBy: req.cancelledBy,
        appointmentDetails: req.appointmentDetails || null
      }))
      setAdmitRequests(formatted.filter((req) => req.status === "pending"))
    } catch (error: any) {
      console.error("Failed to load admission requests", error)
      setAdmitRequestsError(error?.message || "Failed to load admission requests")
    } finally {
      setAdmitRequestsLoading(false)
    }
  }

  const fetchAdmissions = async () => {
    try {
      setAdmissionsLoading(true)
      setAdmissionsError(null)
      const res = await fetch("/api/receptionist/admissions?status=admitted")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load admissions")
      }
      const data = await res.json().catch(() => ({}))
      const items = Array.isArray(data?.admissions) ? data.admissions : []
      const formatted: Admission[] = items.map((item: any) => ({
        id: String(item.id || ""),
        appointmentId: String(item.appointmentId || ""),
        patientUid: String(item.patientUid || ""),
        patientId: item.patientId || undefined,
        patientName: item.patientName || null,
        doctorId: String(item.doctorId || ""),
        doctorName: item.doctorName || null,
        roomId: String(item.roomId || ""),
        roomNumber: item.roomNumber || "",
        roomType: item.roomType || "general",
        roomRatePerDay: Number(item.roomRatePerDay || 0),
        status: item.status || "admitted",
        checkInAt: item.checkInAt || new Date().toISOString(),
        checkOutAt: item.checkOutAt || null,
        notes: item.notes || null,
        createdBy: item.createdBy || "receptionist",
        createdAt: item.createdAt || item.checkInAt || new Date().toISOString(),
        updatedAt: item.updatedAt,
        billingId: item.billingId || null,
        appointmentDetails: item.appointmentDetails || null
      }))
      setAdmissions(formatted.filter(admission => admission.status === "admitted"))
    } catch (error: any) {
      console.error("Failed to load admissions", error)
      setAdmissionsError(error?.message || "Failed to load admissions")
    } finally {
      setAdmissionsLoading(false)
    }
  }

  const fetchBillingRecords = async () => {
    try {
      setBillingLoading(true)
      setBillingError(null)
      const res = await fetch("/api/receptionist/billing-records")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load billing records")
      }
      const data = await res.json().catch(() => ({}))
      const records = Array.isArray(data?.records) ? data.records : []
      const formatted: BillingRecord[] = records.map((record: any) => ({
        id: String(record.id || ""),
        admissionId: String(record.admissionId || ""),
        appointmentId: record.appointmentId ? String(record.appointmentId) : undefined,
        patientId: String(record.patientId || ""),
        patientUid: record.patientUid || null,
        patientName: record.patientName || null,
        doctorId: String(record.doctorId || ""),
        doctorName: record.doctorName || null,
        roomCharges: Number(record.roomCharges || 0),
        doctorFee: record.doctorFee !== undefined ? Number(record.doctorFee) : undefined,
        otherServices: Array.isArray(record.otherServices) ? record.otherServices : [],
        totalAmount: Number(record.totalAmount || 0),
        generatedAt: record.generatedAt || new Date().toISOString(),
        status: record.status || "pending",
      }))
      setBillingRecords(formatted)
    } catch (error: any) {
      console.error("Failed to load billing records", error)
      setBillingError(error?.message || "Failed to load billing records")
    } finally {
      setBillingLoading(false)
    }
  }

  const handleOpenAssignModal = (request: AdmissionRequest) => {
    setSelectedAdmitRequest(request)
    const defaultType =
      rooms.find(room => room.status === "available")?.roomType || ""
    setAssignRoomType(defaultType)
    setAssignRoomId("")
    setAssignNotes("")
    setAssignModalOpen(true)
  }

  const handleCloseAssignModal = () => {
    setAssignModalOpen(false)
    setSelectedAdmitRequest(null)
    setAssignRoomId("")
    setAssignNotes("")
  }

  const handleAssignRoom = async () => {
    if (!selectedAdmitRequest) return
    if (!assignRoomId) {
      setNotification({ type: "error", message: "Select a room to assign." })
      return
    }
    setAssignLoading(true)
    try {
      const res = await fetch(`/api/receptionist/admission-request/${selectedAdmitRequest.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: assignRoomId,
          notes: assignNotes.trim() ? assignNotes.trim() : undefined
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to assign room")
      }
      setNotification({ type: "success", message: "Patient admitted successfully." })
      setAdmitRequests(prev => prev.filter(req => req.id !== selectedAdmitRequest.id))
      setRooms(prev =>
        prev.map(room =>
          room.id === assignRoomId ? { ...room, status: "occupied" } : room
        )
      )
      fetchAdmissions()
      setAssignModalOpen(false)
      setSelectedAdmitRequest(null)
    } catch (error: any) {
      console.error("Assign room error", error)
      setNotification({ type: "error", message: error?.message || "Failed to assign room" })
    } finally {
      setAssignLoading(false)
    }
  }

  const handleCancelAdmitRequest = async (request: AdmissionRequest) => {
    const confirmation = window.confirm("Cancel this admission request? The appointment will be marked as completed.")
    if (!confirmation) return
    const cancelReason = window.prompt("Optional: add a cancellation note for history.") || undefined
    setCancelLoadingId(request.id)
    try {
      const res = await fetch(`/api/receptionist/admission-request/${request.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason && cancelReason.trim() ? cancelReason.trim() : undefined
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to cancel admission request")
      }
      setAdmitRequests(prev => prev.filter(req => req.id !== request.id))
      setNotification({ type: "success", message: "Admission request cancelled." })
    } catch (error: any) {
      console.error("Cancel admission request error", error)
      setNotification({ type: "error", message: error?.message || "Failed to cancel admission request" })
    } finally {
      setCancelLoadingId(null)
    }
  }

  const handleOpenDischargeModal = (admission: Admission) => {
    setSelectedAdmission(admission)
    setDischargeDoctorFee("")
    setDischargeOtherCharges("")
    setDischargeOtherDescription("")
    setDischargeNotes("")
    setDischargeModalOpen(true)
  }

  const handleCloseDischargeModal = () => {
    setDischargeModalOpen(false)
    setSelectedAdmission(null)
  }

  const handleDischarge = async () => {
    if (!selectedAdmission) return
    setDischargeLoading(true)
    try {
      const res = await fetch(`/api/receptionist/admissions/${selectedAdmission.id}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorFee: dischargeDoctorFee ? Number(dischargeDoctorFee) : undefined,
          otherCharges: dischargeOtherCharges ? Number(dischargeOtherCharges) : undefined,
          otherDescription: dischargeOtherDescription?.trim() || undefined,
          notes: dischargeNotes?.trim() || undefined
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to discharge patient")
      }
      const data = await res.json().catch(() => ({}))
      setNotification({
        type: "success",
        message: `Patient discharged. Total bill ₹${data?.totalAmount ?? ""}`
      })
      setAdmissions(prev => prev.filter(admission => admission.id !== selectedAdmission.id))
      setRooms(prev =>
        prev.map(room =>
          room.id === selectedAdmission.roomId ? { ...room, status: "available" } : room
        )
      )
      handleCloseDischargeModal()
      fetchBillingRecords()
    } catch (error: any) {
      console.error("Discharge error", error)
      setNotification({ type: "error", message: error?.message || "Failed to discharge patient" })
    } finally {
      setDischargeLoading(false)
    }
  }

  const billingSearchValue = billingSearchTerm.trim().toLowerCase()
  const filteredBillingRecords = billingRecords.filter((record) => {
    if (!billingSearchValue) return true
    const idMatch = record.patientId?.toLowerCase().includes(billingSearchValue)
    const nameMatch = record.patientName
      ? record.patientName.toLowerCase().includes(billingSearchValue)
      : false
    const billingIdMatch = record.id.toLowerCase().includes(billingSearchValue)
    return idMatch || nameMatch || billingIdMatch
  })

  const handleOpenBillingPayment = (record: BillingRecord) => {
    if (record.status === "paid") return
    setSelectedBillingRecord(record)
    setBillingPaymentMethod(
      record.paymentMethod && record.paymentMethod !== "demo"
        ? (record.paymentMethod as RPaymentMethod)
        : "cash"
    )
    setBillingPaymentData({
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
      upiId: "",
    })
    setBillingPaymentModalOpen(true)
  }

  const handleCloseBillingPayment = () => {
    setBillingPaymentModalOpen(false)
    setSelectedBillingRecord(null)
    setBillingPaymentMethod("cash")
    setBillingPaymentData({
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
      upiId: "",
    })
    setProcessingBillingPayment(false)
  }

  const handleConfirmBillingPayment = async () => {
    if (!selectedBillingRecord) return
    setProcessingBillingPayment(true)
    try {
      const res = await fetch("/api/patient/billing/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingId: selectedBillingRecord.id,
          paymentMethod: billingPaymentMethod,
          actor: "receptionist"
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to record payment")
      }
      const data = await res.json().catch(() => ({}))
      setBillingRecords(prev =>
        prev.map((record) =>
          record.id === selectedBillingRecord.id
            ? {
                ...record,
                status: "paid",
                paymentMethod: data?.paymentMethod || billingPaymentMethod,
                paidAt: data?.paidAt || new Date().toISOString(),
                paymentReference: data?.paymentReference || record.paymentReference || null,
                paidAtFrontDesk: true,
                handledBy: "receptionist",
                settlementMode: billingPaymentMethod
              }
            : record
        )
      )
      setNotification({
        type: "success",
        message: "Payment recorded successfully."
      })
      handleCloseBillingPayment()
    } catch (error: any) {
      console.error("Receptionist billing payment error", error)
      setNotification({
        type: "error",
        message: error?.message || "Failed to record payment."
      })
      setProcessingBillingPayment(false)
    }
  }

  // Reset relevant form fields when switching between Existing/New patient modes
  useEffect(() => {
    if (activeTab !== 'book-appointment') return
    if (patientMode === 'existing') {
      setNewPatient({ firstName:'', lastName:'', email:'', phone:'', gender:'', bloodGroup:'', dateOfBirth:'', address:'' })
      setNewPatientPassword('')
      setNewPatientPasswordConfirm('')
    } else {
      setSearchPatient('')
      setSelectedPatientId('')
    }
  }, [patientMode, activeTab])

  // Load selected patient profile when an existing patient is chosen
  useEffect(() => {
    const load = async () => {
      setSelectedPatientInfo(null)
      setPatientInfoError(null)
      if (activeTab !== 'book-appointment') return
      if (patientMode !== 'existing') return
      if (!selectedPatientId) return
      try {
        setPatientInfoLoading(true)
        const snap = await getDoc(doc(db, 'patients', selectedPatientId))
        if (snap.exists()) {
          setSelectedPatientInfo({ id: snap.id, ...snap.data() })
        } else {
          setPatientInfoError('Patient not found')
        }
      } catch (e:any) {
        setPatientInfoError(e?.message || 'Failed to load patient')
      } finally {
        setPatientInfoLoading(false)
      }
    }
    load()
  }, [selectedPatientId, patientMode, activeTab])

  // Payment amount is always full fee for receptionist bookings
  const paymentAmount = useMemo(() => {
    return selectedDoctorFee || 0
  }, [selectedDoctorFee])

  // Protect route - only allow receptionists
  const { user, loading: authLoading } = useAuth("receptionist")
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const recepDoc = await getDoc(doc(db, "receptionists", user.uid))
        if (recepDoc.exists()) {
          const data = recepDoc.data() as any
          setUserName(data.firstName || "Receptionist")
        } else {
          setUserName("Receptionist")
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Prefetch lists for booking (doctors realtime, patients one-time)
  useEffect(()=>{
    const drQ = query(collection(db,'doctors'), where('status','==','active'))
    const unsubscribe = onSnapshot(drQ, (snap)=>{
      setDoctors(snap.docs.map(d=>({ id:d.id, ...d.data() })))
    })
    ;(async ()=>{
      try {
        setRoomsLoading(true)
        const ptQ = query(collection(db,'patients'), where('status','in',['active','inactive']))
        const ptSnap = await getDocs(ptQ)
        setPatients(ptSnap.docs.map(d=>({ id:d.id, ...d.data() })))
        let roomsSnap = await getDocs(collection(db, 'rooms'))
        if (roomsSnap.empty) {
          await fetch('/api/admin/rooms/seed', { method: 'POST' })
          roomsSnap = await getDocs(collection(db, 'rooms'))
        }
        let roomsList = roomsSnap.docs.map(r => {
          const data = r.data() as Omit<Room, "id"> & Partial<Room>
          return { ...data, id: r.id } as Room
        })
        if (roomsList.length === 0) {
          roomsList = [
            { id: "demo-101", roomNumber: "101", roomType: "general", ratePerDay: 1500, status: "available" },
            { id: "demo-102", roomNumber: "102", roomType: "general", ratePerDay: 1500, status: "available" },
            { id: "demo-201", roomNumber: "201", roomType: "simple", ratePerDay: 2500, status: "available" },
            { id: "demo-202", roomNumber: "202", roomType: "simple", ratePerDay: 2500, status: "available" },
            { id: "demo-301", roomNumber: "301", roomType: "deluxe", ratePerDay: 4000, status: "available" },
            { id: "demo-401", roomNumber: "401", roomType: "vip", ratePerDay: 6500, status: "available" },
          ]
        }
        setRooms(roomsList)
      } catch (_) {}
       finally {
        setRoomsLoading(false)
       }
    })()
    return () => unsubscribe()
  }, [])

  // Auto-fade and clear booking error after 5s
  useEffect(() => {
    if (!bookError) return
    setBookErrorFade(false)
    const fadeTimer = setTimeout(() => setBookErrorFade(true), 4000)
    const clearTimer = setTimeout(() => setBookError(null), 5000)
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer) }
  }, [bookError])

  useEffect(() => {
    if (activeTab === "admit-requests") {
      fetchAdmitRequests()
      fetchAdmissions()
      fetchBillingRecords()
    }
  }, [activeTab])

  // Recompute available slots when doctor or date changes
  useEffect(()=>{
    const compute = async () => {
      setAvailableSlots([])
      setAppointmentTime('')
      if (!selectedDoctorId || !appointmentDate) return
      // doctor object
      const doctor = doctors.find((d:any)=>d.id===selectedDoctorId) || {}
      // If selected date is blocked, no slots
      const rawBlocked: any[] = Array.isArray((doctor as any)?.blockedDates) ? (doctor as any).blockedDates : []
      const blockedNorm: string[] = rawBlocked
        .map((b: any) => {
          if (!b) return ""
          if (typeof b === "string") return b.slice(0, 10)
          if (typeof b === "object" && typeof b.date === "string") return String(b.date).slice(0, 10)
          if (b?.toDate) { const dt = b.toDate() as Date; const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, "0"); const d = String(dt.getDate()).padStart(2, "0"); return `${y}-${m}-${d}` }
          if (b?.seconds) { const dt = new Date(b.seconds * 1000); const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, "0"); const d = String(dt.getDate()).padStart(2, "0"); return `${y}-${m}-${d}` }
          return ""
        })
        .filter(Boolean)
      if (blockedNorm.includes(appointmentDate)) {
        setAvailableSlots([])
        return
      }

      // fetch appointments for that doctor/date
      try {
        const aptQ = query(collection(db,'appointments'), where('doctorId','==', selectedDoctorId), where('appointmentDate','==', appointmentDate))
        const aptSnap = await getDocs(aptQ)
        const existing = aptSnap.docs.map(d=>({ id:d.id, ...(d.data() as any) }))
        const dateObj = new Date(`${appointmentDate}T00:00:00`)
        const slots = getAvailableTimeSlots(doctor as any, dateObj, existing as any)
        const filtered = slots.filter(s=>!isSlotInPast(s, appointmentDate))
        setAvailableSlots(filtered)
      } catch(_e){
        setAvailableSlots([])
      }
    }
    compute()
  }, [selectedDoctorId, appointmentDate, doctors])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.replace("/auth/login?role=receptionist")
    } catch {
      setNotification({ type: "error", message: "Failed to logout. Please try again." })
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading receptionist dashboard..." />
  }

  if (!user) return null

    return (
    <div className="min-h-screen bg-gray-50">
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white p-2.5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition-all duration-200"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5">
            <span className="block w-4 h-0.5 bg-gray-600"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
          </div>
        </button>
      )}

      {sidebarOpen && (<div className="fixed inset-0" onClick={() => setSidebarOpen(false)} />)}

      {/* Sidebar (same style as admin) */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">H</span>
            </div>
            <h1 className="text-white text-xl font-bold">HMS Receptionist</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-white hover:text-purple-200 transition-colors p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="mt-8 px-4">
          <div className="space-y-2">
            <button onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "patients" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Patients
            </button>
            <button onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "doctors" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Doctors
            </button>
            <button onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "appointments" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Appointments
            </button>
            <button onClick={() => { setActiveTab("admit-requests"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "admit-requests" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14z" /></svg>
              Admit Requests
            </button>
            <button onClick={() => { if (!bookSubOpen){ setActiveTab("book-appointment") }; setBookSubOpen(!bookSubOpen) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "book-appointment" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Book Appointment
            </button>
            {bookSubOpen && (
              <div className="ml-6 pl-3 mt-1 mb-2 space-y-1 border-l border-gray-200">
                <button
                  onClick={() => { setActiveTab("book-appointment"); setPatientMode('existing'); setSidebarOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'book-appointment' && patientMode==='existing' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >Existing Patient</button>
                <button
                  onClick={() => { setActiveTab("book-appointment"); setPatientMode('new'); setSidebarOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'book-appointment' && patientMode==='new' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >New Patient</button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Main Content (same container and header classes) */}
      <div className="lg:ml-64">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
                  {activeTab === "patients"
                    ? "Patient Management"
                    : activeTab === "doctors"
                    ? "Doctor Management"
                    : activeTab === "appointments"
                    ? "Appointment Management"
                    : activeTab === "admit-requests"
                    ? "Admit Requests"
                    : "Book Appointment"}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  {activeTab === "patients"
                    ? "Manage patient records and information"
                    : activeTab === "doctors"
                    ? "Manage doctor profiles and schedules"
                    : activeTab === "appointments"
                    ? "Monitor and manage all appointments"
                    : activeTab === "admit-requests"
                    ? "Review hospitalization requests and assign rooms"
                    : "Book a new appointment for a patient"}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <button className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base" onClick={() => setNotification({ type: 'success', message: 'Refreshed!' })}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <div className="relative">
                  <button onClick={() => setShowUserDropdown(!showUserDropdown)} className="flex items-center gap-2 sm:gap-3 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center"><span className="text-purple-600 font-semibold text-sm">{userName.charAt(0)}</span></div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">Receptionist</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showUserDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">{userName}</p>
                </div>
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          <span>Logout</span>
                        </button>
            </div>
                    </>
                  )}
        </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {activeTab === "patients" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Management</h2>
              <PatientManagement canDelete={true} disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "doctors" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Doctor Management</h2>
              <DoctorManagement canDelete={false} canAdd={false} disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "appointments" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Appointment Management</h2>
              <AppoinmentManagement disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "admit-requests" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Pending Admit Requests</h2>
                  <p className="text-sm text-gray-500">Review hospitalization requests sent by doctors</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchAdmitRequests}
                    disabled={admitRequestsLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    {admitRequestsLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </>
                    )}
                  </button>
                </div>
              </div>

              {admitRequestsError && (
                <div className="p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700">
                  {admitRequestsError}
                </div>
              )}

              {admitRequestsLoading && admitRequests.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading admit requests...
                </div>
              ) : admitRequests.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <span className="text-4xl mb-2 block">🏥</span>
                  No pending admit requests right now.
                </div>
              ) : (
                <div className="space-y-4">
                  {admitRequests.map((request) => (
                    <div key={request.id} className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-white hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs uppercase text-gray-500">Patient</p>
                            <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                              {request.patientName || "Unknown"}
                              {request.patientId && (
                                <span className="text-[11px] font-mono px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                                  {request.patientId}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                            <div>
                              <span className="text-xs uppercase text-gray-500 block">Doctor</span>
                              <span className="font-medium">{request.doctorName || "Unknown Doctor"}</span>
                            </div>
                            <div>
                              <span className="text-xs uppercase text-gray-500 block">Created</span>
                              <span>{request.createdAt ? new Date(request.createdAt).toLocaleString() : "—"}</span>
                            </div>
                            {request.notes && (
                              <div className="sm:col-span-2">
                                <span className="text-xs uppercase text-gray-500 block">Doctor Notes</span>
                                <span>{request.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:w-40">
                          <button
                            onClick={() => handleOpenAssignModal(request)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                          >
                            Assign Room
                          </button>
                          <button
                            onClick={() => handleCancelAdmitRequest(request)}
                            disabled={cancelLoadingId === request.id}
                            className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            {cancelLoadingId === request.id ? "Cancelling..." : "Cancel Request"}
                          </button>
                        </div>
                      </div>
                      {request.appointmentDetails && (
                        <div className="mt-4 border-t border-dashed border-gray-200 pt-3 text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <span className="block font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Appointment</span>
                            <span>{request.appointmentDetails.appointmentDate || "—"} {request.appointmentDetails.appointmentTime || ""}</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Patient Phone</span>
                            <span>{request.appointmentDetails.patientPhone || "—"}</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Doctor Specialization</span>
                            <span>{request.appointmentDetails.doctorSpecialization || "—"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Currently Admitted Patients</h3>
                    <p className="text-sm text-gray-500">Manage inpatients and discharge when ready</p>
                  </div>
                  <button
                    onClick={fetchAdmissions}
                    disabled={admissionsLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    {admissionsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {admissionsError && (
                  <div className="p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700 mb-4">
                    {admissionsError}
                  </div>
                )}

                {admissionsLoading && admissions.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Loading admitted patients...
                  </div>
                ) : admissions.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <span className="text-4xl mb-2 block">🛏️</span>
                    No patients are currently admitted.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {admissions.map((admission) => {
                      const stayStart = admission.checkInAt ? new Date(admission.checkInAt) : null
                      const stayDays = stayStart ? Math.max(1, Math.ceil((Date.now() - stayStart.getTime()) / (1000 * 60 * 60 * 24))) : 1
                      return (
                        <div key={admission.id} className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-white hover:shadow-md transition-shadow">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs uppercase text-gray-500">Patient</p>
                                <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                  {admission.patientName || "Unknown"}
                                  {admission.patientId && (
                                    <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                                      {admission.patientId}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                                <div>
                                  <span className="text-xs uppercase text-gray-500 block">Doctor</span>
                                  <span className="font-medium">{admission.doctorName || "Unknown"}</span>
                                </div>
                                <div>
                                  <span className="text-xs uppercase text-gray-500 block">Room</span>
                                  <span className="font-medium">
                                    {admission.roomNumber} — {roomTypeLabelMap[admission.roomType as Room["roomType"]] || admission.roomType}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs uppercase text-gray-500 block">Rate / Day</span>
                                  <span>₹{admission.roomRatePerDay}</span>
                                </div>
                                <div>
                                  <span className="text-xs uppercase text-gray-500 block">Check-in</span>
                                  <span>{admission.checkInAt ? new Date(admission.checkInAt).toLocaleString() : "—"}</span>
                                </div>
                                <div>
                                  <span className="text-xs uppercase text-gray-500 block">Stay Duration</span>
                                  <span>{stayDays} day(s)</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:w-40">
                              <button
                                onClick={() => handleOpenDischargeModal(admission)}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                              >
                                Discharge
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Recent Billing History</h3>
                    <p className="text-sm text-gray-500">Latest hospitalization bills generated during discharge</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative sm:w-72">
                      <input
                        type="text"
                        value={billingSearchTerm}
                        onChange={(e) => setBillingSearchTerm(e.target.value)}
                        placeholder="Search bills by patient name or ID"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                      />
                      {billingSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setBillingSearchTerm("")}
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={fetchBillingRecords}
                      disabled={billingLoading}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm"
                    >
                      {billingLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                </div>

                {billingError && (
                  <div className="p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700 mb-4">
                    {billingError}
                  </div>
                )}

                {billingLoading && billingRecords.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Loading billing history...
                  </div>
                ) : billingRecords.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Billing records will appear after discharges are completed.
                  </div>
                ) : filteredBillingRecords.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No billing records match your search.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Generated</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Admission</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Patient</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Room Charges</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Doctor Fee</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Other Services</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredBillingRecords.map((record) => (
                          <tr key={record.id}>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              {record.generatedAt ? new Date(record.generatedAt).toLocaleString() : "—"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700 font-mono">
                              {record.admissionId}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {record.patientName || "Unknown"}
                                </span>
                                <span className="text-xs font-mono text-slate-500">
                                  ID: {record.patientId || "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              ₹{record.roomCharges}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              ₹{record.doctorFee || 0}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-700">
                              {record.otherServices && record.otherServices.length > 0
                                ? record.otherServices.map((service, idx) => (
                                    <div key={idx}>
                                      ₹{service.amount} — {service.description}
                                    </div>
                                  ))
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 font-semibold">
                              ₹{record.totalAmount}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                                      record.status === "paid"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : record.status === "void"
                                        ? "bg-rose-100 text-rose-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {record.status === "paid" ? "Paid" : record.status === "void" ? "Voided" : "Pending"}
                                    {record.paymentMethod && record.status === "paid" && (
                                      <span className="capitalize text-[11px]">
                                        · {record.paymentMethod}
                                      </span>
                                    )}
                                  </span>
                                  {record.status !== "paid" && (
                                    <button
                                      onClick={() => handleOpenBillingPayment(record)}
                                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                    >
                                      Record Payment
                                    </button>
                                  )}
                                </div>
                                {record.paidAt && (
                                  <span className="text-[11px] text-slate-400">
                                    {new Date(record.paidAt).toLocaleString()}
                                  </span>
                                )}
                                {record.paidAtFrontDesk && record.status === "paid" && (
                                  <span className="text-[11px] text-emerald-600">
                                    Settled at front desk
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "book-appointment" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Book Appointment — {patientMode==='existing' ? 'Existing Patient' : 'New Patient'}</h2>
              <div className="space-y-6">
                {bookError && (
                  <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded transition-opacity duration-1000 ease-out ${bookErrorFade ? 'opacity-0' : 'opacity-100'}`}>
                    {bookError}
                  </div>
                )}
                <div>
                  {patientMode === 'existing' ? (
                    <div className="relative">
                      <input
                        value={searchPatient}
                        onChange={(e)=>{
                          const val = e.target.value
                          const valLower = val.toLowerCase()
                          setSearchPatient(val)
                          setShowPatientSuggestions(val.trim().length > 0)
                          const match = patients.find((p:any)=>{
                            const label = `${p.firstName} ${p.lastName} — ${p.email}`
                            if (label.toLowerCase() === valLower) return true
                            if (p.patientId && String(p.patientId).toLowerCase() === valLower) return true
                            return false
                          })
                          setSelectedPatientId(match ? match.id : '')
                        }}
                        placeholder="Search patient by name, email, phone, or patient ID"
                        className="w-full px-3 py-2 border rounded"
                      />
                      {showPatientSuggestions && searchPatient.trim().length > 0 && (
                        <div
                          className="absolute z-10 mt-1 w-full bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-lg max-h-64 overflow-auto"
                          onMouseDown={(e)=>e.preventDefault()}
                          onBlur={()=>setShowPatientSuggestions(false)}
                        >
                          {filteredPatients.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                          ) : (
                            filteredPatients.slice(0, 10).map((p:any)=>{
                              const label = `${p.firstName} ${p.lastName} — ${p.email}`
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                  onClick={()=>{
                                    setSelectedPatientId(p.id)
                                    setSearchPatient(label)
                                    setShowPatientSuggestions(false)
                                  }}
                                >
                                  <div className="font-medium text-gray-900">{p.firstName} {p.lastName}</div>
                                  <div className="text-xs text-gray-600">{p.email}{p.phone ? ` • ${p.phone}` : ''}</div>
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
                      <input placeholder="First name" className="px-3 py-2 border rounded" value={newPatient.firstName} onChange={(e)=>setNewPatient(v=>({...v, firstName:e.target.value}))} />
                      <input placeholder="Last name" className="px-3 py-2 border rounded" value={newPatient.lastName} onChange={(e)=>setNewPatient(v=>({...v, lastName:e.target.value}))} />
                      <input placeholder="Email" type="email" className="px-3 py-2 border rounded" value={newPatient.email} onChange={(e)=>setNewPatient(v=>({...v, email:e.target.value}))} />
                      <input placeholder="Phone" className="px-3 py-2 border rounded" value={newPatient.phone} onChange={(e)=>setNewPatient(v=>({...v, phone:e.target.value}))} />
                      <div className="sm:col-span-1">
                        <input placeholder="Password" type="password" className="w-full px-3 py-2 border rounded" value={newPatientPassword} onChange={(e)=>setNewPatientPassword(e.target.value)} />
                        <PasswordRequirements password={newPatientPassword} />
                      </div>
                      <input placeholder="Confirm Password" type="password" className="px-3 py-2 border rounded" value={newPatientPasswordConfirm} onChange={(e)=>setNewPatientPasswordConfirm(e.target.value)} />
                      <select className="px-3 py-2 border rounded" value={newPatient.gender} onChange={(e)=>setNewPatient(v=>({...v, gender:e.target.value}))}>
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <select className="px-3 py-2 border rounded" value={newPatient.bloodGroup} onChange={(e)=>setNewPatient(v=>({...v, bloodGroup:e.target.value}))}>
                        <option value="">Blood group</option>
                        {bloodGroups.map(bg => (<option key={bg} value={bg}>{bg}</option>))}
                      </select>
                      <div className="flex flex-col space-y-1">
                        <label className="text-xs font-semibold text-gray-600">Birthday</label>
                        <input type="date" className="px-3 py-2 border rounded" max={todayStr} value={newPatient.dateOfBirth} onChange={(e)=>setNewPatient(v=>({...v, dateOfBirth:e.target.value}))} />
                      </div>
                      <input placeholder="Address" className="px-3 py-2 border rounded sm:col-span-2" value={newPatient.address} onChange={(e)=>setNewPatient(v=>({...v, address:e.target.value}))} />
                    </div>
                  )}
                </div>

                {/* Selected patient summary (placed right after search box) */}
                {patientMode === 'existing' && selectedPatientId && (
                  <div className="mt-3">
                    {patientInfoLoading && (
                      <div className="text-xs text-gray-500">Loading patient details…</div>
                    )}
                    {patientInfoError && (
                      <div className="text-xs text-red-600">{patientInfoError}</div>
                    )}
                    {selectedPatientInfo && !patientInfoLoading && !patientInfoError && (
                      <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-gray-900">{selectedPatientInfo.firstName} {selectedPatientInfo.lastName}</div>
                          {selectedPatientInfo.bloodGroup && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">{selectedPatientInfo.bloodGroup}</span>
                          )}
                        </div>
                        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                          <div><span className="text-xs text-gray-500">Email:</span> {selectedPatientInfo.email || '—'}</div>
                          <div><span className="text-xs text-gray-500">Phone:</span> {selectedPatientInfo.phone || '—'}</div>
                          <div><span className="text-xs text-gray-500">Patient ID:</span> {selectedPatientInfo.patientId || '—'}</div>
                          <div><span className="text-xs text-gray-500">Gender:</span> {selectedPatientInfo.gender || '—'}</div>
                          <div><span className="text-xs text-gray-500">DOB:</span> {selectedPatientInfo.dateOfBirth || '—'}</div>
                          {selectedPatientInfo.address && (
                            <div className="sm:col-span-2"><span className="text-xs text-gray-500">Address:</span> {selectedPatientInfo.address}</div>
                          )}
                          {(selectedPatientInfo.allergies || selectedPatientInfo.currentMedications) && (
                            <div className="sm:col-span-2 flex flex-col gap-1">
                              {selectedPatientInfo.allergies && <div><span className="text-xs text-gray-500">Allergies:</span> {selectedPatientInfo.allergies}</div>}
                              {selectedPatientInfo.currentMedications && <div><span className="text-xs text-gray-500">Medications:</span> {selectedPatientInfo.currentMedications}</div>}
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
                    <select value={symptomCategory} onChange={(e)=>{ setSymptomCategory(e.target.value); setSelectedDoctorId(''); setSelectedDoctorFee(null); if (e.target.value !== 'custom') setCustomSymptom('') }} className="w-full px-3 py-2 border rounded">
                      <option value="">Select symptoms (optional)</option>
                      {SYMPTOM_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                    {symptomCategory === 'custom' && (
                      <div className="mt-2">
                        <input
                          value={customSymptom}
                          onChange={(e)=>setCustomSymptom(e.target.value)}
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
                      onChange={(e)=>{
                        const doctorId = e.target.value
                        setSelectedDoctorId(doctorId)
                        // Fetch and set consultation fee when doctor is selected
                        const selectedDoctor = doctors.find((d:any)=>d.id===doctorId)
                        setSelectedDoctorFee(selectedDoctor?.consultationFee || null)
                      }} 
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">Select doctor</option>
                      {suggestedDoctors.map((d:any)=>(
                        <option key={d.id} value={d.id}>{d.firstName} {d.lastName} — {d.specialization}</option>
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
                    <input type="date" min={todayStr} value={appointmentDate} onChange={(e)=>setAppointmentDate(e.target.value)} className={`w-full px-3 py-2 border rounded ${isSelectedDateBlocked ? 'border-red-400 bg-red-50' : ''}`} />
                    {isSelectedDateBlocked && (
                      <p className="text-xs text-red-600 mt-1">Doctor is not available on this date.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Available Time</label>
                    <select value={appointmentTime} onChange={(e)=>setAppointmentTime(e.target.value)} className="w-full px-3 py-2 border rounded" disabled={!selectedDoctorId || !appointmentDate || isSelectedDateBlocked}>
                      <option value="">{!selectedDoctorId || !appointmentDate ? 'Select doctor and date first' : isSelectedDateBlocked ? 'Doctor not available on selected date' : (availableSlots.length ? 'Select time' : 'No slots available')}</option>
                      {availableSlots.map(s => (
                        <option key={s} value={s}>{formatTimeDisplay(s)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Payment Mode Selection (reusable) */}
                {selectedDoctorFee !== null && (
                  <PaymentMethodSection
                    paymentMethod={paymentMethod}
                    setPaymentMethod={(m)=>setPaymentMethod(m)}
                    paymentData={paymentData as RPaymentData}
                    setPaymentData={(d)=>setPaymentData(d as any)}
                    amountToPay={paymentAmount}
                    title="Payment Mode"
                  />
                )}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button disabled={bookLoading} onClick={async()=>{
                  try{
                    setBookLoading(true); setBookError(null)
                    if (!selectedDoctorId){ setBookError('Please select a doctor'); setBookLoading(false); return }
                    if (!appointmentDate || !appointmentTime){ setBookError('Please select date and time'); setBookLoading(false); return }
                    if (!availableSlots.includes(appointmentTime)) { setBookError('Selected time is not available'); setBookLoading(false); return }
                    if (isSelectedDateBlocked) { setBookError('Doctor is not available on the selected date'); setBookLoading(false); return }
                    if (!paymentMethod){ setBookError('Please select a payment method'); setBookLoading(false); return }
                    if (paymentMethod === 'card') {
                      if (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiryDate || !paymentData.cvv) {
                        setBookError('Enter complete card details'); setBookLoading(false); return
                      }
                    }
                    if (paymentMethod === 'upi') {
                      if (!paymentData.upiId) { setBookError('Enter UPI ID'); setBookLoading(false); return }
                    }
                    let patientId = selectedPatientId
                    let patientPayload:any = null
                    if (patientMode==='new'){
                      if (!newPatient.firstName || !newPatient.lastName || !newPatient.email){ setBookError('Fill first name, last name, email'); setBookLoading(false); return }
                      if (!isPasswordValid(newPatientPassword)) { setBookError('Password does not meet requirements'); setBookLoading(false); return }
                      if (newPatientPassword !== newPatientPasswordConfirm){ setBookError('Passwords do not match'); setBookLoading(false); return }
                      if ((newPatient.phone||'').trim()) { setOtpModalOpen(true); setBookLoading(false); return }
                      const res = await fetch('/api/receptionist/create-patient', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patientData: { ...newPatient, status:'active', createdBy:'receptionist', createdAt: new Date().toISOString() }, password: newPatientPassword }) })
                      if (!res.ok){ const d = await res.json().catch(()=>({})); throw new Error(d?.error || 'Failed to create patient') }
                      const d = await res.json(); patientId = d.id; patientPayload = { ...newPatient }
                    } else {
                      if (!patientId){ setBookError('Please select an existing patient'); setBookLoading(false); return }
                      const p = selectedPatientInfo || patients.find((x:any)=>x.id===patientId); patientPayload = p
                    }
                    // Prevent multiple bookings on the same day for the same patient
                    try {
                      const dupQ = query(
                        collection(db, 'appointments'),
                        where('patientId', '==', patientId),
                        where('appointmentDate', '==', appointmentDate),
                        where('status', '==', 'confirmed')
                      )
                      const dupSnap = await getDocs(dupQ)
                      if (!dupSnap.empty) {
                        setBookError('This patient already has an appointment on this date')
                        setBookLoading(false)
                        return
                      }
                    } catch (_) { /* ignore and proceed */ }

                    const doctor = doctors.find((x:any)=>x.id===selectedDoctorId)
                    const appointmentData = {
                      patientId,
                      patientName: `${patientPayload.firstName || ''} ${patientPayload.lastName || ''}`.trim(),
                      patientEmail: patientPayload.email || '',
                      patientPhone: patientPayload.phone || '',
                      doctorId: doctor?.id,
                      doctorName: `${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim(),
                      doctorSpecialization: doctor?.specialization || '',
                      appointmentDate,
                      appointmentTime,
                      status: 'confirmed',
                      paymentAmount: paymentAmount,
                      paymentMethod: paymentMethod,
                      paymentType: 'full',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      createdBy: 'receptionist'
                    }
                    const res2 = await fetch('/api/receptionist/create-appointment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ appointmentData }) })
                    if (!res2.ok){ const d = await res2.json().catch(()=>({})); throw new Error(d?.error || 'Failed to create appointment') }
                    // Show success modal
                    const txnId = `RCPT${Date.now()}`
                    setSuccessData({
                      doctorName: appointmentData.doctorName,
                      doctorSpecialization: appointmentData.doctorSpecialization,
                      appointmentDate: appointmentDate,
                      appointmentTime: appointmentTime,
                      transactionId: txnId,
                      paymentAmount: appointmentData.paymentAmount,
                      paymentType: 'full',
                      patientName: appointmentData.patientName
                    })
                    setSuccessOpen(true)
                    // Reset form completely
                    setPatientMode('existing')
                    setSearchPatient('')
                    setSelectedPatientId('')
                    setNewPatient({ firstName:'', lastName:'', email:'', phone:'', gender:'', bloodGroup:'', dateOfBirth:'', address:'' })
                    setNewPatientPassword('')
                    setNewPatientPasswordConfirm('')
                    setSelectedDoctorId('')
                    setSelectedDoctorFee(null)
                    setAppointmentDate('')
                    setAppointmentTime('')
                    setSymptomCategory('')
                    setCustomSymptom('')
                    setPaymentMethod(null)
                    setPaymentData({ cardNumber:'', cardName:'', expiryDate:'', cvv:'', upiId:'' })
                    setAvailableSlots([])
                  }catch(e:any){ setBookError(e?.message || 'Failed') } finally { setBookLoading(false) }
                }} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{bookLoading?'Booking...':'Book Appointment'}</button>
                </div>
            </div>
          )}
        </main>
        </div>

      {assignModalOpen && selectedAdmitRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Assign Room</h3>
                <p className="text-sm text-gray-500">
                  Patient: {selectedAdmitRequest.patientName || "Unknown"}
                  {selectedAdmitRequest.patientId && (
                    <span className="ml-2 font-mono text-[11px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                      {selectedAdmitRequest.patientId}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleCloseAssignModal}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-4">
              {roomsLoading && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                  Loading rooms...
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Room Type</label>
                <select
                  value={assignRoomType}
                  onChange={(e) => {
                    const value = e.target.value as Room["roomType"] | ""
                    setAssignRoomType(value)
                    setAssignRoomId("")
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Show all available types</option>
                  {availableRoomTypes.map((type) => (
                    <option key={type} value={type}>
                      {roomTypeLabelMap[type] || type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Room</label>
                {availableRoomsForType.length === 0 ? (
                  <div className="p-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500">
                    No available rooms{assignRoomType ? ` for ${assignRoomType}` : ""}. Please choose another type or free up a room.
                  </div>
                ) : (
                  <select
                    value={assignRoomId}
                    onChange={(e) => setAssignRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select room</option>
                    {availableRoomsForType.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.roomNumber} — {room.roomType.toUpperCase()} (₹{room.ratePerDay}/day)
                      </option>
                    ))}
                  </select>
                )}
                {assignRoomId && (
                  <div className="text-xs text-gray-500">
                    Rate per day: ₹{rooms.find(room => room.id === assignRoomId)?.ratePerDay || 0}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Reception Notes <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Add room or admission notes for the medical team..."
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleCloseAssignModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={assignLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignRoom}
                  disabled={assignLoading || !assignRoomId}
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {assignLoading ? "Assigning..." : "Confirm Admission"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {dischargeModalOpen && selectedAdmission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Discharge Patient</h3>
                <p className="text-sm text-gray-500">
                  Room {selectedAdmission.roomNumber} • {roomTypeLabelMap[selectedAdmission.roomType as Room["roomType"]] || selectedAdmission.roomType}
                </p>
              </div>
              <button
                onClick={handleCloseDischargeModal}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="block text-xs uppercase text-gray-500">Patient</span>
                  <span className="font-semibold">{selectedAdmission.patientName || "Unknown"}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase text-gray-500">Doctor</span>
                  <span>{selectedAdmission.doctorName || "Unknown"}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase text-gray-500">Check-in</span>
                  <span>{selectedAdmission.checkInAt ? new Date(selectedAdmission.checkInAt).toLocaleString() : "—"}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase text-gray-500">Rate / Day</span>
                  <span>₹{selectedAdmission.roomRatePerDay}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Doctor Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={dischargeDoctorFee}
                    onChange={(e) => setDischargeDoctorFee(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Other Charges (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={dischargeOtherCharges}
                    onChange={(e) => setDischargeOtherCharges(e.target.value)}
                    placeholder="e.g. 300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Other Charges Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={dischargeOtherDescription}
                  onChange={(e) => setDischargeOtherDescription(e.target.value)}
                  placeholder="Lab tests, medicines, etc."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Discharge Notes <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={dischargeNotes}
                  onChange={(e) => setDischargeNotes(e.target.value)}
                  placeholder="Add any discharge notes for medical records."
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseDischargeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={dischargeLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDischarge}
                  disabled={dischargeLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {dischargeLoading ? "Processing..." : "Confirm Discharge"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      {billingPaymentModalOpen && selectedBillingRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Record Patient Payment</h3>
                <p className="text-sm text-slate-500">
                  Patient ID {selectedBillingRecord.patientId || "Unknown"} • Bill #{selectedBillingRecord.id.slice(0,6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={handleCloseBillingPayment}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide mb-2">
                  Bill Summary
                </p>
                <div className="flex items-center justify-between text-slate-800">
                  <span className="text-sm">Total amount due</span>
                  <span className="text-2xl font-bold text-slate-900">
                    ₹{selectedBillingRecord.totalAmount}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Generated on{" "}
                  {selectedBillingRecord.generatedAt
                    ? new Date(selectedBillingRecord.generatedAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <PaymentMethodSection
                  title="Payment method"
                  paymentMethod={billingPaymentMethod}
                  setPaymentMethod={(method) => setBillingPaymentMethod(method)}
                  paymentData={billingPaymentData}
                  setPaymentData={setBillingPaymentData}
                  amountToPay={selectedBillingRecord.totalAmount}
                  walletBalance={undefined}
                  methods={["cash", "card", "upi", "wallet"]}
                />
                {billingPaymentMethod === "wallet" && (
                  <p className="text-xs text-amber-600 mt-2">
                    Ensure the patient has sufficient wallet balance before confirming.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={handleCloseBillingPayment}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
                disabled={processingBillingPayment}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBillingPayment}
                disabled={processingBillingPayment}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-60"
              >
                {processingBillingPayment ? "Recording..." : `Record ₹${selectedBillingRecord.totalAmount}`}
              </button>
            </div>
          </div>
        </div>
      )}
      <AppointmentSuccessModal
        isOpen={successOpen}
        onClose={()=>setSuccessOpen(false)}
        appointmentData={successData}
      />
      {otpModalOpen && (
        <OTPVerificationModal
          isOpen={otpModalOpen}
          onClose={() => setOtpModalOpen(false)}
          phone={newPatient.phone || ''}
          onChangePhone={() => setOtpModalOpen(false)}
          onVerified={async () => {
            try {
              setBookLoading(true); setBookError(null)
              // Create patient after OTP and then book appointment
              const res = await fetch('/api/receptionist/create-patient', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patientData: { ...newPatient, status:'active', createdBy:'receptionist', createdAt: new Date().toISOString() }, password: newPatientPassword }) })
              if (!res.ok){ const d = await res.json().catch(()=>({})); throw new Error(d?.error || 'Failed to create patient') }
              const d = await res.json(); const patientId = d.id; const patientPayload:any = { ...newPatient }

              // Prevent multiple bookings on same day
              try {
                const dupQ = query(
                  collection(db, 'appointments'),
                  where('patientId', '==', patientId),
                  where('appointmentDate', '==', appointmentDate),
                  where('status', '==', 'confirmed')
                )
                const dupSnap = await getDocs(dupQ)
                if (!dupSnap.empty) { setBookError('This patient already has an appointment on this date'); setBookLoading(false); return }
              } catch (_) {}

              const doctor = doctors.find((x:any)=>x.id===selectedDoctorId)
              const appointmentData = {
                patientId,
                patientName: `${patientPayload.firstName || ''} ${patientPayload.lastName || ''}`.trim(),
                patientEmail: patientPayload.email || '',
                patientPhone: patientPayload.phone || '',
                doctorId: doctor?.id,
                doctorName: `${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim(),
                doctorSpecialization: doctor?.specialization || '',
                appointmentDate,
                appointmentTime,
                status: 'confirmed',
                paymentAmount: paymentAmount,
                paymentMethod: paymentMethod,
                paymentType: 'full',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'receptionist'
              }
              const res2 = await fetch('/api/receptionist/create-appointment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ appointmentData }) })
              if (!res2.ok){ const d2 = await res2.json().catch(()=>({})); throw new Error(d2?.error || 'Failed to create appointment') }
              setOtpModalOpen(false)
              const txnId = `RCPT${Date.now()}`
              setSuccessData({
                doctorName: appointmentData.doctorName,
                doctorSpecialization: appointmentData.doctorSpecialization,
                appointmentDate: appointmentDate,
                appointmentTime: appointmentTime,
                transactionId: txnId,
                paymentAmount: appointmentData.paymentAmount,
                paymentType: 'full',
                patientName: appointmentData.patientName
              })
              setSuccessOpen(true)
              // Reset form
              setPatientMode('existing')
              setSearchPatient('')
              setSelectedPatientId('')
              setNewPatient({ firstName:'', lastName:'', email:'', phone:'', gender:'', bloodGroup:'', dateOfBirth:'', address:'' })
              setNewPatientPassword('')
              setNewPatientPasswordConfirm('')
              setSelectedDoctorId('')
              setSelectedDoctorFee(null)
              setAppointmentDate('')
              setAppointmentTime('')
              setSymptomCategory('')
              setCustomSymptom('')
              setPaymentMethod(null)
              setPaymentData({ cardNumber:'', cardName:'', expiryDate:'', cvv:'', upiId:'' })
              setAvailableSlots([])
            } catch(e:any) {
              setBookError(e?.message || 'Failed')
            } finally {
              setBookLoading(false)
            }
          }}
        />
      )}
        </div>
    )
}