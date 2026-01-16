interface StatPillProps {
  label: string
  value: number
  icon: string
}

export const StatPill = ({ label, value, icon }: StatPillProps) => (
  <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 shadow-sm backdrop-blur">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-100/80">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
  </div>
)

