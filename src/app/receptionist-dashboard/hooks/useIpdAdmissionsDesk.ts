"use client"

import { useCallback, useMemo } from "react"
import type { MutableRefObject } from "react"
import type { Admission, AdmissionRequest } from "@/types/patient"
import type { RequestRow } from "@/app/receptionist-dashboard/components/admit-dashboard/RequestTable"
import type { RoomAvailabilityRow } from "@/app/receptionist-dashboard/components/admit-dashboard/RoomAvailability"
import type { InpatientRow } from "@/app/receptionist-dashboard/components/admit-dashboard/InpatientTable"
import type { OverviewMetric } from "@/app/receptionist-dashboard/components/admit-dashboard/OverviewCard"

export type AdmissionsDeskFocus =
  | "all"
  | "doctor_requested_discharge"
  | "expected_discharge_soon"
  | "rounds_pending"
  | "pay_later"

interface RoomAvailabilityByType {
  name: string
  occupied: number
  total: number
}

interface UseIpdAdmissionsDeskParams {
  admitRequests: AdmissionRequest[]
  admissions: Admission[]
  roomAvailabilityByType: RoomAvailabilityByType[]
  admissionsDeskFocus: AdmissionsDeskFocus
  setAdmissionsDeskFocus: (focus: AdmissionsDeskFocus) => void
  setActiveSubTab: (tab: "dashboard" | "admitted" | "settings" | "history") => void
  admittedPatientsSectionRef: MutableRefObject<HTMLElement | null>
  getRoomTypeDisplayName: (room: { roomType: Admission["roomType"]; customRoomTypeName?: string | null }) => string
  pendingCount: number
  admissionsTodayCount: number
  availableRoomsCount: number
}

