"use client"

import React from "react"
import Link from "next/link"
import ClinicalPageHeader from "@/components/doctor/clinical/ClinicalPageHeader"
import { Button } from "@/components/ui/Button"
import { FileDown, RefreshCw, Stethoscope } from "lucide-react"

interface PageHeaderProps {
  variant?: "light" | "dark"
  onGenerateReport: () => void
  onRefresh: () => void
  refreshing: boolean
}

export default function PageHeader({
  onGenerateReport,
  onRefresh,
  refreshing,
}: PageHeaderProps) {
  return (
    <ClinicalPageHeader
      title="Today's consultations"
      subtitle="Review your queue, open the next patient, and complete visits. Scheduling is usually handled by reception."
      icon={<Stethoscope className="w-5 h-5" />}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onGenerateReport}>
            <FileDown className="w-4 h-4" />
            Export report
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            loading={refreshing}
            loadingText="Refreshing…"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Link
            href="/doctor-dashboard/settings"
            className="hidden sm:inline text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline px-1"
          >
            Scheduling (Settings)
          </Link>
        </>
      }
    />
  )
}
