"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { auth } from "@/firebase/config"
import { ROOM_TYPES } from "@/constants/roomTypes"
import { Admission, AdmissionRequest, Room } from "@/types/patient"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { ipdSubTabClass } from "@/app/receptionist-dashboard/components/admit-dashboard/ipdUi"
import AdmissionHistoryPanel from "@/app/receptionist-dashboard/Tabs/AdmissionHistoryPanel"
import AssignRoomModal from "@/app/receptionist-dashboard/components/admit-dashboard/modals/AssignRoomModal"
import DirectAdmitModal from "@/app/receptionist-dashboard/components/admit-dashboard/modals/DirectAdmitModal"
import TransferRoomModal from "@/app/receptionist-dashboard/components/admit-dashboard/modals/TransferRoomModal"
import DischargeModal from "@/app/receptionist-dashboard/components/admit-dashboard/modals/DischargeModal"
import AdmissionDetailsModal from "@/app/receptionist-dashboard/components/admit-dashboard/modals/AdmissionDetailsModal"
import RoomManagerModal from "@/app/receptionist-dashboard/components/admit-dashboard/modals/RoomManagerModal"
import IpdDashboardSection from "@/app/receptionist-dashboard/components/admit-dashboard/sections/IpdDashboardSection"
import AdmissionsDeskSection from "@/app/receptionist-dashboard/components/admit-dashboard/sections/AdmissionsDeskSection"
import IpdSettingsSection from "@/app/receptionist-dashboard/components/admit-dashboard/sections/IpdSettingsSection"
import { useIpdAdmissionsDesk, type AdmissionsDeskFocus } from "@/app/receptionist-dashboard/hooks/useIpdAdmissionsDesk"
import { useIpdDashboardInsights } from "@/app/receptionist-dashboard/hooks/useIpdDashboardInsights"
import { useIpdBootstrapData } from "@/app/receptionist-dashboard/hooks/useIpdBootstrapData"

const roomTypeLabelMap: Record<Room["roomType"], string> = ROOM_TYPES.reduce((acc, type) => {
  acc[type.id] = type.name
  return acc
}, {} as Record<Room["roomType"], string>)

const roomTypeRateMap = ROOM_TYPES.reduce((acc, type) => {
  acc[type.id] = type.dailyRate
  return acc
}, {} as Record<Room["roomType"], number>)

