"use client"

import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { Building2 } from "lucide-react"

interface HospitalBrandHeaderProps {
  subtitle?: string
  className?: string
}

export default function HospitalBrandHeader({
  subtitle,
  className = "",
}: HospitalBrandHeaderProps) {
  const { activeHospital, isSuperAdmin } = useMultiHospital()

  const logoUrl =
    activeHospital?.settings?.general?.logo ||
    activeHospital?.settings?.print?.logoUrl ||
    (activeHospital as any)?.logoUrl ||
    (activeHospital as any)?.logo

  const displayName = activeHospital?.name || (isSuperAdmin ? "Harmony HMS" : "HMS")
  const defaultSubtitle = isSuperAdmin ? "SaaS platform owner" : "Hospital Portal"
  const finalSubtitle = subtitle !== undefined ? subtitle : defaultSubtitle

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={displayName}
          className="w-7 h-7 object-contain rounded-lg border border-slate-200 bg-white p-0.5 shrink-0 shadow-2xs"
        />
      ) : (
        <div className="w-7 h-7 bg-cyan-600 rounded-lg flex items-center justify-center shrink-0 shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          title={displayName}
          className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[150px]"
        >
          {displayName}
        </p>
        {finalSubtitle ? (
          <p
            title={finalSubtitle}
            className="text-xs text-slate-400 leading-tight truncate max-w-[150px]"
          >
            {finalSubtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}
