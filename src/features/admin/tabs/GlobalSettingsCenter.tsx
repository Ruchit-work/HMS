"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  Settings,
  Palette,
  Stamp,
  Mail,
  MessageSquare,
  Smartphone,
  CreditCard,
  Flame,
  HardDrive,
  Shield,
  KeyRound,
  ScrollText,
  DatabaseBackup,
  UserCog,
  Bell,
  ToggleLeft,
  Building2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react"
import { firebaseConfig } from "@/firebase/config"
import { ChangePasswordSection } from "@/features/forms/PasswordComponents"
import { Button } from '@/shared/components'
import {
  HqShell,
  HqPageHeader,
  HqPanel,
  HqWorkspace,
  HqSectionLabel,
  HqHealthBadge,
  type HqHealthLevel,
} from "@/features/admin/hq"

type SettingsSectionId =
  | "platform"
  | "branding"
  | "white_label"
  | "email"
  | "whatsapp"
  | "sms"
  | "payment"
  | "firebase"
  | "storage"
  | "security"
  | "api_keys"
  | "audit_logs"
  | "backups"
  | "roles"
  | "notifications"
  | "feature_flags"

type RowTone = "ok" | "warn" | "info" | "muted"

type SettingsRow = {
  label: string
  value: string
  hint?: string
  tone?: RowTone
}

const SECTIONS: Array<{
  id: SettingsSectionId
  label: string
  icon: typeof Settings
  blurb: string
}> = [
  { id: "platform", label: "Platform", icon: Settings, blurb: "Headquarters identity and operator profile" },
  { id: "branding", label: "Branding", icon: Palette, blurb: "Product name and visual identity" },
  { id: "white_label", label: "White Label", icon: Stamp, blurb: "Customer-facing rebrand controls" },
  { id: "email", label: "Email", icon: Mail, blurb: "Transactional email delivery" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, blurb: "Meta / provider messaging" },
  { id: "sms", label: "SMS", icon: Smartphone, blurb: "Bhash / SMS gateway" },
  { id: "payment", label: "Payment Gateway", icon: CreditCard, blurb: "Online payment rails" },
  { id: "firebase", label: "Firebase", icon: Flame, blurb: "Auth, Firestore, and project metadata" },
  { id: "storage", label: "Storage", icon: HardDrive, blurb: "Cloud file storage" },
  { id: "security", label: "Security", icon: Shield, blurb: "Credentials and access hygiene" },
  { id: "api_keys", label: "API Keys", icon: KeyRound, blurb: "Server secrets and integrations" },
  { id: "audit_logs", label: "Audit Logs", icon: ScrollText, blurb: "Operator and system audit trail" },
  { id: "backups", label: "Backups", icon: DatabaseBackup, blurb: "Disaster recovery posture" },
  { id: "roles", label: "Roles", icon: UserCog, blurb: "Platform and tenant operators" },
  { id: "notifications", label: "Notifications", icon: Bell, blurb: "Platform notification preferences" },
  { id: "feature_flags", label: "Feature Flags", icon: ToggleLeft, blurb: "Module entitlements across tenants" },
]

function toneToHealth(tone: RowTone): HqHealthLevel {
  if (tone === "ok") return "healthy"
  if (tone === "warn") return "warning"
  if (tone === "muted") return "offline"
  return "warning"
}

