"use client"

/** Lightweight overview skeleton aligned with clinical admin surfaces. */
export default function AdminOverviewSkeleton() {
  return (
    <div className="admin-ov-skel" aria-busy="true" aria-label="Loading hospital dashboard">
      <div className="admin-ov-skel-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`kpi-${i}`} className="admin-ov-skel-card" />
        ))}
      </div>
      <div className="admin-ov-skel-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`qa-${i}`} className="admin-ov-skel-card" style={{ minHeight: "6.5rem" }} />
        ))}
      </div>
      <div className="admin-ov-skel-grid">
        <div className="admin-ov-skel-panel admin-ov-skel-panel--half" />
        <div className="admin-ov-skel-panel admin-ov-skel-panel--half" />
        <div className="admin-ov-skel-panel" />
      </div>
    </div>
  )
}
