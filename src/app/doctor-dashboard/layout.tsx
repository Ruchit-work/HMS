import ClinicalWorkspaceShell from "@/components/doctor/clinical/ClinicalWorkspaceShell"

export default function DoctorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ClinicalWorkspaceShell>{children}</ClinicalWorkspaceShell>
}
