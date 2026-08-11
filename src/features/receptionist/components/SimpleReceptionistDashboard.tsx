"use client"

import {
  Users,
  CalendarDays,
  CalendarPlus,
  BedDouble,
  ReceiptText,
  MessageCircle,
  Stethoscope,
  FolderOpen,
  User,
  UserPlus,
  ArrowRight,
} from "lucide-react"
import { prefetchReceptionistTab, type ReceptionistTab } from "./ReceptionistTabPanels"
import type { HospitalReceptionistSettings } from "@/types/hospital"

interface SimpleReceptionistDashboardProps {
  settings: HospitalReceptionistSettings
  userName: string
  badges?: {
    appointments?: number
    admitRequests?: number
    billing?: number
    whatsappBookings?: number
  }
  onTabChange: (tab: ReceptionistTab) => void
}

interface ModuleCardDef {
  id: string
  tab: ReceptionistTab
  title: string
  description: string
  icon: any
  badgeCount?: number
}

export default function SimpleReceptionistDashboard({
  settings,
  userName,
  badges = {},
  onTabChange,
}: SimpleReceptionistDashboardProps) {
  const enabledMap = settings.enabledModules || {}

  const allCards: ModuleCardDef[] = [
    {
      id: "add-patient",
      tab: "add-patient",
      title: "Add New Patient",
      description: "Register a new patient profile in the hospital database",
      icon: UserPlus,
    },
    {
      id: "patients",
      tab: "patients",
      title: "Patient History",
      description: "Search and inspect patient profiles & clinical history",
      icon: Users,
    },
    {
      id: "book-appointment",
      tab: "book-appointment",
      title: "Book Appointment",
      description: "Schedule consultations for existing or new patients",
      icon: CalendarPlus,
    },
    {
      id: "appointments",
      tab: "appointments",
      title: "Appointments List",
      description: "Manage scheduled, confirmed, and ongoing appointments",
      icon: CalendarDays,
      badgeCount: badges.appointments,
    },
    {
      id: "admit-requests",
      tab: "admit-requests",
      title: "IPD Admissions",
      description: "Process pending bed requests and assign rooms",
      icon: BedDouble,
      badgeCount: badges.admitRequests,
    },
    {
      id: "billing",
      tab: "billing",
      title: "Billing & Payments",
      description: "Collect payments, generate invoices, and print receipts",
      icon: ReceiptText,
      badgeCount: badges.billing,
    },
    {
      id: "whatsapp-bookings",
      tab: "whatsapp-bookings",
      title: "WhatsApp Bookings",
      description: "Approve or reschedule incoming WhatsApp slot requests",
      icon: MessageCircle,
      badgeCount: badges.whatsappBookings,
    },
    {
      id: "doctors",
      tab: "doctors",
      title: "Doctors Directory",
      description: "Check doctor availability, specialties, and schedules",
      icon: Stethoscope,
    },
    {
      id: "documents",
      tab: "documents",
      title: "Document Vault",
      description: "Upload and access medical records and reports",
      icon: FolderOpen,
    },
    {
      id: "profile",
      tab: "profile",
      title: "My Profile",
      description: "Manage personal account information and credentials",
      icon: User,
    },
  ]

  // Filter cards by enabled modules config (excluding overview dashboard card if in simple mode grid)
  const activeCards = allCards.filter((card) => enabledMap[card.id] !== false)
  const count = activeCards.length

  const renderCard = (card: ModuleCardDef, extraClass = "") => {
    const IconComp = card.icon
    return (
      <div
        key={card.id}
        onClick={() => onTabChange(card.tab)}
        onMouseEnter={() => prefetchReceptionistTab(card.tab)}
        className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-cyan-600 hover:shadow-md transition-all duration-200 cursor-pointer ${extraClass}`}
      >
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-cyan-600 group-hover:text-white transition-colors shrink-0">
              <IconComp className="h-6 w-6" />
            </div>

            {card.badgeCount && card.badgeCount > 0 ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                {card.badgeCount} Pending
              </span>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
            {card.title}
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            {card.description}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs font-semibold text-cyan-600 group-hover:text-cyan-700">Open</span>
          <ArrowRight className="h-4 w-4 text-cyan-600 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Greeting Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Welcome, {userName || "Receptionist"}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select an action card below to access hospital reception tasks.
          </p>
        </div>
      </div>

      {/* Grid Layout Rules:
          - 1 module -> centered single large card
          - 2 modules -> two equal cards side-by-side
          - 3 modules -> one centered card top row, two cards below
          - 4 modules -> 2x2 grid
          - 5+ modules -> balanced responsive grid
      */}
      {count === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
          <p className="text-sm font-bold">No Receptionist Modules Enabled</p>
          <p className="text-xs text-amber-700 mt-1">
            Please ask the hospital admin to enable receptionist modules under Hospital Settings → Receptionist Settings.
          </p>
        </div>
      ) : count === 1 ? (
        <div className="max-w-md mx-auto">
          {renderCard(activeCards[0], "min-h-[190px]")}
        </div>
      ) : count === 2 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {activeCards.map((c) => renderCard(c, "min-h-[190px]"))}
        </div>
      ) : count === 3 ? (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="max-w-md mx-auto">
            {renderCard(activeCards[0], "min-h-[190px]")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {renderCard(activeCards[1], "min-h-[190px]")}
            {renderCard(activeCards[2], "min-h-[190px]")}
          </div>
        </div>
      ) : count === 4 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {activeCards.map((c) => renderCard(c, "min-h-[190px]"))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {activeCards.map((c) => renderCard(c, "min-h-[180px]"))}
        </div>
      )}
    </div>
  )
}
