import { DashboardShellSkeleton } from "@/shared/components"

export default function ReceptionistDashboardLoading() {
  return (
    <DashboardShellSkeleton
      ariaLabel="Loading receptionist dashboard"
      asideWidthClass="w-60"
      logoWidthClass="w-32"
      navItemCount={7}
      titleWidthClass="w-48"
      kpiHeightClass="h-24"
      tableHeightClass="h-72"
    />
  )
}