export function useIpdAdmissionsDesk({
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
}: UseIpdAdmissionsDeskParams) {
  const requestRows = useMemo<RequestRow[]>(() => {
    return admitRequests.map((request) => {
      const requestDate = request.createdAt ? new Date(request.createdAt) : null
      const priority: RequestRow["priority"] = request.notes?.toLowerCase().includes("emergency")
        ? "high"
        : request.notes?.toLowerCase().includes("plan")
          ? "low"
          : "medium"
      return {
        id: `#AR-${request.id.slice(0, 4).toUpperCase()}`,
        patientName: request.patientName || "Unknown Patient",
        patientMeta: `${request.patientId || "PID: N/A"} / ${request.appointmentDetails?.patientPhone || "No phone"}`,
        doctorName: request.doctorName || "Unknown Doctor",
        department: request.appointmentDetails?.doctorSpecialization || "General",
        roomType: request.notes?.toLowerCase().includes("vip") ? "VIP Room" : "General / As available",
        priority,
        requestedAt: requestDate ? requestDate.toLocaleString() : "N/A",
      }
    })
  }, [admitRequests])

  const roomRows = useMemo<RoomAvailabilityRow[]>(() => {
    const colorPalette = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-fuchsia-500", "bg-cyan-500"]
    return roomAvailabilityByType.map((type, index) => ({
      name: type.name,
      occupied: type.occupied,
      total: type.total || 0,
      colorClass: colorPalette[index % colorPalette.length],
    }))
  }, [roomAvailabilityByType])

  const inpatientRows = useMemo<InpatientRow[]>(() => {
    return admissions.map((admission) => {
      const status: InpatientRow["status"] =
        admission.charges?.otherCharges && admission.charges.otherCharges > 1000
          ? "critical"
          : admission.expectedDischargeAt
            ? "improving"
            : "stable"
      return {
        id: admission.id,
        ipdNo: `IPD-${admission.id.slice(0, 6).toUpperCase()}`,
        patientName: admission.patientName || "Unknown",
        patientMeta: `${admission.patientId || "PID: N/A"} / ${admission.patientAddress || "Address not set"}`,
        roomBed: `${admission.roomNumber} / ${getRoomTypeDisplayName({
          roomType: admission.roomType,
          customRoomTypeName: admission.customRoomTypeName || null,
        })}`,
        doctor: admission.doctorName || "Unknown",
        dischargeRequested: admission.dischargeRequest?.status === "pending",
        admittedOn: admission.checkInAt ? new Date(admission.checkInAt).toLocaleString() : "N/A",
        admittedDateISO: admission.checkInAt ? new Date(admission.checkInAt).toISOString().slice(0, 10) : "",
        status,
      }
    })
  }, [admissions, getRoomTypeDisplayName])

  const todayOverviewMetrics = useMemo<OverviewMetric[]>(() => {
    const dischargesToday = 0
    return [
      { label: "New Requests", value: pendingCount, accentClass: "text-violet-700" },
      { label: "Admissions Today", value: admissionsTodayCount, accentClass: "text-emerald-700" },
      { label: "Discharges Today", value: dischargesToday, accentClass: "text-orange-700" },
      { label: "Available Rooms", value: availableRoomsCount, accentClass: "text-blue-700" },
    ]
  }, [pendingCount, admissionsTodayCount, availableRoomsCount])

  const filteredInpatientRows = useMemo(() => {
    if (admissionsDeskFocus === "all") return inpatientRows

    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    return inpatientRows.filter((row) => {
      const admission = admissions.find((entry) => entry.id === row.id)
      if (!admission) return false
      if (admissionsDeskFocus === "doctor_requested_discharge") {
        return admission.dischargeRequest?.status === "pending"
      }
      if (admissionsDeskFocus === "expected_discharge_soon") {
        if (!admission.expectedDischargeAt) return false
        const expectedMs = new Date(admission.expectedDischargeAt).getTime()
        return Number.isFinite(expectedMs) && expectedMs <= now + oneDayMs
      }
      if (admissionsDeskFocus === "rounds_pending") {
        const rounds = Array.isArray(admission.doctorRounds) ? admission.doctorRounds : []
        if (rounds.length === 0) return true
        const lastRoundAt = new Date(String(rounds[rounds.length - 1]?.roundAt || 0)).getTime()
        return !Number.isFinite(lastRoundAt) || now - lastRoundAt > oneDayMs
      }
      if (admissionsDeskFocus === "pay_later") {
        return admission.paymentTerms === "pay_later_after_discharge"
      }
      return true
    })
  }, [admissionsDeskFocus, inpatientRows, admissions])

  const admissionsDeskFocusLabel = useMemo(() => {
    return admissionsDeskFocus === "doctor_requested_discharge"
      ? "Doctor requested discharge"
      : admissionsDeskFocus === "expected_discharge_soon"
        ? "Expected discharge (24h)"
        : admissionsDeskFocus === "rounds_pending"
          ? "Doctor rounds pending"
          : admissionsDeskFocus === "pay_later"
            ? "Pay later cases"
            : null
  }, [admissionsDeskFocus])

  const openAdmissionsDeskWithFocus = useCallback(
    (focus: AdmissionsDeskFocus) => {
      setAdmissionsDeskFocus(focus)
      setActiveSubTab("admitted")
      setTimeout(() => {
        admittedPatientsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    },
    [setAdmissionsDeskFocus, setActiveSubTab, admittedPatientsSectionRef]
  )

  const handleExportFilteredInpatients = useCallback(() => {
    const headers = ["IPD No", "Patient Name", "Patient Meta", "Room / Bed", "Doctor", "Admitted On", "Filter Context"]
    const rows = filteredInpatientRows.map((row) => [
      row.ipdNo,
      row.patientName,
      row.patientMeta,
      row.roomBed,
      row.doctor,
      row.admittedOn,
      admissionsDeskFocusLabel || "All",
    ])
    const escapeCsv = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    const filterSlug = (admissionsDeskFocusLabel || "all").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    link.href = url
    link.download = `ipd-inpatients-${filterSlug}-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredInpatientRows, admissionsDeskFocusLabel])

  return {
    requestRows,
    roomRows,
    inpatientRows,
    todayOverviewMetrics,
    filteredInpatientRows,
    admissionsDeskFocusLabel,
    openAdmissionsDeskWithFocus,
    handleExportFilteredInpatients,
  }
}
