"use client"

import React from "react"

interface ConsultationLayoutProps {
  queue: React.ReactNode
  workspace: React.ReactNode
  emptyWorkspace?: {
    title: string
    description?: string
  }
  hasSelection?: boolean
  className?: string
}

export default function ConsultationLayout({
  queue,
  workspace,
  emptyWorkspace = {
    title: "Select a patient",
    description: "Choose an appointment from the queue to begin consultation.",
  },
  hasSelection = true,
  className = "",
}: ConsultationLayoutProps) {
  return (
    <div
      className={`consultation-layout ${hasSelection ? "consultation-layout--focused" : ""} ${className}`}
    >
      {hasSelection ? (
        <main className="consultation-layout__workspace consultation-layout__workspace--focused">
          {workspace}
        </main>
      ) : (
        <aside className="consultation-layout__queue consultation-layout__queue--full">
          {queue}
        </aside>
      )}
    </div>
  )
}
