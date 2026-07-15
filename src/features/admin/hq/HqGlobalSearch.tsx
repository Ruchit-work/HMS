"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore"
import {
  Search,
  Building2,
  Stethoscope,
  Users,
  CalendarDays,
  UserCog,
  GitBranch,
  ReceiptText,
  CreditCard,
  LifeBuoy,
  Bell,
  ArrowRight,
  CornerDownLeft,
  Loader2,
  LayoutDashboard,
  Activity,
  Command,
  Settings,
  Layers,
} from "lucide-react"
import { auth, db } from "@/firebase/config"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { deriveTenantPlan, type HqTenantPlan } from "./HqTenantCard"

export type HqGlobalSearchTab =
  | "overview"
  | "hospitals"
  | "admins"
  | "monitoring"
  | "subscriptions"
  | "activity"
  | "analytics"
  | "patients"
  | "doctors"
  | "appointments"
  | "billing"
  | "branches"
  | "staff"
  | "account"

export type HqGlobalSearchNavigate = {
  tab: HqGlobalSearchTab
  hospitalId?: string
}

type CategoryId =
  | "hospitals"
  | "doctors"
  | "patients"
  | "appointments"
  | "admins"
  | "branches"
  | "invoices"
  | "subscriptions"
  | "tickets"
  | "notifications"
  | "commands"

type SearchHit = {
  id: string
  category: CategoryId
  title: string
  subtitle: string
  keywords: string
  hospitalId?: string
  icon: ReactNode
  actions: Array<{ label: string; run: () => void }>
}

type IndexDoc = Omit<SearchHit, "actions" | "icon"> & {
  kind: CategoryId
}

const CATEGORY_META: Record<
  CategoryId,
  { label: string; emptyHint?: string }
> = {
  commands: { label: "Quick jump" },
  hospitals: { label: "Tenants" },
  doctors: { label: "Doctors" },
  patients: { label: "Patients" },
  appointments: { label: "Appointments" },
  admins: { label: "Tenant Admins" },
  branches: { label: "Branches" },
  invoices: { label: "Invoices" },
  subscriptions: { label: "Subscriptions" },
  tickets: {
    label: "Support Tickets",
    emptyHint: "Support tickets are not instrumented on this platform yet.",
  },
  notifications: { label: "Notifications" },
}

const CATEGORY_ORDER: CategoryId[] = [
  "commands",
  "hospitals",
  "subscriptions",
  "admins",
  "branches",
  "doctors",
  "patients",
  "appointments",
  "invoices",
  "notifications",
  "tickets",
]

let cachedIndex: IndexDoc[] | null = null
let cachePromise: Promise<IndexDoc[]> | null = null
let cacheAt = 0
const CACHE_TTL_MS = 90_000

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = normalize(haystack)
  const n = normalize(needle)
  if (!n) return 1
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(` ${n}`)) return 60
  if (h.includes(n)) return 40
  const parts = n.split(" ").filter(Boolean)
  if (parts.length > 1 && parts.every((p) => h.includes(p))) return 30
  return 0
}

function planLabel(plan: HqTenantPlan) {
  return `${plan} plan`
}

