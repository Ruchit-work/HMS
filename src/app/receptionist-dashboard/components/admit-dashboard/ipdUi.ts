/** Shared IPD / reception tab and surface styles (teal HMS theme). */

export const ipdSubTabClass = (active: boolean) =>
  [
    "-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
    active
      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]"
      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ")
