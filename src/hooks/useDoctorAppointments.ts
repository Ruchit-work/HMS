import { useEffect, useState } from "react"
import { doc, getDoc, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/firebase/config"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { Appointment as AppointmentType } from "@/types/patient"
import { UserData } from "@/types/appointments"

export function useDoctorAppointments(
  user: { uid: string } | null,
  activeHospitalId: string | null,
  selectedBranchId: string | null
) {
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [userData, setUserData] = useState<UserData | null>(null)

  useEffect(() => {
    if (!user || !activeHospitalId) return

    const setupRealtimeListeners = async () => {
      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const data = doctorDoc.data() as UserData
        setUserData(data)
      }

      const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
      let q
      if (selectedBranchId) {
        q = query(appointmentsRef, where("doctorId", "==", user.uid), where("branchId", "==", selectedBranchId))
      } else {
        q = query(appointmentsRef, where("doctorId", "==", user.uid))
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const appointmentsList = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AppointmentType))
            .filter((appointment) => {
              const appt = appointment as any
              return appt.status !== "whatsapp_pending" && !appt.whatsappPending
            })

          setAppointments(appointmentsList)
        },
        () => {}
      )

      return unsubscribe
    }

    let unsubscribe: (() => void) | null = null

    const initializeRealtimeData = async () => {
      unsubscribe = await setupRealtimeListeners()
    }

    initializeRealtimeData()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user, activeHospitalId, selectedBranchId])

  return { appointments, userData, setAppointments }
}

