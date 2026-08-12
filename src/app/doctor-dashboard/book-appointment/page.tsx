"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DoctorBookAppointmentRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/doctor-dashboard/appointments")
  }, [router])

  return null
}