async function buildIndex(preferredHospitalId?: string | null): Promise<IndexDoc[]> {
  const docs: IndexDoc[] = []

  const hospitalsSnap = await getDocs(query(collection(db, "hospitals"), orderBy("createdAt", "desc")))
  const hospitals: Array<Record<string, unknown> & { id: string }> = hospitalsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }))

  for (const h of hospitals) {
    const name = String(h.name || "Hospital")
    const code = String(h.code || "")
    const status = String(h.status || "inactive")
    const plan = deriveTenantPlan({
      multipleBranchesEnabled: h.multipleBranchesEnabled === true,
      enableAnalytics: h.enableAnalytics !== false,
      enablePharmacy: h.enablePharmacy === true,
    })
    docs.push({
      id: `hospital:${h.id}`,
      kind: "hospitals",
      category: "hospitals",
      title: name,
      subtitle: `${code || "—"} · ${status} · ${planLabel(plan)}`,
      keywords: `${name} ${code} ${status} ${plan} hospital tenant`,
      hospitalId: h.id,
    })
    docs.push({
      id: `sub:${h.id}`,
      kind: "subscriptions",
      category: "subscriptions",
      title: `${name} · ${plan}`,
      subtitle: `Subscription · ${status}`,
      keywords: `${name} ${code} ${plan} subscription renew upgrade`,
      hospitalId: h.id,
    })
  }

  try {
    const adminsSnap = await getDocs(collection(db, "admins"))
    const hospitalNameById = new Map(hospitals.map((h) => [h.id, String(h.name || "")]))
    for (const d of adminsSnap.docs) {
      const a = d.data() as Record<string, unknown>
      const first = String(a.firstName || "")
      const last = String(a.lastName || "")
      const email = String(a.email || "")
      const hospitalId = String(a.hospitalId || "")
      const name = [first, last].filter(Boolean).join(" ") || email || "Admin"
      const hospitalName = hospitalNameById.get(hospitalId) || "Unassigned"
      docs.push({
        id: `admin:${d.id}`,
        kind: "admins",
        category: "admins",
        title: name,
        subtitle: `${email}${a.isSuperAdmin ? " · Super Admin" : ""} · ${hospitalName}`,
        keywords: `${name} ${email} admin ${hospitalName}`,
        hospitalId: hospitalId || undefined,
      })
    }
  } catch {
    /* ignore */
  }

  try {
    const branchesSnap = await getDocs(query(collection(db, "branches"), limit(200)))
    const hospitalNameById = new Map(hospitals.map((h) => [h.id, String(h.name || "")]))
    for (const d of branchesSnap.docs) {
      const b = d.data() as Record<string, unknown>
      const name = String(b.name || "Branch")
      const location = String(b.location || "")
      const hospitalId = String(b.hospitalId || "")
      const hospitalName = hospitalNameById.get(hospitalId) || "Hospital"
      docs.push({
        id: `branch:${d.id}`,
        kind: "branches",
        category: "branches",
        title: name,
        subtitle: `${location || "—"} · ${hospitalName}`,
        keywords: `${name} ${location} branch ${hospitalName}`,
        hospitalId: hospitalId || undefined,
      })
    }
  } catch {
    /* ignore */
  }

  const activeIds = hospitals
    .filter((h) => String(h.status || "") === "active")
    .map((h) => h.id)
  const orderedHospitalIds = [
    ...(preferredHospitalId && activeIds.includes(preferredHospitalId) ? [preferredHospitalId] : []),
    ...activeIds.filter((id) => id !== preferredHospitalId),
  ].slice(0, 10)

  await Promise.all(
    orderedHospitalIds.map(async (hospitalId) => {
      const hospitalName = String(hospitals.find((h) => h.id === hospitalId)?.name || "Hospital")
      try {
        const snap = await getDocs(query(getHospitalCollection(hospitalId, "doctors"), limit(40)))
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>
          const name =
            [data.firstName, data.lastName].filter(Boolean).join(" ") ||
            String(data.name || "Doctor")
          const spec = String(data.specialization || "")
          const email = String(data.email || "")
          docs.push({
            id: `doctor:${hospitalId}:${d.id}`,
            kind: "doctors",
            category: "doctors",
            title: name,
            subtitle: `${spec || "Clinician"} · ${hospitalName}`,
            keywords: `${name} ${spec} ${email} doctor ${hospitalName}`,
            hospitalId,
          })
        }
      } catch {
        /* ignore */
      }
      try {
        const snap = await getDocs(query(getHospitalCollection(hospitalId, "patients"), limit(40)))
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>
          const name =
            [data.firstName, data.lastName].filter(Boolean).join(" ") ||
            String(data.fullName || data.name || "Patient")
          const phone = String(data.phone || data.phoneNumber || "")
          const pid = String(data.patientId || d.id)
          docs.push({
            id: `patient:${hospitalId}:${d.id}`,
            kind: "patients",
            category: "patients",
            title: name,
            subtitle: `${pid} · ${phone || "—"} · ${hospitalName}`,
            keywords: `${name} ${pid} ${phone} patient ${hospitalName}`,
            hospitalId,
          })
        }
      } catch {
        /* ignore */
      }
      try {
        const snap = await getDocs(query(getHospitalCollection(hospitalId, "appointments"), limit(40)))
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>
          const patientName = String(data.patientName || "Patient")
          const doctorName = String(data.doctorName || "Doctor")
          const date = String(data.appointmentDate || "")
          const time = String(data.appointmentTime || "")
          const status = String(data.status || "")
          docs.push({
            id: `appt:${hospitalId}:${d.id}`,
            kind: "appointments",
            category: "appointments",
            title: `${patientName} → ${doctorName}`,
            subtitle: `${date} ${time} · ${status} · ${hospitalName}`,
            keywords: `${patientName} ${doctorName} ${date} ${status} appointment ${hospitalName}`,
            hospitalId,
          })
        }
      } catch {
        /* ignore */
      }
    }),
  )

  try {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      const res = await fetch("/api/admin/billing-records", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
        for (const r of records.slice(0, 80)) {
          const id = String(r.id || "")
          const patientName = String(r.patientName || "Patient")
          const amount = Number(r.totalAmount || 0)
          const status = String(r.status || "")
          const hospitalId = r.hospitalId ? String(r.hospitalId) : undefined
          docs.push({
            id: `invoice:${id}`,
            kind: "invoices",
            category: "invoices",
            title: `Invoice · ${patientName}`,
            subtitle: `₹${Number.isFinite(amount) ? amount.toLocaleString("en-IN") : "—"} · ${status} · ${id.slice(0, 8)}`,
            keywords: `${patientName} invoice billing ${status} ${id} ${amount}`,
            hospitalId,
          })
        }
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const notifSnap = await getDocs(query(collection(db, "notifications"), limit(50)))
    for (const d of notifSnap.docs) {
      const n = d.data() as Record<string, unknown>
      const title = String(n.title || "Notification")
      const message = String(n.message || "")
      const type = String(n.type || "")
      docs.push({
        id: `notif:${d.id}`,
        kind: "notifications",
        category: "notifications",
        title,
        subtitle: message.slice(0, 90) || type || "Platform notification",
        keywords: `${title} ${message} ${type} notification`,
      })
    }
  } catch {
    /* ignore */
  }

  return docs
}

