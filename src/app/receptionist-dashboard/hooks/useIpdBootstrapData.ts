"use client"

import { useCallback, useEffect } from "react"
import type { Dispatch, SetStateAction } from "react"
import { collection, getDocs } from "firebase/firestore"
import { auth, db } from "@/firebase/config"
import type { Admission, AdmissionRequest, Room } from "@/types/patient"

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

interface UseIpdBootstrapDataParams {
  fallbackRoomNumbersByType: Record<Room["roomType"], string[]>
  roomTypeRateMap: Record<Room["roomType"], number>
  setRooms: Dispatch<SetStateAction<Room[]>>
  setRoomsLoading: (value: boolean) => void
  setDoctors: (value: DoctorOption[]) => void
  setDoctorsLoading: (value: boolean) => void
  setAdmissionPackages: (value: AdmissionPackageOption[]) => void
  setPackagesLoading: (value: boolean) => void
  setAdmitRequestsLoading: (value: boolean) => void
  setAdmitRequestsError: (value: string | null) => void
  setAdmitRequests: (value: AdmissionRequest[]) => void
  setAdmissionsLoading: (value: boolean) => void
  setAdmissionsError: (value: string | null) => void
  setAdmissions: (value: Admission[]) => void
}

export function useIpdBootstrapData({
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
}: UseIpdBootstrapDataParams) {
  const fetchRooms = useCallback(async () => {
    try {
      setRoomsLoading(true)
      let roomsSnap = await getDocs(collection(db, "rooms"))
      if (roomsSnap.empty) {
        const currentUser = auth.currentUser
        if (currentUser) {
          const token = await currentUser.getIdToken()
          await fetch("/api/admin/rooms/seed", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
        }
        roomsSnap = await getDocs(collection(db, "rooms"))
      }
      let roomsList = roomsSnap.docs.map((r) => {
        const data = r.data() as Omit<Room, "id"> & Partial<Room>
        return { ...data, id: r.id } as Room
      })
      roomsList = roomsList.filter((room) => !(room as any).isArchived)
      if (roomsList.length === 0) {
        roomsList = Object.entries(fallbackRoomNumbersByType).flatMap(([type, numbers]) => {
          const roomTypeId = type as Room["roomType"]
          const rate = roomTypeRateMap[roomTypeId] ?? 0
          return numbers.map((roomNumber) => ({
            id: `demo-${roomNumber}`,
            roomNumber,
            roomType: roomTypeId,
            ratePerDay: rate,
            status: "available" as Room["status"],
          }))
        })
      }
      setRooms(roomsList)
    } finally {
      setRoomsLoading(false)
    }
  }, [fallbackRoomNumbersByType, roomTypeRateMap, setRooms, setRoomsLoading])

  const fetchDoctors = useCallback(async () => {
    try {
      setDoctorsLoading(true)
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to fetch doctors")
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/doctors", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load doctors")
      }
      const data = await res.json().catch(() => ({}))
      const doctorOptions: DoctorOption[] = Array.isArray(data?.doctors) ? data.doctors : []
      setDoctors(doctorOptions)
    } catch {
      setDoctors([])
    } finally {
      setDoctorsLoading(false)
    }
  }, [setDoctors, setDoctorsLoading])

  const fetchAdmissionPackages = useCallback(async () => {
    try {
      setPackagesLoading(true)
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to fetch packages")
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/admission-packages", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load packages")
      }
      const data = await res.json().catch(() => ({}))
      const packages = Array.isArray(data?.packages) ? data.packages : []
      setAdmissionPackages(
        packages.map((pkg: any) => ({
          id: String(pkg.id || ""),
          packageName: String(pkg.packageName || ""),
          fixedRate: Number(pkg.fixedRate || 0),
          includedItems: Array.isArray(pkg.includedItems) ? pkg.includedItems : [],
          preferredRoomType: typeof pkg.preferredRoomType === "string" ? pkg.preferredRoomType : null,
          exclusions: pkg.exclusions || null,
          notes: pkg.notes || null,
        }))
      )
    } catch {
      setAdmissionPackages([])
    } finally {
      setPackagesLoading(false)
    }
  }, [setAdmissionPackages, setPackagesLoading])

  const fetchAdmitRequests = useCallback(async () => {
    try {
      setAdmitRequestsLoading(true)
      setAdmitRequestsError(null)
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to access admission requests")
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/admission-requests", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
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
        appointmentDetails: req.appointmentDetails || null,
      }))
      setAdmitRequests(formatted.filter((req) => req.status === "pending"))
    } catch (error: any) {
      setAdmitRequestsError(error?.message || "Failed to load admission requests")
    } finally {
      setAdmitRequestsLoading(false)
    }
  }, [setAdmitRequests, setAdmitRequestsError, setAdmitRequestsLoading])

  const fetchAdmissions = useCallback(async () => {
    try {
      setAdmissionsLoading(true)
      setAdmissionsError(null)
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to access admissions")
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/admissions?status=admitted&includeAppointmentDetails=false", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
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
        customRoomTypeName: item.customRoomTypeName || null,
        roomRatePerDay: Number(item.roomRatePerDay || 0),
        roomStays: Array.isArray(item.roomStays) ? item.roomStays : [],
        doctorRounds: Array.isArray(item.doctorRounds) ? item.doctorRounds : [],
        clinicalUpdates: Array.isArray(item.clinicalUpdates) ? item.clinicalUpdates : [],
        chargeLineItems: Array.isArray(item.chargeLineItems) ? item.chargeLineItems : [],
        admitType: item.admitType || "doctor_request",
        expectedDischargeAt: item.expectedDischargeAt || null,
        patientAddress: item.patientAddress || null,
        charges: item.charges || undefined,
        paymentTerms: item.paymentTerms || "standard",
        operationPackage: item.operationPackage || null,
        depositSummary: item.depositSummary || undefined,
        depositTransactions: Array.isArray(item.depositTransactions) ? item.depositTransactions : [],
        dischargeRequest: item.dischargeRequest || null,
        status: item.status || "admitted",
        checkInAt: item.checkInAt || new Date().toISOString(),
        checkOutAt: item.checkOutAt || null,
        notes: item.notes || null,
        createdBy: item.createdBy || "receptionist",
        createdAt: item.createdAt || item.checkInAt || new Date().toISOString(),
        updatedAt: item.updatedAt,
        billingId: item.billingId || null,
        appointmentDetails: item.appointmentDetails || null,
      }))
      setAdmissions(formatted.filter((admission) => admission.status === "admitted"))
    } catch (error: any) {
      setAdmissionsError(error?.message || "Failed to load admissions")
    } finally {
      setAdmissionsLoading(false)
    }
  }, [setAdmissions, setAdmissionsError, setAdmissionsLoading])

  useEffect(() => {
    fetchRooms()
    fetchDoctors()
    fetchAdmissionPackages()
    fetchAdmitRequests()
    fetchAdmissions()

    const interval = setInterval(() => {
      fetchAdmitRequests()
      fetchAdmissions()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchRooms, fetchDoctors, fetchAdmissionPackages, fetchAdmitRequests, fetchAdmissions])

  return {
    fetchRooms,
    fetchDoctors,
    fetchAdmissionPackages,
    fetchAdmitRequests,
    fetchAdmissions,
  }
}
