"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { auth, db } from "@/firebase/config"
import { doc, getDoc, query, where, onSnapshot } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { fetchPublishedCampaignsForAudience, type Campaign } from "@/utils/campaigns/campaigns"
import CampaignCarousel from "@/components/patient/ui/CampaignCarousel"
import {
  ClinicalFormSection,
  ClinicalLoadingState,
  ClinicalPageFrame,
} from "@/components/doctor/clinical"
import { Button } from "@/components/ui/Button"
import VisitingHoursEditor from "@/components/doctor/schedule/VisitingHoursEditor"
import BlockedDatesManager from "@/components/doctor/schedule/BlockedDatesManager"
import { VisitingHours, BlockedDate, Appointment } from "@/types/patient"
import { DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import Notification from "@/components/ui/feedback/Notification"
import { useNotificationBadge } from "@/hooks/useNotificationBadge"
import type { Branch } from "@/types/branch"
import {
  AppointmentQueueList,
  ClinicNotifications,
  MorningGreeting,
  NextPatientCard,
  QuickClinicalActions,
  TodayScheduleTimeline,
} from "@/components/doctor/dashboard/MorningClinicSections"
import { buildMorningClinicSnapshot } from "@/components/doctor/dashboard/morningClinicUtils"
import { Building2 } from "lucide-react"

interface UserData {
  id: string
  firstName: string
  lastName: string
  specialization: string
  email: string
  role: string
  visitingHours?: VisitingHours
  blockedDates?: BlockedDate[]
  branchIds?: string[]
}

export default function DoctorDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [visitingHours, setVisitingHours] = useState<VisitingHours>(DEFAULT_VISITING_HOURS)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedDrafts, setBlockedDrafts] = useState<BlockedDate[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [navigatingAppointmentId, setNavigatingAppointmentId] = useState<string | null>(null)
  const navigatingRef = useRef(false)

  const { user, loading } = useAuth("doctor")
  const { activeHospitalId } = useMultiHospital()

  const confirmedCount = appointments.filter((apt) => apt.status === "confirmed").length
  const appointmentsBadge = useNotificationBadge({
    badgeKey: "doctor-appointments",
    rawCount: confirmedCount,
  })

  const setupAppointmentsListener = useCallback(
    (doctorId: string, branchId: string | null) => {
      if (!activeHospitalId) return () => {}

      try {
        const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
        const q = branchId
          ? query(appointmentsRef, where("doctorId", "==", doctorId), where("branchId", "==", branchId))
          : query(appointmentsRef, where("doctorId", "==", doctorId))

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const appointmentsList = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Appointment))
            .filter((appointment) => appointment.status !== "whatsapp_pending" && !appointment.whatsappPending)

          setAppointments(appointmentsList)
        })

        return unsubscribe
      } catch {
        return () => {}
      }
    },
    [activeHospitalId]
  )

  useEffect(() => {
    const fetchBranches = async () => {
      if (loading || !user || !activeHospitalId) return

      try {
        setLoadingBranches(true)
        const currentUser = auth.currentUser
        if (!currentUser) return
        const token = await currentUser.getIdToken()

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()

        if (data.success && data.branches) {
          setBranches(data.branches)
        }
      } catch {
        // ignore
      } finally {
        setLoadingBranches(false)
      }
    }

    fetchBranches()
  }, [activeHospitalId, user, loading])

  useEffect(() => {
    if (!user || !activeHospitalId) return

    let unsubscribeAppointments: (() => void) | null = null

    const fetchData = async () => {
      try {
        const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
        if (doctorDoc.exists()) {
          const data = doctorDoc.data() as UserData
          setUserData(data)
          setVisitingHours(data.visitingHours || DEFAULT_VISITING_HOURS)
          setBlockedDates(data.blockedDates || [])

          const branchIds = Array.isArray(data.branchIds) ? data.branchIds : []
          if (branchIds.length === 1) {
            setSelectedBranchId(branchIds[0])
          }

          unsubscribeAppointments = setupAppointmentsListener(user.uid, selectedBranchId)
        }
      } catch {
        // ignore
      }
    }

    fetchData()

    return () => {
      if (unsubscribeAppointments) unsubscribeAppointments()
    }
  }, [user, activeHospitalId, selectedBranchId, setupAppointmentsListener])

  const handleRefreshAppointments = async () => {
    if (user?.uid) {
      setNotification({ type: "success", message: "Appointments are automatically updated in real-time!" })
    }
  }

  const handleSaveSchedule = async () => {
    if (!user?.uid) return

    setSavingSchedule(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to save schedule")
      const token = await currentUser.getIdToken()

      const mergedBlockedDates = [...blockedDates, ...blockedDrafts]

      const res = await fetch("/api/doctor/schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          visitingHours,
          blockedDates: mergedBlockedDates,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Failed to save schedule")
      }
      setNotification({ type: "success", message: "Schedule saved successfully." })
      setBlockedDates(mergedBlockedDates)
      setBlockedDrafts([])
    } catch (error: unknown) {
      setNotification({ type: "error", message: (error as Error).message || "Failed to save schedule" })
    } finally {
      setSavingSchedule(false)
    }
  }

  useEffect(() => {
    if (!user || !activeHospitalId) return
    const loadCampaigns = async () => {
      const published = await fetchPublishedCampaignsForAudience("doctors", activeHospitalId)
      setCampaigns(published)
    }
    loadCampaigns()
  }, [user, activeHospitalId])

  useEffect(() => {
    if (pathname === "/doctor-dashboard/appointments") {
      navigatingRef.current = false
      setNavigatingAppointmentId(null)
    }
  }, [pathname])

  const viewAppointmentDetails = (appointment: Appointment) => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    setNavigatingAppointmentId(appointment.id)
    sessionStorage.setItem("expandAppointmentId", appointment.id)
    router.push("/doctor-dashboard/appointments")
    window.setTimeout(() => {
      if (window.location.pathname !== "/doctor-dashboard/appointments") {
        navigatingRef.current = false
        setNavigatingAppointmentId(null)
      }
    }, 1500)
  }

  const openQueue = () => {
    router.push("/doctor-dashboard/appointments")
  }

  const clinic = useMemo(() => buildMorningClinicSnapshot(appointments), [appointments])

  const doctorBranchIds = Array.isArray(userData?.branchIds) ? userData.branchIds : []
  const visibleBranches =
    doctorBranchIds.length > 0 ? branches.filter((b) => doctorBranchIds.includes(b.id)) : branches
  const hasSingleVisibleBranch = visibleBranches.length === 1

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  if (loading) {
    return <ClinicalLoadingState message="Preparing your clinic…" />
  }

  if (!user) {
    return null
  }

  if (!userData) {
    return <ClinicalLoadingState message="Preparing your clinic…" />
  }

  return (
    <ClinicalPageFrame>
      <MorningGreeting
        doctorName={userData.firstName}
        specialization={userData.specialization}
        waitingCount={clinic.waitingCount}
        pendingCount={clinic.pendingCount}
        followUpCount={clinic.followUpCount}
        reportsCount={clinic.reportsCount}
        emergencyCount={clinic.emergencyCount}
        dateLabel={dateLabel}
        onOpenQueue={openQueue}
      />

      {visibleBranches.length > 0 && (
        <ClinicalFormSection
          title="Branch"
          description="Filter today's operational view by clinic location."
          actions={
            <Building2 className="w-4 h-4 text-slate-400" aria-hidden />
          }
        >
          <select
            value={selectedBranchId || ""}
            onChange={(e) => setSelectedBranchId(e.target.value || null)}
            disabled={loadingBranches}
            className="w-full max-w-md hms-input"
            aria-label="Select branch"
          >
            {!hasSingleVisibleBranch && <option value="">All branches</option>}
            {visibleBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </ClinicalFormSection>
      )}

      {/* Primary clinical row: Next patient + waiting queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        <NextPatientCard
          patient={clinic.nextPatient}
          onStart={viewAppointmentDetails}
          loadingId={navigatingAppointmentId}
        />
        <AppointmentQueueList
          title="Waiting queue"
          subtitle="Patients due now or overdue"
          appointments={clinic.waitingQueue}
          emptyTitle="No one waiting"
          emptyDescription="Patients appear here when their slot time arrives."
          onSelect={viewAppointmentDetails}
        />
      </div>

      {/* Today's schedule — full width */}
      <TodayScheduleTimeline
        appointments={clinic.confirmedToday}
        onSelect={viewAppointmentDetails}
        onRefresh={handleRefreshAppointments}
      />

      {/* Follow-ups, reports, actions, notifications */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 min-w-0 [&>*]:min-w-0">
        <AppointmentQueueList
          title="Follow-ups"
          subtitle="Re-checkups and return visits"
          appointments={clinic.followUps}
          emptyTitle="No follow-ups scheduled"
          emptyDescription="Recheckup appointments will appear here."
          onSelect={viewAppointmentDetails}
          maxItems={5}
        />
        <AppointmentQueueList
          title="Pending reports"
          subtitle="Lab, imaging, or results to review"
          appointments={clinic.pendingReports}
          emptyTitle="No reports flagged"
          emptyDescription={
            <>
              Open{" "}
              <Link href="/doctor-dashboard/settings" className="text-[var(--color-primary)] hover:underline">
                Settings → Documents
              </Link>{" "}
              to browse all files.
            </>
          }
          onSelect={viewAppointmentDetails}
          maxItems={5}
          showTime={false}
        />
        <QuickClinicalActions pendingBadge={appointmentsBadge.displayCount} />
        <ClinicNotifications
          emergencyCases={clinic.emergencyCases}
          unsavedScheduleCount={blockedDrafts.length}
          campaignCount={campaigns.length}
          onSelectPatient={viewAppointmentDetails}
        />
      </div>

      {campaigns.length > 0 && (
        <ClinicalFormSection
          title="Hospital announcements"
          description={`${campaigns.length} active campaign${campaigns.length !== 1 ? "s" : ""}`}
        >
          <CampaignCarousel campaigns={campaigns} />
        </ClinicalFormSection>
      )}

      <ClinicalFormSection
        title="Availability settings"
        description="Visiting hours and blocked dates — saved directly to your profile."
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSaveSchedule}
            loading={savingSchedule}
            loadingText="Saving…"
          >
            Save schedule
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <VisitingHoursEditor value={visitingHours} onChange={setVisitingHours} />
          </div>
          <div>
            <BlockedDatesManager
              blockedDates={blockedDates}
              onChange={setBlockedDates}
              autosave={false}
              draftDates={blockedDrafts}
              onDraftChange={setBlockedDrafts}
            />
            {blockedDrafts.length > 0 && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {blockedDrafts.length} unsaved blocked date{blockedDrafts.length !== 1 ? "s" : ""} — click Save schedule.
              </p>
            )}
          </div>
        </div>
      </ClinicalFormSection>

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </ClinicalPageFrame>
  )
}
