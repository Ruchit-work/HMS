"use client"

/** Skeleton chrome for HQ pages while data loads */
export function HqSkeleton({
  metrics = 6,
  split = true,
}: {
  metrics?: number
  split?: boolean
}) {
  return (
    <div className="hq-ds animate-pulse space-y-3" aria-busy="true" aria-label="Loading platform view">
      <div className="hq-ds-skel h-20 rounded-lg" />
      <div className="hq-ds-metric-grid hq-ds-metric-grid--6">
        {Array.from({ length: metrics }).map((_, i) => (
          <div key={i} className="hq-ds-skel h-16 rounded-lg" />
        ))}
      </div>
      {split ? (
        <div className="hq-ds-workspace hq-ds-workspace--split">
          <div className="hq-ds-skel h-72 rounded-lg" />
          <div className="hq-ds-skel h-72 rounded-lg" />
        </div>
      ) : (
        <div className="hq-ds-skel h-72 rounded-lg" />
      )}
    </div>
  )
}
