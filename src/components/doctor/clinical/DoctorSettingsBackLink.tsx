"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"

export default function DoctorSettingsBackLink() {
  const pathname = usePathname()
  if (!pathname || pathname.startsWith("/doctor-dashboard/settings")) return null

  const secondaryRoutes = [
    "/doctor-dashboard/profile",
    "/doctor-dashboard/about",
    "/doctor-dashboard/analytics",
    "/doctor-dashboard/documents",
    "/doctor-dashboard/book-appointment",
  ]

  if (!secondaryRoutes.some((r) => pathname.startsWith(r))) return null

  return (
    <Link
      href="/doctor-dashboard/settings"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 mb-3 transition-colors"
    >
      <ChevronLeft className="w-3.5 h-3.5" />
      Back to Settings
    </Link>
  )
}
