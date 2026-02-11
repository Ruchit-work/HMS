"use client"

import React from "react"
import { TabKey } from "@/types/appointments"

interface EmptyStateProps {
  activeTab: TabKey
}

export default function EmptyState({ activeTab }: EmptyStateProps) {
  const messages: Record<TabKey, { title: string; description: string }> = {
    today: {
      title: "No appointments today",
      description: "You have no scheduled appointments for today.",
    },
    tomorrow: {
      title: "No appointments tomorrow",
      description: "You have no scheduled appointments for tomorrow.",
    },
    thisWeek: {
      title: "No appointments this week",
      description: "You have no scheduled appointments for this week.",
    },
    nextWeek: {
      title: "No appointments next week",
      description: "You have no scheduled appointments for next week.",
    },
    history: {
      title: "No appointment history",
      description: "Completed appointments will appear here.",
    },
  }

  const message = messages[activeTab]

  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{message.title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{message.description}</p>
    </div>
  )
}
