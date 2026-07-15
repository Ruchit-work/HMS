'use client'

import dynamic from 'next/dynamic'
import { TabSkeleton } from '@/shared/components'
const PharmacyManagement = dynamic(
  () => import('@/features/pharmacy/PharmacyManagement'),
  { loading: () => <TabSkeleton variant="dashboard" />, ssr: false }
)

/**
 * Standalone pharmacy portal. Layout provides PharmacyProtected, PharmacyPortalProvider, and PharmacyPortalShell (single header).
 */
export default function PharmacyPortalPage() {
  return <PharmacyManagement />
}