function ensureIndex(preferredHospitalId?: string | null) {
  const stale = !cachedIndex || Date.now() - cacheAt > CACHE_TTL_MS
  if (!stale && cachedIndex) return Promise.resolve(cachedIndex)
  if (cachePromise && !stale) return cachePromise
  cachePromise = buildIndex(preferredHospitalId)
    .then((docs) => {
      cachedIndex = docs
      cacheAt = Date.now()
      return docs
    })
    .finally(() => {
      cachePromise = null
    })
  return cachePromise
}

function categoryIcon(category: CategoryId, className = "h-4 w-4") {
  switch (category) {
    case "hospitals":
      return <Building2 className={className} />
    case "doctors":
      return <Stethoscope className={className} />
    case "patients":
      return <Users className={className} />
    case "appointments":
      return <CalendarDays className={className} />
    case "admins":
      return <UserCog className={className} />
    case "branches":
      return <GitBranch className={className} />
    case "invoices":
      return <ReceiptText className={className} />
    case "subscriptions":
      return <CreditCard className={className} />
    case "tickets":
      return <LifeBuoy className={className} />
    case "notifications":
      return <Bell className={className} />
    default:
      return <Command className={className} />
  }
}

export function HqGlobalSearchTrigger({ onClick }: { onClick: () => void }) {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  return (
    <button type="button" onClick={onClick} className="hq-gs-trigger" aria-label="Open global search">
      <Search className="h-3.5 w-3.5 text-slate-400" />
      <span className="hq-gs-trigger-label">Search platform…</span>
      <kbd className="hq-gs-kbd">{isMac ? "⌘" : "Ctrl"}K</kbd>
    </button>
  )
}

