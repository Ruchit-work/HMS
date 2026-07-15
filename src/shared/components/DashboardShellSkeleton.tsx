interface DashboardShellSkeletonProps {
  ariaLabel: string
  asideWidthClass?: string
  logoWidthClass?: string
  navItemCount?: number
  titleWidthClass?: string
  kpiHeightClass?: string
  tableHeightClass?: string
}

/** Route-level dashboard shell skeleton (sidebar + KPI grid + table placeholder). */
export function DashboardShellSkeleton({
  ariaLabel,
  asideWidthClass = "w-64",
  logoWidthClass = "w-36",
  navItemCount = 8,
  titleWidthClass = "w-56",
  kpiHeightClass = "h-28",
  tableHeightClass = "h-64",
}: DashboardShellSkeletonProps) {
  return (
    <div className="flex min-h-screen bg-slate-50" aria-busy="true" aria-label={ariaLabel}>
      <aside className={`hidden ${asideWidthClass} shrink-0 border-r border-slate-200 bg-white p-4 md:block`}>
        <div className={`mb-6 h-8 ${logoWidthClass} animate-pulse rounded-lg bg-slate-200`} />
        <div className="space-y-2">
          {Array.from({ length: navItemCount }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className={`mb-6 h-8 ${titleWidthClass} animate-pulse rounded-lg bg-slate-200`} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`${kpiHeightClass} animate-pulse rounded-xl border border-slate-200 bg-white`}
            />
          ))}
        </div>
        <div className={`mt-6 ${tableHeightClass} animate-pulse rounded-xl border border-slate-200 bg-white`} />
      </main>
    </div>
  )
}

export default DashboardShellSkeleton
