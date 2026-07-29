"use client"

import { ReactNode } from "react"
import GlobalHeader from "@/shared/ui/layout/GlobalHeader"
import { MultiHospitalProvider } from "@/providers/MultiHospitalProvider"
import { PrintProvider } from "@/providers/PrintProvider"
import ErrorBoundary from "@/shared/ui/boundaries/ErrorBoundary"
import SpeechRecognitionProvider from "@/shared/ui/SpeechRecognitionProvider"

import { SessionProvider } from "@/providers/SessionProvider"

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
        <MultiHospitalProvider>
          <SessionProvider>
            <PrintProvider>
              <GlobalHeader />
              {children}
            </PrintProvider>
          </SessionProvider>
        </MultiHospitalProvider>
      </SpeechRecognitionProvider>
    </ErrorBoundary>
  )
}
