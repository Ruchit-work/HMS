import { useMemo, useState, useEffect } from "react"
import { Appointment as AppointmentType } from "@/types/patient"
import { TabKey } from "@/types/appointments"
import { isToday, isTomorrow, isThisWeek, isNextWeek, sortByDateTime, sortByDateTimeDesc } from "@/utils/appointments/appointmentFilters"

export function useAppointmentFilters(
  appointments: AppointmentType[],
  activeTab: TabKey,
  historyTabFilters: { text: string; date: string }
) {
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [appointmentsPage, setAppointmentsPage] = useState(1)
  const [appointmentsPageSize, setAppointmentsPageSize] = useState(10)

  const confirmedAppointments = useMemo(
    () => appointments.filter((apt) => apt.status === "confirmed"),
    [appointments]
  )

  const historyAppointments = useMemo(
    () => appointments.filter((apt) => apt.status === "completed"),
    [appointments]
  )

  const todayAppointments = useMemo(
    () => confirmedAppointments.filter((apt) => isToday(apt.appointmentDate)),
    [confirmedAppointments]
  )

  const tomorrowAppointments = useMemo(
    () => confirmedAppointments.filter((apt) => isTomorrow(apt.appointmentDate)),
    [confirmedAppointments]
  )

  const thisWeekAppointments = useMemo(
    () => confirmedAppointments.filter((apt) => isThisWeek(apt.appointmentDate)),
    [confirmedAppointments]
  )

  const nextWeekAppointments = useMemo(
    () => confirmedAppointments.filter((apt) => isNextWeek(apt.appointmentDate)),
    [confirmedAppointments]
  )

  const filteredHistoryAppointments = useMemo(() => {
    const normalizedQuery = historyTabFilters.text.trim().toLowerCase()
    return historyAppointments.filter((apt) => {
      const matchesText = normalizedQuery
        ? [
            apt.patientName,
            apt.patientId,
            apt.id,
            apt.chiefComplaint,
            apt.associatedSymptoms,
            apt.medicalHistory,
            apt.doctorNotes,
          ].some((field) => (field || "").toLowerCase().includes(normalizedQuery))
        : true

      const matchesDate = historyTabFilters.date
        ? new Date(apt.appointmentDate).toISOString().split("T")[0] === historyTabFilters.date
        : true

      return matchesText && matchesDate
    })
  }, [historyAppointments, historyTabFilters])

  const totalHistoryPages = useMemo(
    () => Math.max(1, Math.ceil(filteredHistoryAppointments.length / historyPageSize)),
    [filteredHistoryAppointments.length, historyPageSize]
  )

  const paginatedHistoryAppointments = useMemo(() => {
    const sorted = [...filteredHistoryAppointments].sort(sortByDateTimeDesc)
    const startIndex = (historyPage - 1) * historyPageSize
    return sorted.slice(startIndex, startIndex + historyPageSize)
  }, [filteredHistoryAppointments, historyPage, historyPageSize])

  const allNonHistoryAppointments = useMemo(() => {
    switch (activeTab) {
      case "today":
        return [...todayAppointments].sort(sortByDateTime)
      case "tomorrow":
        return [...tomorrowAppointments].sort(sortByDateTime)
      case "thisWeek":
        return [...thisWeekAppointments].sort(sortByDateTime)
      case "nextWeek":
        return [...nextWeekAppointments].sort(sortByDateTime)
      default:
        return []
    }
  }, [activeTab, todayAppointments, tomorrowAppointments, thisWeekAppointments, nextWeekAppointments])

  const totalAppointmentsPages = useMemo(() => {
    if (activeTab === "history") return 1
    return Math.max(1, Math.ceil(allNonHistoryAppointments.length / appointmentsPageSize))
  }, [allNonHistoryAppointments.length, appointmentsPageSize, activeTab])

  const paginatedAppointments = useMemo(() => {
    if (activeTab === "history") {
      return paginatedHistoryAppointments
    }
    const startIndex = (appointmentsPage - 1) * appointmentsPageSize
    return allNonHistoryAppointments.slice(startIndex, startIndex + appointmentsPageSize)
  }, [activeTab, allNonHistoryAppointments, appointmentsPage, appointmentsPageSize, paginatedHistoryAppointments])

  // Reset pages when filters change
  useEffect(() => {
    if (activeTab === "history") {
      setHistoryPage(1)
    } else {
      setAppointmentsPage(1)
    }
  }, [historyTabFilters, historyPageSize, activeTab])

  // Reset page if it exceeds total pages
  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages)
    }
  }, [historyPage, totalHistoryPages])

  useEffect(() => {
    if (appointmentsPage > totalAppointmentsPages && activeTab !== "history") {
      setAppointmentsPage(totalAppointmentsPages)
    }
  }, [appointmentsPage, totalAppointmentsPages, activeTab])

  const stats = [
    { label: "Today", value: todayAppointments.length },
    { label: "Tomorrow", value: tomorrowAppointments.length },
    { label: "This Week", value: thisWeekAppointments.length },
    { label: "History", value: historyAppointments.length },
  ]

  const tabItems: { key: TabKey; label: string; count: number }[] = [
    { key: "today", label: "Today", count: todayAppointments.length },
    { key: "tomorrow", label: "Tomorrow", count: tomorrowAppointments.length },
    { key: "thisWeek", label: "This Week", count: thisWeekAppointments.length },
    { key: "nextWeek", label: "Next Week", count: nextWeekAppointments.length },
    { key: "history", label: "History", count: historyAppointments.length },
  ]

  return {
    todayAppointments,
    tomorrowAppointments,
    thisWeekAppointments,
    nextWeekAppointments,
    historyAppointments,
    filteredHistoryAppointments,
    allNonHistoryAppointments,
    paginatedAppointments,
    stats,
    tabItems,
    historyPage,
    setHistoryPage,
    historyPageSize,
    setHistoryPageSize,
    appointmentsPage,
    setAppointmentsPage,
    appointmentsPageSize,
    setAppointmentsPageSize,
    totalHistoryPages,
    totalAppointmentsPages,
  }
}