function SettingRows({ rows }: { rows: SettingsRow[] }) {
  return (
    <ul className="hq-set-rows">
      {rows.map((row) => (
        <li key={row.label} className="hq-set-row">
          <div className="hq-set-row-main">
            <p className="hq-set-row-label">{row.label}</p>
            {row.hint ? <p className="hq-set-row-hint">{row.hint}</p> : null}
          </div>
          <div className="hq-set-row-value">
            {row.tone === "ok" || row.tone === "warn" ? (
              <HqHealthBadge status={toneToHealth(row.tone)} />
            ) : null}
            <span className={`hq-set-value hq-set-value--${row.tone || "info"}`}>{row.value}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function SettingsBlock({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: SettingsSectionId
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  const Icon = SECTIONS.find((s) => s.id === id)?.icon || Settings
  return (
    <section id={`hq-set-${id}`} className="hq-set-section scroll-mt-24">
      <div className="hq-ds-panel">
        <div className="hq-ds-panel-header">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="hq-set-section-icon">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="hq-ds-panel-title">{title}</h3>
              <p className="hq-ds-panel-sub">{description}</p>
            </div>
          </div>
        </div>
        <div className="hq-ds-panel-body">
          {children}
          {footer ? <div className="hq-set-section-footer">{footer}</div> : null}
        </div>
      </div>
    </section>
  )
}

export default function GlobalSettingsCenter({
  userEmail,
  displayName,
  onNotify,
  onNavigate,
}: {
  userEmail: string
  displayName: string
  onNotify: (type: "success" | "error", message: string) => void
  onNavigate?: (tab: string) => void
}) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("platform")

  const projectId = firebaseConfig.projectId || "—"
  const authDomain = firebaseConfig.authDomain || "—"
  const storageBucket = firebaseConfig.storageBucket || "—"
  const looksDummy =
    projectId.includes("dummy") || authDomain.includes("dummy") || storageBucket.includes("dummy")

  const go = (tab: string) => {
    if (onNavigate) onNavigate(tab)
    else router.push(`/admin-dashboard?tab=${tab}`)
  }

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(`hq-set-${s.id}`)).filter(
      Boolean,
    ) as HTMLElement[]
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (!top?.target?.id) return
        const id = top.target.id.replace("hq-set-", "") as SettingsSectionId
        if (SECTIONS.some((s) => s.id === id)) setActiveSection(id)
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] },
    )
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: SettingsSectionId) => {
    setActiveSection(id)
    document.getElementById(`hq-set-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const nav = useMemo(() => SECTIONS, [])

  return (
    <HqShell>
      <HqPageHeader
        variant="hero"
        eyebrow="Platform control · Global Settings"
        title="Platform configuration"
        description="Organized control surface for platform identity, integrations, security, and governance. Editable controls keep existing behavior — everything else is read-only status."
      />

      <HqSectionLabel>Settings catalog</HqSectionLabel>

      <HqWorkspace
        primary={
          <div className="hq-set-stack space-y-3">
            <SettingsBlock id="platform" title="Platform" description="Headquarters identity and operator profile">
              <SettingRows
                rows={[
                  { label: "Operator name", value: displayName || "—", tone: "ok" },
                  { label: "Sign-in email", value: userEmail, tone: "ok" },
                  { label: "Role", value: "Platform Super Admin", tone: "ok" },
                  {
                    label: "Console",
                    value: "Harmony HMS Headquarters",
                    hint: "SaaS control plane — not a hospital admin console",
                    tone: "info",
                  },
                ]}
              />
            </SettingsBlock>

            <SettingsBlock
              id="branding"
              title="Branding"
              description="Product name and visual identity"
            >
              <SettingRows
                rows={[
                  { label: "Product name", value: "Harmony HMS", tone: "ok" },
                  {
                    label: "Brand editor",
                    value: "Not available in-app",
                    hint: "Logo and theme are shipped with the product build",
                    tone: "muted",
                  },
                  {
                    label: "Accent system",
                    value: "HQ cyan–teal design tokens",
                    tone: "info",
                  },
                ]}
              />
            </SettingsBlock>

            <SettingsBlock
              id="white_label"
              title="White Label"
              description="Customer-facing rebrand controls"
            >
              <SettingRows
                rows={[
                  {
                    label: "White-label mode",
                    value: "Not instrumented",
                    hint: "Per-tenant rebranding is not exposed in this console",
                    tone: "warn",
                  },
                  {
                    label: "Custom domains",
                    value: "Configure offline",
                    tone: "muted",
                  },
                ]}
              />
            </SettingsBlock>

            <SettingsBlock id="email" title="Email" description="Transactional email delivery">
              <SettingRows
                rows={[
                  {
                    label: "Delivery health",
                    value: "Not instrumented",
                    hint: "No Harmony email health endpoint yet",
                    tone: "warn",
                  },
                  {
                    label: "Provider credentials",
                    value: "Configure via environment",
                    tone: "muted",
                  },
                ]}
              />
              <Callout icon={<Info className="h-3.5 w-3.5" />} text="Open Platform Monitoring for live vs uninstrumented messaging probes." />
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("monitoring")}>
                  Open Monitoring
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock id="whatsapp" title="WhatsApp" description="Meta / provider messaging">
              <SettingRows
                rows={[
                  {
                    label: "Provider",
                    value: "META_WHATSAPP_* / WHATSAPP_PROVIDER",
                    hint: "Server environment variables",
                    tone: "info",
                  },
                  {
                    label: "Health probe",
                    value: "Not instrumented",
                    tone: "warn",
                  },
                  {
                    label: "Credentials in UI",
                    value: "Never editable here",
                    tone: "muted",
                  },
                ]}
              />
            </SettingsBlock>

            <SettingsBlock id="sms" title="SMS" description="Bhash / SMS gateway">
              <SettingRows
                rows={[
                  {
                    label: "Provider",
                    value: "BHASHSMS_* env",
                    tone: "info",
                  },
                  {
                    label: "Health probe",
                    value: "Not instrumented",
                    tone: "warn",
                  },
                  {
                    label: "Failure logs",
                    value: "Visible in Activity Center when present",
                    tone: "info",
                  },
                ]}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("activity")}>
                  Open Activity
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock
              id="payment"
              title="Payment Gateway"
              description="Online payment rails"
            >
              <SettingRows
                rows={[
                  {
                    label: "Gateway health",
                    value: "Not instrumented",
                    hint: "Front-desk collection remains the primary payment path",
                    tone: "warn",
                  },
                  {
                    label: "Billing records",
                    value: "Managed per tenant",
                    tone: "info",
                  },
                ]}
              />
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("billing")}>
                  Inspect billing
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock id="firebase" title="Firebase" description="Auth, Firestore, and project metadata">
              <SettingRows
                rows={[
                  {
                    label: "Project ID",
                    value: projectId,
                    tone: looksDummy ? "warn" : "ok",
                    hint: looksDummy ? "Public config looks like a placeholder" : "From NEXT_PUBLIC_FIREBASE_PROJECT_ID",
                  },
                  { label: "Auth domain", value: authDomain, tone: looksDummy ? "warn" : "ok" },
                  {
                    label: "Admin SDK secrets",
                    value: "Configure via environment",
                    hint: "FIREBASE_CLIENT_EMAIL / PRIVATE_KEY — never shown in UI",
                    tone: "muted",
                  },
                  {
                    label: "Live probe",
                    value: "Available in Monitoring",
                    tone: "ok",
                  },
                ]}
              />
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("monitoring")}>
                  Probe Firebase
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock id="storage" title="Storage" description="Cloud file storage">
              <SettingRows
                rows={[
                  { label: "Bucket", value: storageBucket, tone: looksDummy ? "warn" : "info" },
                  {
                    label: "Usage metering",
                    value: "Not instrumented",
                    tone: "warn",
                  },
                  {
                    label: "Credentials",
                    value: "Configure via environment",
                    tone: "muted",
                  },
                ]}
              />
            </SettingsBlock>

            <SettingsBlock id="security" title="Security" description="Credentials and access hygiene">
              <SettingRows
                rows={[
                  {
                    label: "Password change",
                    value: "Available below",
                    hint: "Existing Firebase re-auth flow — unchanged",
                    tone: "ok",
                  },
                  {
                    label: "Session policy",
                    value: "Managed by Firebase Auth",
                    tone: "info",
                  },
                  {
                    label: "MFA / SSO console",
                    value: "Not instrumented in-app",
                    tone: "muted",
                  },
                ]}
              />
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">Change password</p>
                <ChangePasswordSection userEmail={userEmail} accent="teal" notify={onNotify} />
              </div>
            </SettingsBlock>

            <SettingsBlock id="api_keys" title="API Keys" description="Server secrets and integrations">
              <SettingRows
                rows={[
                  {
                    label: "WhatsApp / SMS / cron / AI keys",
                    value: "Environment only",
                    hint: "Secrets are never editable or revealed in this console",
                    tone: "muted",
                  },
                  {
                    label: "Client Firebase API key",
                    value: "Public web config",
                    hint: "Restricted by Firebase security rules — not a secret vault",
                    tone: "info",
                  },
                  {
                    label: "In-app key vault",
                    value: "Not available",
                    tone: "warn",
                  },
                ]}
              />
              <Callout
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                text="Do not paste production secrets into the browser. Rotate keys in your host environment."
              />
            </SettingsBlock>

            <SettingsBlock id="audit_logs" title="Audit Logs" description="Operator and system audit trail">
              <SettingRows
                rows={[
                  {
                    label: "Platform audit browser",
                    value: "Not instrumented",
                    hint: "Pharmacy-scoped audit logs exist separately inside tenants",
                    tone: "warn",
                  },
                  {
                    label: "Activity feed",
                    value: "Derived platform events",
                    tone: "info",
                  },
                ]}
              />
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("activity")}>
                  Open Live Activity
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock id="backups" title="Backups" description="Disaster recovery posture">
              <SettingRows
                rows={[
                  {
                    label: "Managed backups",
                    value: "Firebase / cloud provider",
                    hint: "No in-app DR console — ops jobs may appear in Activity",
                    tone: "info",
                  },
                  {
                    label: "Restore wizard",
                    value: "Not available in-app",
                    tone: "muted",
                  },
                ]}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("activity")}>
                  View ops activity
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => go("monitoring")}>
                  Open Monitoring
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock id="roles" title="Roles" description="Platform and tenant operators">
              <SettingRows
                rows={[
                  {
                    label: "Platform Super Admin",
                    value: "This account",
                    tone: "ok",
                  },
                  {
                    label: "Tenant administrators",
                    value: "Managed in Tenant Admins",
                    tone: "info",
                  },
                  {
                    label: "Hospital staff roles",
                    value: "Managed per tenant (Staff)",
                    tone: "info",
                  },
                ]}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("admins")}>
                  <UserCog className="h-3.5 w-3.5" />
                  Tenant Admins
                </Button>
              </div>
            </SettingsBlock>

            <SettingsBlock
              id="notifications"
              title="Notifications"
              description="Platform notification preferences"
            >
              <SettingRows
                rows={[
                  {
                    label: "HQ notification preferences",
                    value: "Not instrumented",
                    hint: "Patient/appointment messaging runs via WhatsApp & SMS providers",
                    tone: "warn",
                  },
                  {
                    label: "In-app toasts",
                    value: "Session feedback only",
                    tone: "info",
                  },
                ]}
              />
            </SettingsBlock>

            <SettingsBlock
              id="feature_flags"
              title="Feature Flags"
              description="Module entitlements across tenants"
            >
              <SettingRows
                rows={[
                  {
                    label: "Branches",
                    value: "multipleBranchesEnabled",
                    hint: "Per-tenant entitlement",
                    tone: "ok",
                  },
                  {
                    label: "Analytics",
                    value: "enableAnalytics",
                    tone: "ok",
                  },
                  {
                    label: "Pharmacy",
                    value: "enablePharmacy",
                    tone: "ok",
                  },
                  {
                    label: "Global flag service",
                    value: "Not available",
                    hint: "Flags are managed on each hospital tenant / subscription",
                    tone: "muted",
                  },
                ]}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => go("hospitals")}>
                  <Building2 className="h-3.5 w-3.5" />
                  Tenants
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => go("subscriptions")}>
                  Subscriptions
                </Button>
              </div>
            </SettingsBlock>
          </div>
        }
        rail={
          <HqPanel title="Sections" subtitle="Jump to a settings group" padded>
            <nav className="hq-set-nav" aria-label="Settings sections">
              {nav.map((s) => {
                const Icon = s.icon
                const active = activeSection === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`hq-set-nav-item ${active ? "hq-set-nav-item--active" : ""}`}
                    onClick={() => scrollTo(s.id)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                )
              })}
            </nav>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>Password change keeps the existing Firebase flow. Integration secrets stay in environment config.</span>
            </div>
          </HqPanel>
        }
      />
    </HqShell>
  )
}

function Callout({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-cyan-100 bg-cyan-50/50 px-2.5 py-2 text-[11px] text-slate-600">
      <span className="mt-0.5 text-cyan-700">{icon}</span>
      <span>{text}</span>
    </div>
  )
}
