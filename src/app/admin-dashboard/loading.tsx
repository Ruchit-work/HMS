export default function AdminDashboardLoading() {
  return (
    <div className="flex min-h-screen bg-slate-50" aria-busy="true" aria-label="Loading admin dashboard">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <div className="mb-6 h-8 w-36 animate-pulse rounded-lg bg-slate-200" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="mb-6 h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </main>
    </div>
  )
}
