"use client"

import React from "react"
import { TabKey } from "@/types/appointments"
import ClinicalEmptyState from "@/components/doctor/clinical/ClinicalEmptyState"

interface EmptyStateProps {
  activeTab: TabKey
}

export default function EmptyState({ activeTab }: EmptyStateProps) {
  const messages: Record<TabKey, { title: string; description: string }> = {
    today: {
      title: "No appointments today",
      description: "Your queue is clear. Enjoy the break or review patient history.",
    },
    tomorrow: {
      title: "No appointments tomorrow",
      description: "Nothing scheduled for tomorrow yet.",
    },
    thisWeek: {
      title: "No appointments this week",
      description: "Your week ahead is open.",
    },
    nextWeek: {
      title: "No appointments next week",
      description: "No visits scheduled for next week.",
    },
    history: {
      title: "No appointment history",
      description: "Completed consultations will appear here.",
    },
  }

  const message = messages[activeTab]

  return (
    <ClinicalEmptyState
      illustration="appointments"
      title={message.title}
      description={message.description}
      action={
        activeTab === "today"
          ? { label: "Need to schedule? Ask reception", href: "/doctor-dashboard/settings" }
          : undefined
      }
    />
  )
}
