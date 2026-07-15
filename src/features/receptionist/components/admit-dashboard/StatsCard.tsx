"use client"

import { KpiCard } from "@/shared/components/KpiCard"
import type { KpiCardProps } from "@/shared/components/KpiCard"

/** @deprecated Prefer `KpiCard` from `@/shared/components` — identical markup. */
export default function StatsCard(props: KpiCardProps) {
  return <KpiCard {...props} />
}