/** Approximate whole years from YYYY-MM-DD for direct-admit form prefill */
function ageInputFromDob(dob: string): string {
  const t = dob.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return ""
  const d = new Date(`${t}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const md = today.getMonth() - d.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < d.getDate())) age -= 1
  return age >= 0 && age <= 120 ? String(age) : ""
}

const fallbackRoomNumbersByType: Record<Room["roomType"], string[]> = {
  general: ["101", "102"],
  semi_private: ["201", "202"],
  private: ["301"],
  deluxe: ["401"],
  vip: ["501"],
  custom: [],
}

const getRoomTypeDisplayName = (room: Pick<Room, "roomType" | "customRoomTypeName">) => {
  if (room.roomType === "custom") {
    return room.customRoomTypeName?.trim() || "Custom Room Type"
  }
  return roomTypeLabelMap[room.roomType] || room.roomType
}

const getRoomTypeFilterKey = (room: Pick<Room, "roomType" | "customRoomTypeName">) => {
  if (room.roomType === "custom") {
    return `custom:${room.customRoomTypeName?.trim() || "Custom Room Type"}`
  }
  return room.roomType
}

const DAY_MS = 24 * 60 * 60 * 1000

const countCalendarDaysInclusive = (fromIso: string, toIso: string) => {
  const fromDate = new Date(fromIso)
  const toDate = new Date(toIso)
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) return 1
  if (toDate.getTime() <= fromDate.getTime()) return 1
  const startUtcDay = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
  const endUtcDay = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate())
  return Math.max(1, Math.floor((endUtcDay - startUtcDay) / DAY_MS) + 1)
}

const DEFAULT_PACKAGE_TEMPLATES = [
  {
    packageName: "Appendectomy Package",
    fixedRate: 45000,
    includedItems: [
      "Surgeon fee",
      "Anesthesia charges",
      "Operation theater charges",
      "2-day room stay",
      "Nursing care",
      "Basic consumables and medicines",
      "Routine pre-op lab tests",
    ],
    exclusions: "Blood products, high-end implants, ICU beyond planned duration",
  },
  {
    packageName: "C-Section Package",
    fixedRate: 65000,
    includedItems: [
      "Obstetric surgeon fee",
      "Anesthesia charges",
      "Operation theater charges",
      "3-day ward stay",
      "Nursing and newborn basic care",
      "Standard post-op medicines",
    ],
    exclusions: "NICU admission, blood products, complications needing extended stay",
  },
]

const PACKAGE_INCLUDED_ITEM_OPTIONS = [
  "Surgeon fee",
  "Assistant surgeon fee",
  "Anesthesia charges",
  "Operation theater charges",
  "ICU stay (limited)",
  "Nursing care",
  "Routine pre-op lab tests",
  "Post-op monitoring",
  "Basic medicines",
  "Consumables and dressing",
  "Doctor follow-up rounds",
]

const DISCHARGE_OTHER_CHARGE_OPTIONS = [
  { id: "lab_tests", label: "Lab tests", amount: 1200 },
  { id: "radiology", label: "Radiology / Imaging", amount: 1800 },
  { id: "monitoring", label: "Monitoring charges", amount: 900 },
  { id: "procedure", label: "Procedure charges", amount: 1500 },
  { id: "equipment", label: "Equipment usage", amount: 1000 },
]

const DISCHARGE_OTHER_CHARGE_DEFAULTS = DISCHARGE_OTHER_CHARGE_OPTIONS.reduce<Record<string, number>>(
  (acc, option) => {
    acc[option.id] = option.amount
    return acc
  },
  {}
)

const DEPOSIT_PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const

interface AdmitRequestsPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
  onOpenBilling?: (admissionId: string) => void
}

export default function AdmitRequestsPanel({ onNotification, onOpenBilling }: AdmitRequestsPanelProps) {
  type ExistingPatientOption = {
    uid: string
    patientId: string
    fullName: string
    phone: string
    gender: string
    dateOfBirth: string
    address: string
    admissionStatus?: "admitted" | "scheduled" | null
    activeAdmissionId?: string | null
  }
  type DoctorOption = {
    uid: string
    fullName: string
    specialization: string
  }
  type AdmissionPackageOption = {
    id: string
    packageName: string
    fixedRate: number
    includedItems?: string[]
    preferredRoomType?: string | null
    exclusions?: string | null
    notes?: string | null
  }
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "admitted" | "settings" | "history">("admitted")
  const [admissionsDeskFocus, setAdmissionsDeskFocus] = useState<AdmissionsDeskFocus>("all")
  const admittedPatientsSectionRef = useRef<HTMLElement | null>(null)
  const [admitRequests, setAdmitRequests] = useState<AdmissionRequest[]>([])
  const [admitRequestsLoading, setAdmitRequestsLoading] = useState(false)
  const [admitRequestsError, setAdmitRequestsError] = useState<string | null>(null)
  const [selectedAdmitRequest, setSelectedAdmitRequest] = useState<AdmissionRequest | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignRoomType, setAssignRoomType] = useState("")
  const [assignRoomId, setAssignRoomId] = useState("")
  const [assignNotes, setAssignNotes] = useState("")
  const [assignInitialDeposit, setAssignInitialDeposit] = useState("")
  const [assignInitialDepositMode, setAssignInitialDepositMode] = useState("cash")
  const [assignLoading, setAssignLoading] = useState(false)
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)

  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [admissionsLoading, setAdmissionsLoading] = useState(false)
  const [admissionsError, setAdmissionsError] = useState<string | null>(null)
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false)
  const [dischargeDoctorFee, setDischargeDoctorFee] = useState("")
  const [dischargePrescriptionCharges, setDischargePrescriptionCharges] = useState("")
  const [dischargePrescriptionNames, setDischargePrescriptionNames] = useState("")
  const [dischargeOtherChargeSelections, setDischargeOtherChargeSelections] = useState<string[]>([])
  const [dischargeOtherChargeAmounts, setDischargeOtherChargeAmounts] =
    useState<Record<string, number>>(DISCHARGE_OTHER_CHARGE_DEFAULTS)
  const [dischargeNotes, setDischargeNotes] = useState("")
  const [dischargeLoading, setDischargeLoading] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferAdmission, setTransferAdmission] = useState<Admission | null>(null)
  const [transferRoomId, setTransferRoomId] = useState("")
  const [transferNotes, setTransferNotes] = useState("")
  const [transferLoading, setTransferLoading] = useState(false)
  const [directAdmitModalOpen, setDirectAdmitModalOpen] = useState(false)
  const [directAdmitLoading, setDirectAdmitLoading] = useState(false)
  const [directPatientName, setDirectPatientName] = useState("")
  const [directPatientId, setDirectPatientId] = useState("")
  const [directPatientUid, setDirectPatientUid] = useState("")
  const [directPatientAddress, setDirectPatientAddress] = useState("")
  const [directPatientPhone, setDirectPatientPhone] = useState("")
  const [directPatientGender, setDirectPatientGender] = useState("")
  const [directPatientAge, setDirectPatientAge] = useState("")
  const [directEmergencyRelativeName, setDirectEmergencyRelativeName] = useState("")
  const [directPatientResults, setDirectPatientResults] = useState<ExistingPatientOption[]>([])
  const [directPatientLookupLoading, setDirectPatientLookupLoading] = useState(false)
  const [directSelectedPatientAdmissionStatus, setDirectSelectedPatientAdmissionStatus] =
    useState<"admitted" | "scheduled" | null>(null)
  const [directDoctorName, setDirectDoctorName] = useState("")
  const [directDoctorId, setDirectDoctorId] = useState("")
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [admissionPackages, setAdmissionPackages] = useState<AdmissionPackageOption[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packageManageLoading, setPackageManageLoading] = useState(false)
  const [packageEditId, setPackageEditId] = useState<string | null>(null)
  const [managePackageName, setManagePackageName] = useState("")
  const [managePackageRate, setManagePackageRate] = useState("")
  const [managePackageIncludedItems, setManagePackageIncludedItems] = useState<string[]>([])
  const [managePackageRoomStayEnabled, setManagePackageRoomStayEnabled] = useState(false)
  const [managePackageRoomStayDays, setManagePackageRoomStayDays] = useState(1)
  const [managePackageRoomType, setManagePackageRoomType] = useState("")
  const [managePackageExclusions, setManagePackageExclusions] = useState("")
  const [directAdmitType, setDirectAdmitType] = useState<"emergency" | "planned">("emergency")
  const [directPlannedAdmitAt, setDirectPlannedAdmitAt] = useState("")
  const [directExpectedDischargeAt, setDirectExpectedDischargeAt] = useState("")
  const [directDoctorRoundFee, setDirectDoctorRoundFee] = useState("500")
  const [directInitialDeposit, setDirectInitialDeposit] = useState("")
  const [directInitialDepositMode, setDirectInitialDepositMode] = useState("cash")
  const [directPackageId, setDirectPackageId] = useState("")
  const [depositTopupAmount, setDepositTopupAmount] = useState("")
  const [depositTopupNote, setDepositTopupNote] = useState("")
  const [depositTopupPaymentMode, setDepositTopupPaymentMode] = useState("cash")
  const [depositTopupLoading, setDepositTopupLoading] = useState(false)
  const [admissionDetailsSaving, setAdmissionDetailsSaving] = useState(false)
  const [billingProcessing, setBillingProcessing] = useState(false)
  const [roomManagerOpen, setRoomManagerOpen] = useState(false)
  const [roomEditId, setRoomEditId] = useState<string | null>(null)
  const [roomManageLoading, setRoomManageLoading] = useState(false)
  const [manageRoomNumber, setManageRoomNumber] = useState("")
  const [manageRoomType, setManageRoomType] = useState<Room["roomType"] | "">("")
  const [manageCustomRoomTypeName, setManageCustomRoomTypeName] = useState("")
  const [manageRoomRate, setManageRoomRate] = useState("")
  const [manageRoomStatus, setManageRoomStatus] = useState<Room["status"]>("available")
  const [selectedDateFilter, setSelectedDateFilter] = useState("today")
  const [plannedActionLoadingId, setPlannedActionLoadingId] = useState<string | null>(null)
  const [postponeModalOpen, setPostponeModalOpen] = useState(false)
  const [postponeAdmissionId, setPostponeAdmissionId] = useState<string | null>(null)
  const [postponeDateTime, setPostponeDateTime] = useState("")
  const [plannedConfirmModalOpen, setPlannedConfirmModalOpen] = useState(false)
  const [plannedConfirmAdmissionId, setPlannedConfirmAdmissionId] = useState<string | null>(null)
  const [plannedConfirmAction, setPlannedConfirmAction] = useState<"ready_to_admit" | "delete" | null>(null)
  const [assignDoctorReadyModalOpen, setAssignDoctorReadyModalOpen] = useState(false)
  const [assignDoctorReadyAdmissionId, setAssignDoctorReadyAdmissionId] = useState<string | null>(null)
  const [assignDoctorReadyDoctorId, setAssignDoctorReadyDoctorId] = useState("")
  const plannedPopupRef = useRef<HTMLDivElement | null>(null)

  const availableRoomTypes = useMemo(() => {
    const types = new Map<string, string>()
    rooms.forEach((room) => {
      const key = getRoomTypeFilterKey(room)
      const label = getRoomTypeDisplayName(room)
      if (key) {
        types.set(key, label)
      }
    })
    return Array.from(types.entries()).map(([key, label]) => ({ key, label }))
  }, [rooms])

  const availableRoomsForType = useMemo(() => {
    return rooms.filter((room) => {
      if (room.status !== "available") return false
      if (!assignRoomType) return true
      return getRoomTypeFilterKey(room) === assignRoomType
    })
  }, [rooms, assignRoomType])

  const pendingCount = admitRequests.length

  const { totalRooms, availableRoomsCount, occupiedRoomsCount } = useMemo(() => {
    const total = rooms.length
    let available = 0
    let occupied = 0
    rooms.forEach((room) => {
      if (room.status === "available") available += 1
      if (room.status === "occupied") occupied += 1
    })
    return {
      totalRooms: total,
      availableRoomsCount: available,
      occupiedRoomsCount: occupied,
    }
  }, [rooms])

  const admissionsCount = admissions.length
  const admissionsTodayCount = useMemo(() => {
    const today = new Date().toDateString()
    return admissions.filter((admission) => new Date(admission.checkInAt).toDateString() === today).length
  }, [admissions])
  const roomOccupancyRate = totalRooms ? Math.round((occupiedRoomsCount / totalRooms) * 100) : 0

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )
  const { fetchRooms, fetchAdmissionPackages, fetchAdmitRequests, fetchAdmissions } = useIpdBootstrapData({
    fallbackRoomNumbersByType,
    roomTypeRateMap,
    setRooms,
    setRoomsLoading,
    setDoctors,
    setDoctorsLoading,
    setAdmissionPackages,
    setPackagesLoading,
    setAdmitRequestsLoading,
    setAdmitRequestsError,
    setAdmitRequests,
    setAdmissionsLoading,
    setAdmissionsError,
    setAdmissions,
  })

  const handleOpenAssignModal = (request: AdmissionRequest) => {
    setSelectedAdmitRequest(request)
    const defaultType = rooms.find((room) => room.status === "available")?.roomType || ""
    setAssignRoomType(defaultType)
    setAssignRoomId("")
    setAssignNotes("")
    setAssignInitialDeposit("")
    setAssignInitialDepositMode("cash")
    setAssignModalOpen(true)
  }

  const handleCloseAssignModal = () => {
    setAssignModalOpen(false)
    setSelectedAdmitRequest(null)
    setAssignRoomId("")
    setAssignNotes("")
    setAssignInitialDeposit("")
    setAssignInitialDepositMode("cash")
  }

  const handleAssignRoom = async () => {
    if (!selectedAdmitRequest) return
    if (!assignRoomId) {
      notify({ type: "error", message: "Select a room to assign." })
      return
    }
    setAssignLoading(true)
    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to accept admission requests")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch(`/api/receptionist/admission-request/${selectedAdmitRequest.id}/accept`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: assignRoomId,
          initialDeposit: Number(assignInitialDeposit || 0),
          initialDepositPaymentMode: assignInitialDepositMode,
          notes: assignNotes.trim() ? assignNotes.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to assign room")
      }
      notify({ type: "success", message: "Patient admitted successfully." })
      setAdmitRequests((prev) => prev.filter((req) => req.id !== selectedAdmitRequest.id))
      setRooms((prev) => prev.map((room) => (room.id === assignRoomId ? { ...room, status: "occupied" } : room)))
      fetchAdmissions()
      setAssignModalOpen(false)
      setSelectedAdmitRequest(null)
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to assign room" })
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
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to cancel admission requests")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch(`/api/receptionist/admission-request/${request.id}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: cancelReason && cancelReason.trim() ? cancelReason.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to cancel admission request")
      }
      setAdmitRequests((prev) => prev.filter((req) => req.id !== request.id))
      notify({ type: "success", message: "Admission request cancelled." })
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to cancel admission request" })
    } finally {
      setCancelLoadingId(null)
    }
  }

  const handleOpenDischargeModal = (admission: Admission) => {
    setSelectedAdmission(admission)
    setDischargeDoctorFee(String(Number(admission.charges?.doctorRoundFee || 0)))
    setDischargePrescriptionCharges("")
    setDischargePrescriptionNames("")
    setDischargeOtherChargeSelections([])
    setDischargeOtherChargeAmounts(DISCHARGE_OTHER_CHARGE_DEFAULTS)
    setDischargeNotes("")
    setDepositTopupAmount("")
    setDepositTopupNote("")
    setDepositTopupPaymentMode("cash")
    setDischargeModalOpen(true)
  }

  const updateAdmissionDraft = (admissionId: string, updater: (current: Admission) => Admission) => {
    setAdmissions((prev) => prev.map((admission) => (admission.id === admissionId ? updater(admission) : admission)))
    setSelectedAdmission((prev) => {
      if (!prev || prev.id !== admissionId) return prev
      return updater(prev)
    })
  }

  const handleCloseDischargeModal = () => {
    setDischargeModalOpen(false)
    setSelectedAdmission(null)
  }

  const handleDischarge = async () => {
    if (!selectedAdmission) return
    setDischargeLoading(true)
    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to discharge patients")
      }

      const token = await currentUser.getIdToken()
      const selectedOtherChargeItems = DISCHARGE_OTHER_CHARGE_OPTIONS.filter((option) =>
        dischargeOtherChargeSelections.includes(option.id)
      ).map((item) => ({
        ...item,
        amount: Number(dischargeOtherChargeAmounts[item.id] ?? item.amount),
      }))
      const selectedOtherChargesTotal = selectedOtherChargeItems.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )
      const selectedOtherChargesDescription = selectedOtherChargeItems
        .map((item) => `${item.label} (₹${Number(item.amount || 0).toLocaleString()})`)
        .join(", ")

      const res = await fetch(`/api/receptionist/admissions/${selectedAdmission.id}/discharge`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doctorFee: dischargeDoctorFee ? Number(dischargeDoctorFee) : undefined,
          prescriptionCharges: dischargePrescriptionCharges
            ? Number(dischargePrescriptionCharges)
            : undefined,
          prescriptionNames: dischargePrescriptionNames.trim() || undefined,
          otherCharges: selectedOtherChargesTotal > 0 ? selectedOtherChargesTotal : undefined,
          otherDescription: selectedOtherChargesDescription || undefined,
          notes: dischargeNotes?.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to discharge patient")
      }
      notify({ type: "success", message: "Patient discharged successfully." })
      setAdmissions((prev) => prev.filter((admission) => admission.id !== selectedAdmission.id))
      setRooms((prev) => prev.map((room) => (room.id === selectedAdmission.roomId ? { ...room, status: "available" } : room)))
      setDischargeModalOpen(false)
      setSelectedAdmission(null)
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to discharge patient" })
    } finally {
      setDischargeLoading(false)
    }
  }

  const handleOpenDirectAdmitModal = () => {
    setDirectPatientResults([])
    setDirectPatientLookupLoading(false)
    setDirectSelectedPatientAdmissionStatus(null)
    setDirectPatientName("")
    setDirectPatientId("")
    setDirectPatientUid("")
    setDirectPatientAddress("")
    setDirectPatientPhone("")
    setDirectPatientGender("")
    setDirectPatientAge("")
    setDirectEmergencyRelativeName("")
    setDirectDoctorName("")
    setDirectDoctorId("")
    setDirectAdmitType("emergency")
    setDirectPlannedAdmitAt("")
    setDirectExpectedDischargeAt("")
    setDirectDoctorRoundFee("500")
    setDirectInitialDeposit("")
    setDirectInitialDepositMode("cash")
    setDirectPackageId("")
    setAssignRoomType(rooms.find((room) => room.status === "available")?.roomType || "")
    setAssignRoomId("")
    setAssignNotes("")
    setDirectAdmitModalOpen(true)
  }

  const handleSearchExistingPatients = useCallback(async (queryValue: string) => {
    const query = queryValue.trim()
    if (query.length < 2) {
      setDirectPatientResults([])
      setDirectSelectedPatientAdmissionStatus(null)
      return
    }
    setDirectPatientLookupLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to search patients")
      }
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/patients/search?q=${encodeURIComponent(query)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to search patients")
      }
      const data = await res.json().catch(() => ({}))
      const patients = Array.isArray(data?.patients) ? data.patients : []
      setDirectPatientResults(patients)
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to search patients" })
      setDirectPatientResults([])
    } finally {
      setDirectPatientLookupLoading(false)
    }
  }, [notify])

  const handleSelectExistingPatient = (patient: ExistingPatientOption) => {
    if (patient.admissionStatus === "admitted" || patient.admissionStatus === "scheduled") {
      notify({
        type: "error",
        message:
          patient.admissionStatus === "admitted"
            ? "This patient is already admitted."
            : "This patient is already pre-registered for admission.",
      })
      return
    }
    setDirectPatientUid(patient.uid)
    setDirectPatientId(patient.patientId || "")
    setDirectPatientName(patient.fullName || "")
    setDirectPatientAddress(patient.address || "")
    setDirectPatientPhone(patient.phone || "")
    setDirectPatientGender(patient.gender || "")
    setDirectPatientAge(ageInputFromDob(patient.dateOfBirth))
    setDirectEmergencyRelativeName("")
    setDirectPatientResults([])
    setDirectSelectedPatientAdmissionStatus(patient.admissionStatus || null)
  }

  const handleClearDirectPatientSelectionFields = useCallback(() => {
    setDirectPatientPhone("")
    setDirectPatientGender("")
    setDirectPatientAge("")
    setDirectEmergencyRelativeName("")
    setDirectSelectedPatientAdmissionStatus(null)
  }, [])

  useEffect(() => {
    if (!directAdmitModalOpen) return
    const typedName = directPatientName.trim()
    if (typedName.length < 2) {
      setDirectPatientResults([])
      return
    }
    const timer = setTimeout(() => {
      handleSearchExistingPatients(typedName)
    }, 250)
    return () => clearTimeout(timer)
  }, [directAdmitModalOpen, directPatientName, handleSearchExistingPatients])

  const handleCreateDirectAdmit = async () => {
    if (directPatientUid && (directSelectedPatientAdmissionStatus === "admitted" || directSelectedPatientAdmissionStatus === "scheduled")) {
      notify({
        type: "error",
        message:
          directSelectedPatientAdmissionStatus === "admitted"
            ? "Selected patient is already admitted."
            : "Selected patient is already pre-registered for admission.",
      })
      return
    }
    if (!assignRoomId) {
      notify({ type: "error", message: "Select a room to continue." })
      return
    }
    if (!directPatientName.trim() && !directPatientId.trim()) {
      notify({ type: "error", message: "Add patient name or patient ID." })
      return
    }

    setDirectAdmitLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to create admissions")
      }
      const token = await currentUser.getIdToken()
      const selectedPackage = admissionPackages.find((pkg) => pkg.id === directPackageId)
      const res = await fetch("/api/receptionist/admissions?includeAppointmentDetails=false", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: assignRoomId,
          patientUid: directPatientUid || undefined,
          patientName: directPatientName.trim() || undefined,
          patientId: directPatientId.trim() || undefined,
          patientAddress: directPatientAddress.trim() || undefined,
          patientPhone: directPatientPhone.trim() || undefined,
          patientGender: directPatientGender.trim() || undefined,
          patientAgeYears: directPatientAge.trim() === "" ? undefined : Number(directPatientAge.trim()),
          emergencyContactName: directEmergencyRelativeName.trim() || undefined,
          doctorName: directDoctorName.trim() || undefined,
          doctorId: directDoctorId.trim() || undefined,
          admitType: directAdmitType,
          plannedAdmitAt: directAdmitType === "planned" ? directPlannedAdmitAt || undefined : undefined,
          expectedDischargeAt: directExpectedDischargeAt || undefined,
          doctorRoundFee: selectedPackage ? 0 : Number(directDoctorRoundFee || 0),
          initialDeposit: Number(directInitialDeposit || 0),
          initialDepositPaymentMode: directInitialDepositMode,
          operationPackage: selectedPackage
            ? {
                packageId: selectedPackage.id,
                packageName: selectedPackage.packageName,
                fixedRate: Number(selectedPackage.fixedRate || 0),
                paymentTiming: "after_operation",
                advancePaidAmount: 0,
                notes: null,
              }
            : undefined,
          notes: assignNotes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to create admission")
      }
      notify({ type: "success", message: "Direct admission created successfully." })
      setDirectAdmitModalOpen(false)
      fetchAdmissions()
      fetchRooms()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to create admission" })
    } finally {
      setDirectAdmitLoading(false)
    }
  }

  const persistAdmissionDetails = async (admission: Admission) => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error("You must be logged in to update admission")
    }
    const token = await currentUser.getIdToken()
    const res = await fetch(`/api/receptionist/admissions/${admission.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedDischargeAt: admission.expectedDischargeAt || null,
        notes: admission.notes || null,
        charges: admission.charges || {},
        paymentTerms: admission.paymentTerms || "standard",
        operationPackage: admission.operationPackage || null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || "Failed to save admission details")
    }
  }

  const handleSaveAdmissionDetails = async (admission: Admission) => {
    if (admissionDetailsSaving || billingProcessing) return
    setAdmissionDetailsSaving(true)
    try {
      await persistAdmissionDetails(admission)
      notify({ type: "success", message: "Admission details updated." })
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to save admission details" })
    } finally {
      setAdmissionDetailsSaving(false)
    }
  }

  const handleAddDepositTopup = async (admission: Admission) => {
    const amount = Math.max(0, Number(depositTopupAmount || 0))
    if (!amount) {
      notify({ type: "error", message: "Enter top-up amount." })
      return
    }
    setDepositTopupLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in")
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/admissions/${admission.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          depositAction: {
            type: "topup",
            amount,
            note: depositTopupNote.trim() || undefined,
            paymentMode: depositTopupPaymentMode,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to add top-up")
      }
      notify({ type: "success", message: "Deposit top-up added." })
      setDepositTopupAmount("")
      setDepositTopupNote("")
      setDepositTopupPaymentMode("cash")
      fetchAdmissions()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to add top-up" })
    } finally {
      setDepositTopupLoading(false)
    }
  }

  const handleProcessBilling = async (admission: Admission) => {
    if (admissionDetailsSaving || billingProcessing) return
    setBillingProcessing(true)
    try {
      await persistAdmissionDetails(admission)
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to process billing")
      }
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/admissions/${admission.id}/process-billing`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to process billing")
      }
      const data = await res.json().catch(() => ({}))
      notify({ type: "success", message: "Billing data prepared for this admission." })
      onOpenBilling?.(String(data?.billingId || admission.id))
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to process billing" })
    } finally {
      setBillingProcessing(false)
    }
  }

  const resetRoomManageForm = () => {
    setRoomEditId(null)
    setManageRoomNumber("")
    setManageRoomType("")
    setManageCustomRoomTypeName("")
    setManageRoomRate("")
    setManageRoomStatus("available")
  }

  const handleOpenCreateRoom = () => {
    resetRoomManageForm()
    setRoomManagerOpen(true)
  }

  const handleOpenEditRoom = (room: Room) => {
    setRoomEditId(room.id)
    setManageRoomNumber(room.roomNumber)
    setManageRoomType(room.roomType)
    setManageCustomRoomTypeName(room.customRoomTypeName || "")
    setManageRoomRate(String(room.ratePerDay || 0))
    setManageRoomStatus(room.status)
    setRoomManagerOpen(true)
  }

  const handleSubmitRoom = async () => {
    if (!manageRoomType) {
      notify({ type: "error", message: "Select a room type." })
      return
    }
    if (!manageRoomRate || Number(manageRoomRate) < 0) {
      notify({ type: "error", message: "Enter valid room rate." })
      return
    }
    if (manageRoomType === "custom" && !manageCustomRoomTypeName.trim()) {
      notify({ type: "error", message: "Enter custom room type name." })
      return
    }
    if (!roomEditId && !manageRoomNumber.trim()) {
      notify({ type: "error", message: "Room number is required." })
      return
    }

    setRoomManageLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage rooms")
      const token = await currentUser.getIdToken()
      const url = roomEditId ? `/api/receptionist/rooms/${roomEditId}` : "/api/receptionist/rooms"
      const method = roomEditId ? "PATCH" : "POST"
      const payload = roomEditId
        ? {
            roomType: manageRoomType,
            customRoomTypeName: manageRoomType === "custom" ? manageCustomRoomTypeName.trim() : null,
            ratePerDay: Number(manageRoomRate),
            status: manageRoomStatus,
          }
        : {
            roomNumber: manageRoomNumber.trim(),
            roomType: manageRoomType,
            customRoomTypeName: manageRoomType === "custom" ? manageCustomRoomTypeName.trim() : null,
            ratePerDay: Number(manageRoomRate),
            status: manageRoomStatus,
          }
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to save room")
      }
      notify({ type: "success", message: roomEditId ? "Room updated." : "Room created." })
      setRoomManagerOpen(false)
      resetRoomManageForm()
      fetchRooms()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to save room" })
    } finally {
      setRoomManageLoading(false)
    }
  }

  const handleArchiveRoom = async (room: Room) => {
    if (room.status === "occupied") {
      notify({ type: "error", message: "Cannot archive occupied room." })
      return
    }
    const confirmation = window.confirm(`Archive room ${room.roomNumber}?`)
    if (!confirmation) return
    setRoomManageLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage rooms")
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/rooms/${room.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to archive room")
      }
      notify({ type: "success", message: "Room archived." })
      fetchRooms()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to archive room" })
    } finally {
      setRoomManageLoading(false)
    }
  }

  const resetPackageForm = () => {
    setPackageEditId(null)
    setManagePackageName("")
    setManagePackageRate("")
    setManagePackageIncludedItems([])
    setManagePackageRoomStayEnabled(false)
    setManagePackageRoomStayDays(1)
    setManagePackageRoomType("")
    setManagePackageExclusions("")
  }

  const handleOpenCreatePackage = () => {
    resetPackageForm()
  }

  const handleOpenEditPackage = (pkg: AdmissionPackageOption) => {
    setPackageEditId(pkg.id)
    setManagePackageName(pkg.packageName)
    setManagePackageRate(String(pkg.fixedRate || 0))
    const items = pkg.includedItems || []
    const roomStayEntry = items.find((item) => /^Room stay\s*\(\d+\s*day/.test(item))
    const roomStayDays = roomStayEntry
      ? Number((roomStayEntry.match(/(\d+)/) || [])[1] || 1)
      : 1
    setManagePackageRoomStayEnabled(Boolean(roomStayEntry))
    setManagePackageRoomStayDays(Math.min(7, Math.max(1, roomStayDays)))
    setManagePackageRoomType(pkg.preferredRoomType || "")
    setManagePackageIncludedItems(items.filter((item) => !/^Room stay\s*\(\d+\s*day/.test(item)))
    setManagePackageExclusions(pkg.exclusions || "")
  }

  const handleSubmitPackage = async () => {
    if (!managePackageName.trim()) {
      notify({ type: "error", message: "Package name is required." })
      return
    }
    if (!managePackageRate || Number(managePackageRate) < 0) {
      notify({ type: "error", message: "Enter valid package rate." })
      return
    }
    setPackageManageLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage packages")
      const token = await currentUser.getIdToken()
      const url = packageEditId
        ? `/api/receptionist/admission-packages/${packageEditId}`
        : "/api/receptionist/admission-packages"
      const method = packageEditId ? "PATCH" : "POST"
      const includedItems = managePackageIncludedItems
        .map((item) => item.trim())
        .filter(Boolean)
      if (managePackageRoomStayEnabled) {
        includedItems.push(`Room stay (${managePackageRoomStayDays} day${managePackageRoomStayDays > 1 ? "s" : ""})`)
      }
      const payload = {
        packageName: managePackageName.trim(),
        fixedRate: Number(managePackageRate),
        includedItems,
        preferredRoomType: managePackageRoomType || null,
        exclusions: managePackageExclusions.trim() || null,
      }
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to save package")
      }
      notify({ type: "success", message: packageEditId ? "Package updated." : "Package created." })
      resetPackageForm()
      fetchAdmissionPackages()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to save package" })
    } finally {
      setPackageManageLoading(false)
    }
  }

  const handleArchivePackage = async (pkg: AdmissionPackageOption) => {
    const confirmation = window.confirm(`Archive package "${pkg.packageName}"?`)
    if (!confirmation) return
    setPackageManageLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage packages")
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/admission-packages/${pkg.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to archive package")
      }
      notify({ type: "success", message: "Package archived." })
      if (packageEditId === pkg.id) resetPackageForm()
      fetchAdmissionPackages()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to archive package" })
    } finally {
      setPackageManageLoading(false)
    }
  }

  const handleSeedRecommendedPackages = async () => {
    setPackageManageLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to manage packages")
      const token = await currentUser.getIdToken()
      for (const template of DEFAULT_PACKAGE_TEMPLATES) {
        await fetch("/api/receptionist/admission-packages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(template),
        })
      }
      notify({ type: "success", message: "Recommended package templates added." })
      fetchAdmissionPackages()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to add package templates" })
    } finally {
      setPackageManageLoading(false)
    }
  }

  const { dashboardStats, ipdKpiSummary, expectedDischargeRows, roundPendingRows, ipdFinanceSummary, roomAvailabilityByType } =
    useIpdDashboardInsights({
      rooms,
      admissions,
      getRoomTypeDisplayName,
      pendingCount,
      availableRoomsCount,
      occupiedRoomsCount,
      totalRooms,
      roomOccupancyRate,
      admissionsCount,
    })

  const {
    requestRows,
    roomRows,
    filteredInpatientRows,
    admissionsDeskFocusLabel,
    todayOverviewMetrics,
    openAdmissionsDeskWithFocus,
    handleExportFilteredInpatients,
  } = useIpdAdmissionsDesk({
    admitRequests,
    admissions,
    roomAvailabilityByType,
    admissionsDeskFocus,
    setAdmissionsDeskFocus,
    setActiveSubTab,
    admittedPatientsSectionRef,
    getRoomTypeDisplayName,
    pendingCount,
    admissionsTodayCount,
    availableRoomsCount,
  })

  const dateFilterOptions = useMemo(
    () => [
      { value: "today", label: "Today" },
      { value: "last7", label: "Last 7 days" },
      { value: "month", label: "This month" },
    ],
    []
  )

  const plannedAdmissions = useMemo(() => {
    const now = Date.now()
    return admissions
      .filter((admission) => {
        if (admission.admitType !== "planned") return false
        const plannedAt = new Date(String(admission.plannedAdmitAt || admission.checkInAt || "")).getTime()
        return Number.isFinite(plannedAt) && plannedAt >= now
      })
      .sort(
        (a, b) =>
          new Date(String(a.plannedAdmitAt || a.checkInAt || "")).getTime() -
          new Date(String(b.plannedAdmitAt || b.checkInAt || "")).getTime()
      )
  }, [admissions])

  const plannedAdmissionsWithin24h = useMemo(() => {
    const now = Date.now()
    const end = now + DAY_MS
    return plannedAdmissions.filter((admission) => {
      const plannedAt = new Date(String(admission.plannedAdmitAt || admission.checkInAt || "")).getTime()
      return Number.isFinite(plannedAt) && plannedAt >= now && plannedAt <= end
    })
  }, [plannedAdmissions])

  const plannedReminderKey = useMemo(
    () => plannedAdmissionsWithin24h.map((admission) => admission.id).sort().join("|"),
    [plannedAdmissionsWithin24h]
  )
  const [lastPlannedReminderKey, setLastPlannedReminderKey] = useState("")

  useEffect(() => {
    if (!plannedReminderKey || plannedReminderKey === lastPlannedReminderKey) return
    notify({
      type: "success",
      message: `Reminder: ${plannedAdmissionsWithin24h.length} planned admission(s) are due within the next 24 hours.`,
    })
    setLastPlannedReminderKey(plannedReminderKey)
  }, [plannedReminderKey, lastPlannedReminderKey, plannedAdmissionsWithin24h.length, notify])

  useEffect(() => {
    if (!postponeModalOpen && !plannedConfirmModalOpen && !assignDoctorReadyModalOpen) return
    const timer = setTimeout(() => {
      plannedPopupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      plannedPopupRef.current?.focus()
    }, 40)
    return () => clearTimeout(timer)
  }, [postponeModalOpen, plannedConfirmModalOpen, assignDoctorReadyModalOpen])

  const handleAssignFromTable = (requestId: string) => {
    const match = admitRequests.find((request) => request.id.slice(0, 4).toUpperCase() === requestId.replace("#AR-", ""))
    if (match) {
      handleOpenAssignModal(match)
    }
  }

  const handleViewInpatient = (admissionId: string) => {
    const match = admissions.find((admission) => admission.id === admissionId)
    if (match) handleOpenDischargeModal(match)
  }

  const handlePlannedAdmissionAction = async (
    admissionId: string,
    action: "ready_to_admit" | "postpone" | "delete"
  ) => {
    const targetAdmission = admissions.find((admission) => admission.id === admissionId)
    if (!targetAdmission) {
      notify({ type: "error", message: "Admission not found." })
      return
    }
    const currentUser = auth.currentUser
    if (!currentUser) {
      notify({ type: "error", message: "You must be logged in." })
      return
    }
    if (action === "postpone") {
      const currentPlannedIso = String(targetAdmission.plannedAdmitAt || targetAdmission.checkInAt || "")
      const parsed = new Date(currentPlannedIso)
      const initialValue = Number.isFinite(parsed.getTime())
        ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : ""
      setPostponeAdmissionId(admissionId)
      setPostponeDateTime(initialValue)
      setPostponeModalOpen(true)
      return
    }
    if (action === "ready_to_admit") {
      const status = String(targetAdmission.status || "")
      const plannedAt = new Date(String(targetAdmission.plannedAdmitAt || targetAdmission.checkInAt || "")).getTime()
      const now = Date.now()
      if (status !== "scheduled") {
        notify({ type: "error", message: "Only scheduled admissions can be marked ready to admit." })
        return
      }
      if (!Number.isFinite(plannedAt) || plannedAt < now || plannedAt > now + DAY_MS) {
        notify({ type: "error", message: "Ready to admit is allowed only within 24 hours before planned time." })
        return
      }
      if (!String(targetAdmission.doctorId || "").trim()) {
        setAssignDoctorReadyAdmissionId(admissionId)
        setAssignDoctorReadyDoctorId("")
        setAssignDoctorReadyModalOpen(true)
        return
      }
    }
    if (action === "ready_to_admit" || action === "delete") {
      setPlannedConfirmAdmissionId(admissionId)
      setPlannedConfirmAction(action)
      setPlannedConfirmModalOpen(true)
      return
    }

    return
  }

  const handleConfirmAssignDoctorAndReady = async () => {
    const admissionId = assignDoctorReadyAdmissionId
    const doctorId = assignDoctorReadyDoctorId
    if (!admissionId || !doctorId) return
    const targetDoctor = doctors.find((doctor) => doctor.uid === doctorId)
    if (!targetDoctor) {
      notify({ type: "error", message: "Selected doctor not found." })
      return
    }
    const currentUser = auth.currentUser
    if (!currentUser) {
      notify({ type: "error", message: "You must be logged in." })
      return
    }
    try {
      setPlannedActionLoadingId(admissionId)
      const token = await currentUser.getIdToken()
      const assignRes = await fetch(`/api/receptionist/admissions/${admissionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doctorId: targetDoctor.uid,
          doctorName: targetDoctor.fullName,
        }),
      })
      const assignData = await assignRes.json().catch(() => ({}))
      if (!assignRes.ok) {
        throw new Error(assignData?.error || "Failed to assign doctor")
      }
      const readyRes = await fetch(`/api/receptionist/admissions/${admissionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plannedAction: "ready_to_admit",
        }),
      })
      const readyData = await readyRes.json().catch(() => ({}))
      if (!readyRes.ok) {
        throw new Error(readyData?.error || "Failed to mark ready to admit")
      }
      notify({ type: "success", message: `Doctor assigned and patient marked admitted: ${targetDoctor.fullName}` })
      setAssignDoctorReadyModalOpen(false)
      setAssignDoctorReadyAdmissionId(null)
      setAssignDoctorReadyDoctorId("")
      fetchAdmissions()
      fetchRooms()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to complete ready to admit flow" })
    } finally {
      setPlannedActionLoadingId(null)
    }
  }

  const handleConfirmPlannedAction = async () => {
    if (!plannedConfirmAdmissionId || !plannedConfirmAction) return
    const currentUser = auth.currentUser
    if (!currentUser) {
      notify({ type: "error", message: "You must be logged in." })
      return
    }
    try {
      setPlannedActionLoadingId(plannedConfirmAdmissionId)
      const token = await currentUser.getIdToken()
      if (plannedConfirmAction === "delete") {
        const res = await fetch(`/api/receptionist/admissions/${plannedConfirmAdmissionId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || "Failed to delete admission")
        }
        notify({ type: "success", message: "Scheduled admission deleted." })
      } else {
        const res = await fetch(`/api/receptionist/admissions/${plannedConfirmAdmissionId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plannedAction: "ready_to_admit",
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || "Failed to mark ready to admit")
        }
        notify({ type: "success", message: "Patient marked as admitted." })
      }
      setPlannedConfirmModalOpen(false)
      setPlannedConfirmAdmissionId(null)
      setPlannedConfirmAction(null)
      fetchAdmissions()
      fetchRooms()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to update planned admission" })
    } finally {
      setPlannedActionLoadingId(null)
    }
  }

  const handleConfirmPostpone = async () => {
    if (!postponeAdmissionId) return
    if (!postponeDateTime) {
      notify({ type: "error", message: "Select new planned date and time." })
      return
    }
    const currentUser = auth.currentUser
    if (!currentUser) {
      notify({ type: "error", message: "You must be logged in." })
      return
    }
    try {
      setPlannedActionLoadingId(postponeAdmissionId)
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/admissions/${postponeAdmissionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plannedAction: "postpone",
          plannedAdmitAt: postponeDateTime,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Failed to postpone admission")
      }
      notify({ type: "success", message: "Planned admission date postponed." })
      setPostponeModalOpen(false)
      setPostponeAdmissionId(null)
      setPostponeDateTime("")
      fetchAdmissions()
      fetchRooms()
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to postpone admission" })
    } finally {
      setPlannedActionLoadingId(null)
    }
  }

  const handleMoreInpatient = (admissionId: string) => {
    const match = admissions.find((admission) => admission.id === admissionId)
    if (!match) return
    setTransferAdmission(match)
    setTransferRoomId("")
    setTransferNotes("")
    setTransferModalOpen(true)
  }

  const handleTransferRoom = async () => {
    if (!transferAdmission) return
    if (!transferRoomId) {
      notify({ type: "error", message: "Select target room to transfer." })
      return
    }
    setTransferLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to transfer room")
      }
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/receptionist/admissions/${transferAdmission.id}/transfer-room`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: transferRoomId,
          notes: transferNotes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to transfer room")
      }
      const data = await res.json().catch(() => ({}))
      const updatedRoom = data?.updatedRoom || {}

      setAdmissions((prev) =>
        prev.map((admission) =>
          admission.id === transferAdmission.id
            ? {
                ...admission,
                roomId: updatedRoom.roomId || admission.roomId,
                roomNumber: updatedRoom.roomNumber || admission.roomNumber,
                roomType: updatedRoom.roomType || admission.roomType,
                roomRatePerDay:
                  updatedRoom.roomRatePerDay !== undefined
                    ? Number(updatedRoom.roomRatePerDay)
                    : admission.roomRatePerDay,
                customRoomTypeName:
                  updatedRoom.customRoomTypeName !== undefined
                    ? updatedRoom.customRoomTypeName
                    : admission.customRoomTypeName || null,
                roomStays: Array.isArray(updatedRoom.roomStays)
                  ? updatedRoom.roomStays
                  : admission.roomStays || [],
              }
            : admission
        )
      )
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id === transferAdmission.roomId) return { ...room, status: "available" }
          if (room.id === transferRoomId) return { ...room, status: "occupied" }
          return room
        })
      )

      notify({ type: "success", message: "Patient room transferred successfully." })
      setTransferModalOpen(false)
      setTransferAdmission(null)
      setTransferRoomId("")
      setTransferNotes("")
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to transfer room" })
    } finally {
      setTransferLoading(false)
    }
  }

  const dischargeChargePreview = useMemo(() => {
    if (!selectedAdmission) {
      return {
        roomTotal: 0,
        roomChargeDays: 0,
        calendarStayDays: 0,
        roomCount: 0,
        doctorRoundFee: 0,
        customPrescriptionCharges: 0,
        customPrescriptionNames: "",
        prescriptionItems: [] as Array<{ label: string; amount: number }>,
        selectedOtherChargeItems: [] as Array<{ label: string; amount: number }>,
        prescriptionTotal: 0,
        extraDischargeCharges: 0,
        estimatedTotal: 0,
        totalDeposited: 0,
        adjustedFromDeposit: 0,
        finalPayable: 0,
        refundDue: 0,
      }
    }
    const nowIso = new Date().toISOString()
    const stays =
      Array.isArray(selectedAdmission.roomStays) && selectedAdmission.roomStays.length > 0
        ? selectedAdmission.roomStays
        : [
            {
              roomId: selectedAdmission.roomId,
              roomNumber: selectedAdmission.roomNumber,
              roomType: selectedAdmission.roomType,
              customRoomTypeName: selectedAdmission.customRoomTypeName || null,
              ratePerDay: Number(selectedAdmission.roomRatePerDay || 0),
              fromAt: selectedAdmission.checkInAt,
              toAt: null,
            },
          ]
    const roomSegments = stays.map((stay) => {
      const stayDays = countCalendarDaysInclusive(String(stay.fromAt || nowIso), String(stay.toAt || nowIso))
      const ratePerDay = Number(stay.ratePerDay || 0)
      return {
        stayDays,
        amount: stayDays * ratePerDay,
      }
    })
    const roomTotal = roomSegments.reduce((sum, segment) => sum + segment.amount, 0)
    const roomChargeDays = roomSegments.reduce((sum, segment) => sum + segment.stayDays, 0)
    const calendarStayDays = countCalendarDaysInclusive(selectedAdmission.checkInAt, nowIso)
    const doctorRoundFee = Number(dischargeDoctorFee || selectedAdmission.charges?.doctorRoundFee || 0)
    const prescriptionItems = [
      { label: "Medicine", amount: Number(selectedAdmission.charges?.medicineCharges || 0) },
      { label: "Injection", amount: Number(selectedAdmission.charges?.injectionCharges || 0) },
      { label: "Bottle", amount: Number(selectedAdmission.charges?.bottleCharges || 0) },
      { label: "Facility", amount: Number(selectedAdmission.charges?.facilityCharges || 0) },
      { label: "Nurse round", amount: Number(selectedAdmission.charges?.nurseRoundFee || 0) },
      { label: "Other", amount: Number(selectedAdmission.charges?.otherCharges || 0) },
    ].filter((item) => item.amount > 0)
    const prescriptionTotalFromItems = prescriptionItems.reduce((sum, item) => sum + item.amount, 0)
    const packageInclusive = Boolean(selectedAdmission.operationPackage)
    const packageRate = Number(selectedAdmission.operationPackage?.fixedRate || 0)
    const packageAdvance = Number(selectedAdmission.operationPackage?.advancePaidAmount || 0)
    const packageDue =
      selectedAdmission.operationPackage?.paymentTiming === "advance"
        ? Math.max(0, packageRate - packageAdvance)
        : packageRate
    const customPrescriptionCharges = Number(dischargePrescriptionCharges || 0)
    const customPrescriptionNames = dischargePrescriptionNames.trim()
    const prescriptionTotal = packageInclusive ? 0 : prescriptionTotalFromItems + customPrescriptionCharges
    const selectedOtherChargeItems = DISCHARGE_OTHER_CHARGE_OPTIONS.filter((option) =>
      dischargeOtherChargeSelections.includes(option.id)
    ).map((item) => ({
      label: item.label,
      amount: Number(dischargeOtherChargeAmounts[item.id] ?? item.amount),
    }))
    const extraDischargeCharges = selectedOtherChargeItems.reduce((sum, item) => sum + item.amount, 0)
    const estimatedTotal = packageInclusive
      ? packageDue
      : roomTotal + doctorRoundFee + prescriptionTotal + extraDischargeCharges
    const totalDeposited = Number(selectedAdmission.depositSummary?.totalDeposited || 0)
    const adjustedFromDeposit = Math.min(totalDeposited, estimatedTotal)
    const finalPayable = Math.max(0, estimatedTotal - totalDeposited)
    const refundDue = Math.max(0, totalDeposited - estimatedTotal)
    return {
      roomTotal,
      roomChargeDays,
      calendarStayDays,
      roomCount: stays.length,
      doctorRoundFee: packageInclusive ? 0 : doctorRoundFee,
      customPrescriptionCharges,
      customPrescriptionNames,
      prescriptionItems: packageInclusive ? [] : prescriptionItems,
      selectedOtherChargeItems: packageInclusive ? [] : selectedOtherChargeItems,
      prescriptionTotal,
      extraDischargeCharges,
      estimatedTotal,
      totalDeposited,
      adjustedFromDeposit,
      finalPayable,
      refundDue,
    }
  }, [
    selectedAdmission,
    dischargeDoctorFee,
    dischargePrescriptionCharges,
    dischargePrescriptionNames,
    dischargeOtherChargeSelections,
    dischargeOtherChargeAmounts,
  ])

  return (
    <div className="space-y-6 bg-slate-50 px-6 py-6 lg:px-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">IPD Control Center</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Manage admissions, monitor admitted patients, and control IPD settings from one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          >
            {dateFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              fetchAdmitRequests()
              fetchAdmissions()
              fetchRooms()
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="flex flex-wrap items-end gap-1.5" role="tablist" aria-label="Admission sections">
          <button
            role="tab"
            aria-selected={activeSubTab === "admitted"}
            onClick={() => setActiveSubTab("admitted")}
            className={ipdSubTabClass(activeSubTab === "admitted")}
          >
            Admissions Desk
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === "dashboard"}
            onClick={() => setActiveSubTab("dashboard")}
            className={ipdSubTabClass(activeSubTab === "dashboard")}
          >
            IPD Dashboard
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === "history"}
            onClick={() => setActiveSubTab("history")}
            className={ipdSubTabClass(activeSubTab === "history")}
          >
            History
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === "settings"}
            onClick={() => setActiveSubTab("settings")}
            className={ipdSubTabClass(activeSubTab === "settings")}
          >
            Settings
          </button>
        </div>
      </section>

      {activeSubTab === "dashboard" && (
        <IpdDashboardSection
          todayOverviewMetrics={todayOverviewMetrics}
          roomOccupancyRate={roomOccupancyRate}
          occupiedRoomsCount={occupiedRoomsCount}
          totalRooms={totalRooms}
          roomRows={roomRows}
          onManageRooms={handleOpenCreateRoom}
          dashboardStats={dashboardStats}
          ipdKpiSummary={ipdKpiSummary}
          ipdFinanceSummary={ipdFinanceSummary}
          openAdmissionsDeskWithFocus={openAdmissionsDeskWithFocus}
          expectedDischargeRows={expectedDischargeRows}
          roundPendingRows={roundPendingRows}
        />
      )}

      {activeSubTab === "settings" && (
        <IpdSettingsSection
          handleSeedRecommendedPackages={handleSeedRecommendedPackages}
          handleOpenCreatePackage={handleOpenCreatePackage}
          managePackageName={managePackageName}
          setManagePackageName={setManagePackageName}
          managePackageRate={managePackageRate}
          setManagePackageRate={setManagePackageRate}
          managePackageRoomStayEnabled={managePackageRoomStayEnabled}
          setManagePackageRoomStayEnabled={setManagePackageRoomStayEnabled}
          managePackageRoomStayDays={managePackageRoomStayDays}
          setManagePackageRoomStayDays={setManagePackageRoomStayDays}
          managePackageRoomType={managePackageRoomType}
          setManagePackageRoomType={setManagePackageRoomType}
          availableRoomTypes={availableRoomTypes}
          packageIncludedItemOptions={PACKAGE_INCLUDED_ITEM_OPTIONS}
          managePackageIncludedItems={managePackageIncludedItems}
          setManagePackageIncludedItems={setManagePackageIncludedItems}
          managePackageExclusions={managePackageExclusions}
          setManagePackageExclusions={setManagePackageExclusions}
          resetPackageForm={resetPackageForm}
          handleSubmitPackage={handleSubmitPackage}
          packageManageLoading={packageManageLoading}
          packageEditId={packageEditId}
          packagesLoading={packagesLoading}
          admissionPackages={admissionPackages}
          handleOpenEditPackage={handleOpenEditPackage}
          handleArchivePackage={handleArchivePackage}
          handleOpenCreateRoom={handleOpenCreateRoom}
          rooms={rooms}
          getRoomTypeDisplayName={getRoomTypeDisplayName}
          handleOpenEditRoom={handleOpenEditRoom}
          handleArchiveRoom={handleArchiveRoom}
        />
      )}

      {activeSubTab === "history" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AdmissionHistoryPanel onNotification={onNotification} />
        </section>
      )}

      {activeSubTab === "admitted" && (
        <AdmissionsDeskSection
          handleOpenDirectAdmitModal={handleOpenDirectAdmitModal}
          admitRequestsError={admitRequestsError}
          requestRows={requestRows}
          admitRequestsLoading={admitRequestsLoading}
          handleAssignFromTable={handleAssignFromTable}
          admittedPatientsSectionRef={admittedPatientsSectionRef}
          handleExportFilteredInpatients={handleExportFilteredInpatients}
          setAdmissionsDeskFocusAll={() => setAdmissionsDeskFocus("all")}
          admissionsError={admissionsError}
          admissionsDeskFocus={admissionsDeskFocus}
          admissionsDeskFocusLabel={admissionsDeskFocusLabel}
          filteredInpatientRows={filteredInpatientRows}
          admissionsLoading={admissionsLoading}
          handleViewInpatient={handleViewInpatient}
          handleMoreInpatient={handleMoreInpatient}
        plannedAdmissions={plannedAdmissions}
        plannedAdmissionsWithin24h={plannedAdmissionsWithin24h}
        onPlannedAction={handlePlannedAdmissionAction}
        onRefreshData={async () => {
          await Promise.all([fetchAdmitRequests(), fetchAdmissions(), fetchRooms()])
        }}
        assignDisabled={assignModalOpen || assignLoading}
        plannedActionLoadingId={plannedActionLoadingId}
        />
      )}

      <AssignRoomModal
        isOpen={assignModalOpen}
        selectedAdmitRequest={selectedAdmitRequest}
        onClose={handleCloseAssignModal}
        roomsLoading={roomsLoading}
        assignRoomType={assignRoomType}
        setAssignRoomType={setAssignRoomType}
        assignRoomId={assignRoomId}
        setAssignRoomId={setAssignRoomId}
        availableRoomTypes={availableRoomTypes}
        availableRoomsForType={availableRoomsForType}
        getRoomTypeDisplayName={getRoomTypeDisplayName}
        rooms={rooms}
        assignInitialDeposit={assignInitialDeposit}
        setAssignInitialDeposit={setAssignInitialDeposit}
        assignInitialDepositMode={assignInitialDepositMode}
        setAssignInitialDepositMode={setAssignInitialDepositMode}
        depositPaymentModes={DEPOSIT_PAYMENT_MODES as unknown as Array<{ value: string; label: string }>}
        assignNotes={assignNotes}
        setAssignNotes={setAssignNotes}
        assignLoading={assignLoading}
        onConfirm={handleAssignRoom}
      />

      <DirectAdmitModal
        isOpen={directAdmitModalOpen}
        onClose={() => setDirectAdmitModalOpen(false)}
        directPatientName={directPatientName}
        setDirectPatientName={setDirectPatientName}
        setDirectPatientUid={setDirectPatientUid}
        setDirectPatientId={setDirectPatientId}
        onClearDirectPatientSelection={handleClearDirectPatientSelectionFields}
        directPatientLookupLoading={directPatientLookupLoading}
        directPatientResults={directPatientResults}
        handleSelectExistingPatient={handleSelectExistingPatient}
        directPatientUid={directPatientUid}
        directPatientId={directPatientId}
        directDoctorId={directDoctorId}
        setDirectDoctorId={setDirectDoctorId}
        setDirectDoctorName={setDirectDoctorName}
        doctorsLoading={doctorsLoading}
        doctors={doctors}
        directDoctorName={directDoctorName}
        directPatientAddress={directPatientAddress}
        setDirectPatientAddress={setDirectPatientAddress}
        directPatientPhone={directPatientPhone}
        setDirectPatientPhone={setDirectPatientPhone}
        directPatientGender={directPatientGender}
        setDirectPatientGender={setDirectPatientGender}
        directPatientAge={directPatientAge}
        setDirectPatientAge={setDirectPatientAge}
        directEmergencyRelativeName={directEmergencyRelativeName}
        setDirectEmergencyRelativeName={setDirectEmergencyRelativeName}
        directPackageId={directPackageId}
        setDirectPackageId={setDirectPackageId}
        admissionPackages={admissionPackages}
        rooms={rooms}
        getRoomTypeFilterKey={getRoomTypeFilterKey}
        setAssignRoomType={setAssignRoomType}
        setAssignRoomId={setAssignRoomId}
        directAdmitType={directAdmitType}
        setDirectAdmitType={setDirectAdmitType}
        directPlannedAdmitAt={directPlannedAdmitAt}
        setDirectPlannedAdmitAt={setDirectPlannedAdmitAt}
        directExpectedDischargeAt={directExpectedDischargeAt}
        setDirectExpectedDischargeAt={setDirectExpectedDischargeAt}
        assignRoomType={assignRoomType}
        assignRoomId={assignRoomId}
        availableRoomTypes={availableRoomTypes}
        availableRoomsForType={availableRoomsForType}
        getRoomTypeDisplayName={getRoomTypeDisplayName}
        directDoctorRoundFee={directDoctorRoundFee}
        setDirectDoctorRoundFee={setDirectDoctorRoundFee}
        directInitialDeposit={directInitialDeposit}
        setDirectInitialDeposit={setDirectInitialDeposit}
        directInitialDepositMode={directInitialDepositMode}
        setDirectInitialDepositMode={setDirectInitialDepositMode}
        depositPaymentModes={DEPOSIT_PAYMENT_MODES as unknown as Array<{ value: string; label: string }>}
        assignNotes={assignNotes}
        setAssignNotes={setAssignNotes}
        directAdmitLoading={directAdmitLoading}
        onCreateAdmission={handleCreateDirectAdmit}
      />

      <TransferRoomModal
        isOpen={transferModalOpen}
        transferAdmission={transferAdmission}
        transferRoomId={transferRoomId}
        setTransferRoomId={setTransferRoomId}
        transferNotes={transferNotes}
        setTransferNotes={setTransferNotes}
        rooms={rooms}
        getRoomTypeDisplayName={getRoomTypeDisplayName}
        transferLoading={transferLoading}
        onClose={() => {
          setTransferModalOpen(false)
          setTransferAdmission(null)
        }}
        onConfirm={handleTransferRoom}
      />

      <RoomManagerModal
        isOpen={roomManagerOpen}
        roomEditId={roomEditId}
        onClose={() => {
          setRoomManagerOpen(false)
          resetRoomManageForm()
        }}
        manageRoomNumber={manageRoomNumber}
        setManageRoomNumber={setManageRoomNumber}
        manageRoomType={manageRoomType}
        setManageRoomType={setManageRoomType}
        manageCustomRoomTypeName={manageCustomRoomTypeName}
        setManageCustomRoomTypeName={setManageCustomRoomTypeName}
        manageRoomRate={manageRoomRate}
        setManageRoomRate={setManageRoomRate}
        manageRoomStatus={manageRoomStatus}
        setManageRoomStatus={setManageRoomStatus}
        roomManageLoading={roomManageLoading}
        onSubmit={handleSubmitRoom}
      />

      {plannedConfirmModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div
            ref={plannedPopupRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none"
          >
            <h3 className="text-base font-semibold text-slate-900">
              {plannedConfirmAction === "delete" ? "Delete scheduled admission" : "Mark ready to admit"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {plannedConfirmAction === "delete"
                ? "This will remove the scheduled admission record."
                : "This will change status from scheduled to admitted and occupy the assigned room."}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPlannedConfirmModalOpen(false)
                  setPlannedConfirmAdmissionId(null)
                  setPlannedConfirmAction(null)
                }}
                disabled={Boolean(plannedActionLoadingId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={plannedConfirmAction === "delete" ? "danger" : "primary"}
                onClick={handleConfirmPlannedAction}
                loading={Boolean(plannedActionLoadingId)}
                loadingText="Processing..."
              >
                {plannedConfirmAction === "delete" ? "Delete Admission" : "Ready to Admit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {postponeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div
            ref={plannedPopupRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none"
          >
            <h3 className="text-base font-semibold text-slate-900">Postpone planned admission</h3>
            <p className="mt-1 text-sm text-slate-500">Select a new admission date and time.</p>
            <div className="mt-4 space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">New planned date & time</label>
              <input
                type="datetime-local"
                value={postponeDateTime}
                onChange={(e) => setPostponeDateTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPostponeModalOpen(false)
                  setPostponeAdmissionId(null)
                  setPostponeDateTime("")
                }}
                disabled={Boolean(plannedActionLoadingId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmPostpone}
                loading={Boolean(plannedActionLoadingId)}
                loadingText="Saving..."
                disabled={!postponeDateTime}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {assignDoctorReadyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div
            ref={plannedPopupRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none"
          >
            <h3 className="text-base font-semibold text-slate-900">Please select doctor</h3>
            <p className="mt-1 text-sm text-slate-500">
              Doctor is required before marking this planned admission as ready to admit.
            </p>
            <div className="mt-4 space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Assign doctor</label>
              <select
                value={assignDoctorReadyDoctorId}
                onChange={(e) => setAssignDoctorReadyDoctorId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.uid} value={doctor.uid}>
                    {doctor.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAssignDoctorReadyModalOpen(false)
                  setAssignDoctorReadyAdmissionId(null)
                  setAssignDoctorReadyDoctorId("")
                }}
                disabled={Boolean(plannedActionLoadingId)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmAssignDoctorAndReady}
                loading={Boolean(plannedActionLoadingId)}
                loadingText="Processing..."
                disabled={!assignDoctorReadyDoctorId}
              >
                Assign & Ready to Admit
              </Button>
            </div>
          </div>
        </div>
      )}

      <AdmissionDetailsModal
        selectedAdmission={selectedAdmission}
        dischargeModalOpen={dischargeModalOpen}
        onClose={() => setSelectedAdmission(null)}
        getRoomTypeDisplayName={getRoomTypeDisplayName}
        updateAdmissionDraft={updateAdmissionDraft}
        admissionPackages={admissionPackages}
        depositTopupAmount={depositTopupAmount}
        setDepositTopupAmount={setDepositTopupAmount}
        depositTopupNote={depositTopupNote}
        setDepositTopupNote={setDepositTopupNote}
        depositTopupPaymentMode={depositTopupPaymentMode}
        setDepositTopupPaymentMode={setDepositTopupPaymentMode}
        depositPaymentModes={DEPOSIT_PAYMENT_MODES as unknown as Array<{ value: string; label: string }>}
        handleAddDepositTopup={handleAddDepositTopup}
        depositTopupLoading={depositTopupLoading}
        admissionDetailsSaving={admissionDetailsSaving}
        billingProcessing={billingProcessing}
        handleSaveAdmissionDetails={handleSaveAdmissionDetails}
        handleProcessBilling={handleProcessBilling}
      />

      <DischargeModal
        isOpen={dischargeModalOpen}
        selectedAdmission={selectedAdmission}
        onClose={handleCloseDischargeModal}
        getRoomTypeDisplayName={getRoomTypeDisplayName}
        depositTopupAmount={depositTopupAmount}
        setDepositTopupAmount={setDepositTopupAmount}
        depositTopupNote={depositTopupNote}
        setDepositTopupNote={setDepositTopupNote}
        depositTopupPaymentMode={depositTopupPaymentMode}
        setDepositTopupPaymentMode={setDepositTopupPaymentMode}
        depositPaymentModes={DEPOSIT_PAYMENT_MODES as unknown as Array<{ value: string; label: string }>}
        handleAddDepositTopup={handleAddDepositTopup}
        depositTopupLoading={depositTopupLoading}
        dischargeDoctorFee={dischargeDoctorFee}
        setDischargeDoctorFee={setDischargeDoctorFee}
        dischargePrescriptionCharges={dischargePrescriptionCharges}
        setDischargePrescriptionCharges={setDischargePrescriptionCharges}
        dischargePrescriptionNames={dischargePrescriptionNames}
        setDischargePrescriptionNames={setDischargePrescriptionNames}
        dischargeOtherChargeSelections={dischargeOtherChargeSelections}
        setDischargeOtherChargeSelections={setDischargeOtherChargeSelections}
        dischargeOtherChargeAmounts={dischargeOtherChargeAmounts}
        setDischargeOtherChargeAmounts={setDischargeOtherChargeAmounts}
        dischargeOtherChargeOptions={DISCHARGE_OTHER_CHARGE_OPTIONS}
        dischargeChargePreview={dischargeChargePreview}
        dischargeNotes={dischargeNotes}
        setDischargeNotes={setDischargeNotes}
        dischargeLoading={dischargeLoading}
        onConfirm={handleDischarge}
      />
    </div>
  )
}
