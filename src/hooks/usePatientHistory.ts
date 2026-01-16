import { useState, useCallback } from "react"
import { query, where, getDocs } from "firebase/firestore"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { Appointment as AppointmentType } from "@/types/patient"
import { DocumentMetadata } from "@/types/document"
import { auth } from "@/firebase/config"

export function usePatientHistory() {
  const [patientHistory, setPatientHistory] = useState<AppointmentType[]>([])
  const [historyDocuments, setHistoryDocuments] = useState<{ [appointmentId: string]: DocumentMetadata[] }>({})
  const [historySearchFilters, setHistorySearchFilters] = useState<{ [key: string]: { text: string; date: string } }>({})

  const fetchPatientHistory = useCallback(async (
    appointment: AppointmentType,
    appointmentId: string,
    activeHospitalId: string | null
  ) => {
    if (!appointment.patientId || !activeHospitalId) return

    try {
      const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
      const patientAppointmentsQuery = query(
        appointmentsRef,
        where("patientId", "==", appointment.patientId),
        where("status", "==", "completed")
      )

      const snapshot = await getDocs(patientAppointmentsQuery)
      const history = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AppointmentType))
        .filter((apt: AppointmentType) => apt.id !== appointmentId)
        .sort(
          (a: AppointmentType, b: AppointmentType) =>
            new Date(b.appointmentDate).getTime() -
            new Date(a.appointmentDate).getTime()
        )
      
      setPatientHistory(history)
      setHistorySearchFilters((prev) => ({
        ...prev,
        [appointmentId]: { text: "", date: "" },
      }))

      return history
    } catch (error) {
      console.error("Error fetching patient history:", error)
      return []
    }
  }, [])

  const fetchHistoryDocuments = useCallback(async (appointmentIds: string[], patientUid: string) => {
    if (!patientUid || appointmentIds.length === 0) return

    try {
      const currentUser = auth.currentUser
      if (!currentUser) return

      const token = await currentUser.getIdToken()
      const params = new URLSearchParams()
      params.append("patientUid", patientUid)
      params.append("status", "active")

      const response = await fetch(`/api/documents?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (response.ok && data.documents) {
        const documentsByAppointment: { [appointmentId: string]: DocumentMetadata[] } = {}
        data.documents.forEach((docItem: DocumentMetadata) => {
          if (docItem.appointmentId && appointmentIds.includes(docItem.appointmentId)) {
            if (!documentsByAppointment[docItem.appointmentId]) {
              documentsByAppointment[docItem.appointmentId] = []
            }
            documentsByAppointment[docItem.appointmentId].push(docItem)
          }
        })
        setHistoryDocuments((prev) => ({ ...prev, ...documentsByAppointment }))
      }
    } catch (error) {
      console.error("Error fetching history documents:", error)
    }
  }, [])

  return {
    patientHistory,
    historyDocuments,
    historySearchFilters,
    setHistorySearchFilters,
    fetchPatientHistory,
    fetchHistoryDocuments,
  }
}

