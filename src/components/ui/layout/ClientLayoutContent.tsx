"use client"

import { ReactNode } from "react"
import GlobalHeader from "@/components/ui/layout/GlobalHeader"
import { MultiHospitalProvider } from "@/contexts/MultiHospitalContext"
import ErrorBoundary from "@/components/ui/boundaries/ErrorBoundary"
import SpeechRecognitionProvider from "@/components/ui/SpeechRecognitionProvider"

interface ClientLayoutContentProps {
  children: ReactNode
}

/**
 * All body content in one client component so the root layout (server) only
 * mounts a single client boundary. Avoids "Cannot read properties of undefined (reading 'call')"
 * when mixing server layout with client components in Next 15.
 */
export function ClientLayoutContent({ children }: ClientLayoutContentProps) {
  return (
    <ErrorBoundary>
      <SpeechRecognitionProvider>
        <GlobalHeader />
        <MultiHospitalProvider>
          {children}
        </MultiHospitalProvider>
      </SpeechRecognitionProvider>
    </ErrorBoundary>
  )
}
