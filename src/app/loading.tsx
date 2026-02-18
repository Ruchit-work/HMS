"use client"

import { usePathname } from "next/navigation"
import LoadingSpinner from "@/components/ui/feedback/StatusComponents"

const routeMessages: { pattern: RegExp; message: string }[] = [
  { pattern: /^\/doctor-dashboard(\/appointments)?/, message: "Loading Doctor Appointments..." },
  { pattern: /^\/doctor-dashboard\/documents/, message: "Loading Doctor Documents..." },
  { pattern: /^\/doctor-dashboard\/analytics/, message: "Loading Doctor Analytics..." },
  { pattern: /^\/doctor-dashboard\/profile/, message: "Loading Doctor Profile..." },
  { pattern: /^\/doctor-dashboard/, message: "Loading Doctor Dashboard..." },
  { pattern: /^\/patient-dashboard\/book-appointment/, message: "Loading Booking Form..." },
  { pattern: /^\/patient-dashboard\/appointments/, message: "Loading Appointments..." },
  { pattern: /^\/patient-dashboard\/profile/, message: "Loading Profile..." },
  { pattern: /^\/patient-dashboard\/services/, message: "Loading Services..." },
  { pattern: /^\/patient-dashboard\/facilities/, message: "Loading Facilities..." },
  { pattern: /^\/patient-dashboard\/about/, message: "Loading About Page..." },
  { pattern: /^\/patient-dashboard\/doctors/, message: "Loading Doctors..." },
  { pattern: /^\/patient-dashboard/, message: "Loading Patient Dashboard..." },
  { pattern: /^\/admin-dashboard/, message: "Loading Admin Dashboard..." },
]

export default function GlobalLoading() {
  const pathname = usePathname() || "/"

  const match = routeMessages.find(({ pattern }) => pattern.test(pathname))
  const message = match ? match.message : "Loading..."

  return <LoadingSpinner message={message} />
}


