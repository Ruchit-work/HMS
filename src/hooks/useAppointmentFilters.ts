import { useMemo, useState, useEffect } from "react"
import { Appointment as AppointmentType } from "@/types/patient"
import { TabKey, QueueView } from "@/types/appointments"
import { isToday, isTomorrow, isThisWeek, isNextWeek, sortByDateTime, sortByDateTimeDesc } from "@/utils/appointments/appointmentFilters"
import { isFollowUpAppointment } from "@/features/doctor/dashboard/morningClinicUtils"

export function useAppointmentFilters(
  appointments: AppointmentType[],
  activeTab: TabKey,
  historyTabFilters: { text: string; date: string },
  queueView: QueueView = "all"
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
    () => appointments.filter((apt) => apt.status === "completed" || apt.status === "no_show"),
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

  const completedTodayAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => apt.status === "completed" && isToday(apt.appointmentDate))
        .sort(sortByDateTimeDesc),
    [appointments]
  )

  const followUpAppointments = useMemo(
    () =>
      appointments
        .filter(
          (apt) =>
            (apt.status === "confirmed" || apt.status === "pending") &&
            isFollowUpAppointment(apt)
        )
        .sort(sortByDateTime),
    [appointments]
  )

  const followUpsToday = useMemo(
    () => followUpAppointments.filter((apt) => isToday(apt.appointmentDate)),
    [followUpAppointments]
  )

  const upcomingAppointments = useMemo(
    () =>
      [
        ...tomorrowAppointments,
        ...thisWeekAppointments.filter((a) => !isToday(a.appointmentDate) && !isTomorrow(a.appointmentDate)),
        ...nextWeekAppointments,
      ].sort(sortByDateTime),
    [tomorrowAppointments, thisWeekAppointments, nextWeekAppointments]
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
    let base: AppointmentType[] = []
    switch (activeTab) {
      case "today":
        if (queueView === "completed") {
          base = [...completedTodayAppointments]
        } else if (queueView === "followups") {
          base = [...followUpsToday]
        } else {
          // all + pending → today's confirmed queue
          base = [...todayAppointments]
        }
        break
      case "tomorrow":
        base = [...upcomingAppointments]
        break
      case "thisWeek":
        base = [...thisWeekAppointments]
        break
      case "nextWeek":
        base = [...nextWeekAppointments]
        break
      default:
        base = []
    }
    return base
  }, [
    activeTab,
    queueView,
    todayAppointments,
    tomorrowAppointments,
    thisWeekAppointments,
    nextWeekAppointments,
    completedTodayAppointments,
    followUpsToday,
    upcomingAppointments,
  ])

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
  }, [historyTabFilters, historyPageSize, activeTab, queueView])

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

  const doctorQueueStats = [
    {
      label: "Today",
      value: todayAppointments.length,
      tab: "today" as TabKey,
      queueView: "all" as QueueView,
      hint: "Scheduled visits",
    },
    {
      label: "Pending",
      value: todayAppointments.length,
      tab: "today" as TabKey,
      queueView: "pending" as QueueView,
      hint: "Awaiting consult",
    },
    {
      label: "Completed",
      value: completedTodayAppointments.length,
      tab: "today" as TabKey,
      queueView: "completed" as QueueView,
      hint: "Finished today",
    },
    {
      label: "Follow-ups",
      value: followUpAppointments.length,
      tab: "today" as TabKey,
      queueView: "followups" as QueueView,
      hint: "Re-checkup requests",
    },
    {
      label: "History",
      value: historyAppointments.length,
      tab: "history" as TabKey,
      queueView: "all" as QueueView,
      hint: "Past consultations",
    },
  ]

  const stats = [
    { label: "Today", value: todayAppointments.length },
    { label: "Tomorrow", value: tomorrowAppointments.length },
    { label: "This Week", value: thisWeekAppointments.length },
    { label: "History", value: historyAppointments.length },
  ]

  const tabItems: { key: TabKey; label: string; count: number }[] = [
    { key: "today", label: "Today", count: todayAppointments.length },
    { key: "tomorrow", label: "Upcoming", count: upcomingAppointments.length },
    { key: "thisWeek", label: "This week", count: thisWeekAppointments.length },
    { key: "history", label: "Completed", count: historyAppointments.length },
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
    doctorQueueStats,
    tabItems,
    upcomingAppointments,
    completedTodayAppointments,
    followUpAppointments,
    followUpsToday,
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

