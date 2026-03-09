import PharmacyProtected from '@/components/PharmacyProtected'
import { PharmacyPortalProvider } from '@/contexts/PharmacyPortalContext'
import PharmacyPortalShell from './PharmacyPortalShell'

export default function PharmacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PharmacyProtected>
      <PharmacyPortalProvider>
        <PharmacyPortalShell>{children}</PharmacyPortalShell>
      </PharmacyPortalProvider>
    </PharmacyProtected>
  )
}
