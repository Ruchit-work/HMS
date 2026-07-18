import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/firebase/config"
import { useAppointments } from "@/shared/hooks/useAppointments"
import { Appointment as AppointmentType } from "@/types/patient"
import { UserData } from "@/types/appointments"

export function useDoctorAppointments(
  user: { uid: string } | null,
  activeHospitalId: string | null,
  selectedBranchId: string | null
) {
  const [userData, setUserData] = useState<UserData | null>(null)

  const { appointments, setAppointments } = useAppointments(activeHospitalId, {
    doctorId: user?.uid ?? null,
    branchId: selectedBranchId,
    realtime: true,
    excludeWhatsAppPending: true,
    enabled: Boolean(user && activeHospitalId),
  })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (!cancelled && doctorDoc.exists()) {
        setUserData(doctorDoc.data() as UserData)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  return {
    appointments: appointments as unknown as AppointmentType[],
    userData,
    setAppointments: setAppointments as unknown as Dispatch<SetStateAction<AppointmentType[]>>,
  }
}
