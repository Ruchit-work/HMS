/**
 * Shared hospital-scoped data for the Hospital Admin Portal.
 * Loads patients / doctors / appointments / billing once per hospital and exposes them
 * so tabs/analytics can reuse instead of re-fetching.
 *
 * Realtime management listeners (PatientManagement, AppointmentManagement badges) stay separate.
 */

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { getDocs } from "firebase/firestore"
import { auth } from "@/firebase/config"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"

export type AdminHospitalRecord = { id: string; [key: string]: any }

export type AdminHospitalBillingRecord = {
  id: string
  status?: string
  paidAt?: string | null
  hospitalId?: string | null
  branchId?: string | null
  totalAmount?: number
  appointmentId?: string
  [key: string]: unknown
}

export type AdminHospitalDataValue = {
  hospitalId: string | null
  patients: AdminHospitalRecord[]
  appointments: AdminHospitalRecord[]
  doctors: AdminHospitalRecord[]
  billingRecords: AdminHospitalBillingRecord[]
  /** Last 5 appointments by createdAt (client-derived — no extra Firestore query). */
  recentAppointments: AdminHospitalRecord[]
  loading: boolean
  billingLoading: boolean
  refreshCore: () => Promise<void>
  refreshBilling: () => Promise<void>
  isProvided: boolean
}

const AdminHospitalDataContext = createContext<AdminHospitalDataValue | null>(null)

const EMPTY: AdminHospitalDataValue = {
  hospitalId: null,
  patients: [],
  appointments: [],
  doctors: [],
  billingRecords: [],
  recentAppointments: [],
  loading: false,
  billingLoading: false,
  refreshCore: async () => {},
  refreshBilling: async () => {},
  isProvided: false,
}

function deriveRecentAppointments(appointments: AdminHospitalRecord[]): AdminHospitalRecord[] {
  return [...appointments]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 5)
}

async function fetchBillingRecords(): Promise<AdminHospitalBillingRecord[]> {
  const currentUser = auth.currentUser
  if (!currentUser) return []
  const token = await currentUser.getIdToken()
  const billingRes = await fetch("/api/admin/billing-records", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  if (!billingRes.ok) return []
  const billingData = await billingRes.json().catch(() => ({}))
  return Array.isArray(billingData?.records) ? billingData.records : []
}

export function AdminHospitalDataProvider({ children }: { children: ReactNode }) {
  const { activeHospitalId } = useMultiHospital()
  const [patients, setPatients] = useState<AdminHospitalRecord[]>([])
  const [appointments, setAppointments] = useState<AdminHospitalRecord[]>([])
  const [doctors, setDoctors] = useState<AdminHospitalRecord[]>([])
  const [billingRecords, setBillingRecords] = useState<AdminHospitalBillingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [billingLoading, setBillingLoading] = useState(false)
  const hospitalIdRef = useRef<string | null>(null)
  hospitalIdRef.current = activeHospitalId

  const refreshCore = useCallback(async () => {
    const hospitalId = hospitalIdRef.current
    if (!hospitalId) {
      setPatients([])
      setAppointments([])
      setDoctors([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [patientsSnapshot, doctorsSnapshot, appointmentsSnapshot] = await Promise.all([
        getDocs(getHospitalCollection(hospitalId, "patients")),
        getDocs(getHospitalCollection(hospitalId, "doctors")),
        getDocs(getHospitalCollection(hospitalId, "appointments")),
      ])

      if (hospitalIdRef.current !== hospitalId) return

      setPatients(patientsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setDoctors(doctorsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
      setAppointments(
        appointmentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      )
    } finally {
      if (hospitalIdRef.current === hospitalId) setLoading(false)
    }
  }, [])

  const refreshBilling = useCallback(async () => {
    const hospitalId = hospitalIdRef.current
    if (!hospitalId) {
      setBillingRecords([])
      return
    }
    setBillingLoading(true)
    try {
      const records = await fetchBillingRecords()
      if (hospitalIdRef.current !== hospitalId) return
      setBillingRecords(records)
    } catch {
      if (hospitalIdRef.current === hospitalId) setBillingRecords([])
    } finally {
      if (hospitalIdRef.current === hospitalId) setBillingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeHospitalId) {
      setPatients([])
      setAppointments([])
      setDoctors([])
      setBillingRecords([])
      setLoading(false)
      return
    }
    void refreshCore()
    void refreshBilling()
  }, [activeHospitalId, refreshCore, refreshBilling])

  const recentAppointments = useMemo(
    () => deriveRecentAppointments(appointments),
    [appointments]
  )

  const value = useMemo<AdminHospitalDataValue>(
    () => ({
      hospitalId: activeHospitalId,
      patients,
      appointments,
      doctors,
      billingRecords,
      recentAppointments,
      loading,
      billingLoading,
      refreshCore,
      refreshBilling,
      isProvided: true,
    }),
    [
      activeHospitalId,
      patients,
      appointments,
      doctors,
      billingRecords,
      recentAppointments,
      loading,
      billingLoading,
      refreshCore,
      refreshBilling,
    ]
  )

  return (
    <AdminHospitalDataContext.Provider value={value}>
      {children}
    </AdminHospitalDataContext.Provider>
  )
}

export function useAdminHospitalData(): AdminHospitalDataValue {
  const ctx = useContext(AdminHospitalDataContext)
  if (!ctx) {
    throw new Error("useAdminHospitalData must be used within AdminHospitalDataProvider")
  }
  return ctx
}

/** Safe outside provider (e.g. receptionist embedding admin tabs). */
export function useAdminHospitalDataOptional(): AdminHospitalDataValue {
  return useContext(AdminHospitalDataContext) ?? EMPTY
}
