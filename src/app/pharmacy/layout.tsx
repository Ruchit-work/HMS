import PharmacyProtected from '@/features/auth/PharmacyProtected'
import { PharmacyPortalProvider } from '@/providers/PharmacyPortalProvider'
import PharmacyPortalShell from '@/features/pharmacy/PharmacyPortalShell'

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