export function HqGlobalSearch({
  open,
  onClose,
  onNavigate,
  preferredHospitalId,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (target: HqGlobalSearchNavigate) => void | Promise<void>
  preferredHospitalId?: string | null
}) {
  const [queryText, setQueryText] = useState("")
  const [index, setIndex] = useState<IndexDoc[]>(cachedIndex || [])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setQueryText("")
    setActiveIdx(0)
    const t = window.setTimeout(() => inputRef.current?.focus(), 30)
    setLoading(true)
    void ensureIndex(preferredHospitalId)
      .then((docs) => setIndex(docs))
      .finally(() => setLoading(false))
    return () => window.clearTimeout(t)
  }, [open, preferredHospitalId])

  const go = useCallback(
    async (tab: HqGlobalSearchTab, hospitalId?: string) => {
      onClose()
      await onNavigate({ tab, hospitalId })
    },
    [onClose, onNavigate],
  )

  const commandHits: SearchHit[] = useMemo(
    () => [
      {
        id: "cmd:overview",
        category: "commands",
        title: "Command Center",
        subtitle: "Platform overview & health",
        keywords: "command center overview home dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("overview") }],
      },
      {
        id: "cmd:hospitals",
        category: "commands",
        title: "Tenant directory",
        subtitle: "Tenants · onboard · configure",
        keywords: "hospitals tenants customers",
        icon: <Building2 className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("hospitals") }],
      },
      {
        id: "cmd:subscriptions",
        category: "commands",
        title: "Subscription Center",
        subtitle: "Plans · renewals · revenue",
        keywords: "subscriptions plans renewals billing saas",
        icon: <CreditCard className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("subscriptions") }],
      },
      {
        id: "cmd:analytics",
        category: "commands",
        title: "Business Analytics",
        subtitle: "MRR · ARR · growth · usage",
        keywords: "analytics mrr arr churn renewal revenue saas business",
        icon: <Layers className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("analytics") }],
      },
      {
        id: "cmd:monitoring",
        category: "commands",
        title: "Platform Monitoring",
        subtitle: "Health · latency · probes",
        keywords: "monitoring health status uptime",
        icon: <Activity className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("monitoring") }],
      },
      {
        id: "cmd:activity",
        category: "commands",
        title: "Live Activity Center",
        subtitle: "Severity-sorted platform feed",
        keywords: "activity feed live events audit timeline",
        icon: <Bell className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("activity") }],
      },
      {
        id: "cmd:settings",
        category: "commands",
        title: "Global Settings",
        subtitle: "Platform · integrations · security",
        keywords: "settings configuration branding firebase api keys",
        icon: <Settings className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("account") }],
      },
      {
        id: "cmd:admins",
        category: "commands",
        title: "Tenant administrators",
        subtitle: "Provision & assign admins",
        keywords: "admins operators users",
        icon: <UserCog className="h-4 w-4" />,
        actions: [{ label: "Open", run: () => void go("admins") }],
      },
    ],
    [go],
  )

  const hits: SearchHit[] = useMemo(() => {
    const q = queryText.trim()
    const fromIndex: SearchHit[] = index.map((doc) => {
      const primary = (): void => {
        switch (doc.category) {
          case "hospitals":
            void go("hospitals", doc.hospitalId)
            break
          case "subscriptions":
            void go("subscriptions", doc.hospitalId)
            break
          case "admins":
            void go("admins", doc.hospitalId)
            break
          case "branches":
            void go("branches", doc.hospitalId)
            break
          case "doctors":
            void go("doctors", doc.hospitalId)
            break
          case "patients":
            void go("patients", doc.hospitalId)
            break
          case "appointments":
            void go("appointments", doc.hospitalId)
            break
          case "invoices":
            void go("billing", doc.hospitalId)
            break
          case "notifications":
            void go("monitoring")
            break
          default:
            void go("overview")
        }
      }

      const actions: SearchHit["actions"] = [{ label: "Open", run: primary }]
      if (doc.hospitalId && doc.category !== "hospitals") {
        actions.push({
          label: "Inspect tenant",
          run: () => void go("patients", doc.hospitalId),
        })
      }
      if (doc.category === "hospitals") {
        actions.push(
          { label: "Inspect", run: () => void go("patients", doc.hospitalId) },
          { label: "Subscription", run: () => void go("subscriptions", doc.hospitalId) },
        )
      }
      if (doc.category === "subscriptions") {
        actions.push({ label: "Upgrade", run: () => void go("subscriptions", doc.hospitalId) })
      }

      return {
        ...doc,
        icon: categoryIcon(doc.category),
        actions,
      }
    })

    const pool = [...commandHits, ...fromIndex]
    if (!q) {
      return [
        ...commandHits,
        ...fromIndex.filter((h) => h.category === "hospitals").slice(0, 6),
        ...fromIndex.filter((h) => h.category === "subscriptions").slice(0, 4),
      ]
    }

    return pool
      .map((hit) => ({
        hit,
        score: Math.max(
          scoreMatch(hit.title, q),
          scoreMatch(hit.subtitle, q) * 0.7,
          scoreMatch(hit.keywords, q) * 0.5,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 48)
      .map((x) => x.hit)
  }, [index, queryText, commandHits, go])

  const grouped = useMemo(() => {
    const map = new Map<CategoryId, SearchHit[]>()
    for (const hit of hits) {
      const list = map.get(hit.category) || []
      list.push(hit)
      map.set(hit.category, list)
    }
    return CATEGORY_ORDER.filter((c) => (map.get(c)?.length || 0) > 0).map((c) => ({
      category: c,
      items: map.get(c) || [],
    }))
  }, [hits])

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  useEffect(() => {
    setActiveIdx(0)
  }, [queryText, open])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-gs-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  const showTicketEmpty =
    normalize(queryText).includes("ticket") ||
    normalize(queryText).includes("support") ||
    normalize(queryText) === "tickets"

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const hit = flat[activeIdx]
      hit?.actions[0]?.run()
    }
  }

  if (!mounted || !open) return null

  let runningIdx = -1

  return createPortal(
    <div className="hq-gs-root" role="dialog" aria-modal="true" aria-label="Global search">
      <button type="button" className="hq-gs-backdrop" aria-label="Close search" onClick={onClose} />
      <div className="hq-gs-panel" onKeyDown={onKeyDown}>
        <div className="hq-gs-input-row">
          {loading ? (
            <Loader2 className="hq-gs-input-icon animate-spin" />
          ) : (
            <Search className="hq-gs-input-icon" />
          )}
          <input
            ref={inputRef}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search hospitals, doctors, patients, invoices…"
            className="hq-gs-input"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hq-gs-kbd hq-gs-kbd--esc">esc</kbd>
        </div>

        <div ref={listRef} className="hq-gs-results">
          {flat.length === 0 && !loading && !showTicketEmpty && (
            <div className="hq-gs-empty">
              <p className="hq-gs-empty-title">No matches</p>
              <p className="hq-gs-empty-desc">Try a hospital name, doctor, patient ID, or invoice.</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category} className="hq-gs-group">
              <div className="hq-gs-group-label">{CATEGORY_META[group.category].label}</div>
              <ul className="hq-gs-list">
                {group.items.map((hit) => {
                  runningIdx += 1
                  const idx = runningIdx
                  const active = idx === activeIdx
                  return (
                    <li key={hit.id}>
                      <button
                        type="button"
                        data-gs-idx={idx}
                        className={`hq-gs-item ${active ? "hq-gs-item--active" : ""}`}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => hit.actions[0]?.run()}
                      >
                        <span className="hq-gs-item-icon">{hit.icon}</span>
                        <span className="hq-gs-item-body">
                          <span className="hq-gs-item-title">{hit.title}</span>
                          <span className="hq-gs-item-sub">{hit.subtitle}</span>
                        </span>
                        <span className="hq-gs-item-actions">
                          {hit.actions.slice(0, 3).map((action) => (
                            <span
                              key={action.label}
                              role="button"
                              tabIndex={-1}
                              className="hq-gs-action"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                action.run()
                              }}
                            >
                              {action.label}
                            </span>
                          ))}
                          <CornerDownLeft className="h-3 w-3 text-slate-400" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {showTicketEmpty && (
            <div className="hq-gs-group">
              <div className="hq-gs-group-label">Support Tickets</div>
              <div className="hq-gs-empty hq-gs-empty--inline">
                <LifeBuoy className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="hq-gs-empty-title">Not instrumented</p>
                  <p className="hq-gs-empty-desc">{CATEGORY_META.tickets.emptyHint}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="hq-gs-footer">
          <span>
            <kbd className="hq-gs-kbd">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="hq-gs-kbd">↵</kbd> open
          </span>
          <span className="hq-gs-footer-hint">
            <ArrowRight className="inline h-3 w-3" /> Cross-tenant sample · active hospitals
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
