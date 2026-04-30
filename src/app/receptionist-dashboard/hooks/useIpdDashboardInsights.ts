"use client"

import { useMemo } from "react"
import { BedDouble, Building2, Clock3, Users } from "lucide-react"
import type { Admission, Room } from "@/types/patient"

interface UseIpdDashboardInsightsParams {
  rooms: Room[]
  admissions: Admission[]
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  pendingCount: number
  availableRoomsCount: number
  occupiedRoomsCount: number
  totalRooms: number
  roomOccupancyRate: number
  admissionsCount: number
}

export function useIpdDashboardInsights({
  rooms,
  admissions,
  getRoomTypeDisplayName,
  pendingCount,
  availableRoomsCount,
  occupiedRoomsCount,
  totalRooms,
  roomOccupancyRate,
  admissionsCount,
}: UseIpdDashboardInsightsParams) {
  const dashboardStats = useMemo(() => {
    return [
      {
        title: "Pending Requests",
        value: pendingCount,
        subtitle: "Awaiting assignment",
        icon: Clock3,
        accentClass: "bg-purple-500",
      },
      {
        title: "Available Rooms",
        value: availableRoomsCount,
        subtitle: totalRooms ? `${availableRoomsCount}/${totalRooms} ready` : "No rooms synced",
        icon: BedDouble,
        accentClass: "bg-blue-500",
      },
      {
        title: "Occupied Beds",
        value: occupiedRoomsCount,
        subtitle: `${roomOccupancyRate}% occupancy`,
        icon: Building2,
        accentClass: "bg-emerald-500",
      },
      {
        title: "Admitted Patients",
        value: admissionsCount,
        subtitle: "Active inpatients",
        icon: Users,
        accentClass: "bg-orange-500",
      },
    ]
  }, [pendingCount, availableRoomsCount, totalRooms, occupiedRoomsCount, roomOccupancyRate, admissionsCount])

  const ipdKpiSummary = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const doctorRequestedDischarge = admissions.filter((admission) => admission.dischargeRequest?.status === "pending").length
    const expectedDischargeSoon = admissions.filter((admission) => {
      if (!admission.expectedDischargeAt) return false
      const expected = new Date(admission.expectedDischargeAt).getTime()
      if (!Number.isFinite(expected)) return false
      return expected <= now + oneDayMs
    }).length
    const roundsPending = admissions.filter((admission) => {
      const rounds = Array.isArray(admission.doctorRounds) ? admission.doctorRounds : []
      if (rounds.length === 0) return true
      const latestRoundAt = new Date(String(rounds[rounds.length - 1]?.roundAt || 0)).getTime()
      if (!Number.isFinite(latestRoundAt)) return true
      return now - latestRoundAt > oneDayMs
    }).length
    return {
      doctorRequestedDischarge,
      expectedDischargeSoon,
      roundsPending,
    }
  }, [admissions])

  const expectedDischargeRows = useMemo(() => {
    const now = Date.now()
    return admissions
      .filter((admission) => Boolean(admission.expectedDischargeAt))
      .map((admission) => {
        const expectedAt = String(admission.expectedDischargeAt)
        const expectedMs = new Date(expectedAt).getTime()
        const overdue = Number.isFinite(expectedMs) && expectedMs < now
        return {
          id: admission.id,
          patientName: admission.patientName || "Unknown patient",
          roomNumber: admission.roomNumber || "—",
          doctorName: admission.doctorName || "—",
          expectedAt,
          overdue,
        }
      })
      .sort((a, b) => new Date(a.expectedAt).getTime() - new Date(b.expectedAt).getTime())
      .slice(0, 6)
  }, [admissions])

  const roundPendingRows = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    return admissions
      .map((admission) => {
        const rounds = Array.isArray(admission.doctorRounds) ? admission.doctorRounds : []
        const latestRoundAt = rounds.length > 0 ? String(rounds[rounds.length - 1]?.roundAt || "") : ""
        const latestRoundMs = latestRoundAt ? new Date(latestRoundAt).getTime() : NaN
        const pending = rounds.length === 0 || !Number.isFinite(latestRoundMs) || now - latestRoundMs > oneDayMs
        return {
          id: admission.id,
          patientName: admission.patientName || "Unknown patient",
          doctorName: admission.doctorName || "—",
          latestRoundAt,
          pending,
        }
      })
      .filter((row) => row.pending)
      .slice(0, 6)
  }, [admissions])

  const ipdFinanceSummary = useMemo(() => {
    const totalDeposited = admissions.reduce((sum, admission) => sum + Number(admission.depositSummary?.totalDeposited || 0), 0)
    const totalAdjusted = admissions.reduce((sum, admission) => sum + Number(admission.depositSummary?.totalAdjusted || 0), 0)
    const depositBalance = admissions.reduce((sum, admission) => sum + Number(admission.depositSummary?.balance || 0), 0)
    const payLaterCases = admissions.filter((admission) => admission.paymentTerms === "pay_later_after_discharge").length
    const packageCases = admissions.filter((admission) => Boolean(admission.operationPackage)).length
    return { totalDeposited, totalAdjusted, depositBalance, payLaterCases, packageCases }
  }, [admissions])

  const roomAvailabilityByType = useMemo(() => {
    const grouped = new Map<string, { name: string; available: number; occupied: number; total: number }>()
    rooms.forEach((room) => {
      const key = room.roomType === "custom" ? `custom:${room.customRoomTypeName || "Custom Room Type"}` : room.roomType
      const name = getRoomTypeDisplayName(room)
      const current = grouped.get(key) || { name, available: 0, occupied: 0, total: 0 }
      current.total += 1
      if (room.status === "available") current.available += 1
      if (room.status === "occupied") current.occupied += 1
      grouped.set(key, current)
    })
    return Array.from(grouped.entries()).map(([id, value]) => ({
      id,
      name: value.name,
      available: value.available,
      occupied: value.occupied,
      total: value.total,
    }))
  }, [rooms, getRoomTypeDisplayName])

  return {
    dashboardStats,
    ipdKpiSummary,
    expectedDischargeRows,
    roundPendingRows,
    ipdFinanceSummary,
    roomAvailabilityByType,
  }
}
