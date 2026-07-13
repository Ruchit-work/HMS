'use client'

import dynamic from 'next/dynamic'
import TabSkeleton from '@/components/ui/feedback/TabSkeleton'

const PharmacyManagement = dynamic(
  () => import('@/app/admin-dashboard/Tabs/PharmacyManagement'),
  { loading: () => <TabSkeleton variant="dashboard" />, ssr: false }
)

/**
 * Standalone pharmacy portal. Layout provides PharmacyProtected, PharmacyPortalProvider, and PharmacyPortalShell (single header).
 */
export default function PharmacyPortalPage() {
  return <PharmacyManagement />
}
