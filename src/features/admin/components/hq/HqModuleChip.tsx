"use client"

/** Entitlement / subscription module chip (Branches · Analytics · Pharmacy) */
export function HqModuleChip({
  on,
  label,
}: {
  on: boolean
  label: string
}) {
  return (
    <span
      className={["hq-ds-module-chip", on ? "hq-ds-module-chip--on" : "hq-ds-module-chip--off"].join(" ")}
      title={label}
    >
      <span className="hq-ds-module-dot" aria-hidden />
      {label}
    </span>
  )
}

export function HqModuleChipRow({
  branches,
  analytics,
  pharmacy,
}: {
  branches?: boolean
  analytics?: boolean
  pharmacy?: boolean
}) {
  return (
    <div className="hq-ds-module-row">
      <HqModuleChip on={branches === true} label="Branches" />
      <HqModuleChip on={analytics !== false} label="Analytics" />
      <HqModuleChip on={pharmacy === true} label="Pharmacy" />
    </div>
  )
}
