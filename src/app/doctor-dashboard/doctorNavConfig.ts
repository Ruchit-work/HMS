export type DoctorNavId =
  | "queue"
  | "home"
  | "inpatients"
  | "settings"
  | "book"
  | "documents"
  | "analytics"
  | "profile"
  | "about"

/** Routes grouped under Settings (secondary navigation). */
export const SETTINGS_NAV_IDS: DoctorNavId[] = [
  "settings",
  "profile",
  "about",
  "analytics",
  "documents",
  "book",
]

export const DOCTOR_NAV_LABELS: Record<DoctorNavId, string> = {
  queue: "Consultations",
  home: "Overview",
  inpatients: "Inpatients",
  settings: "Settings",
  book: "Book Visit",
  documents: "Documents",
  analytics: "Insights",
  profile: "Profile",
  about: "About",
}

export const DOCTOR_NAV_SUBTITLES: Record<DoctorNavId, string> = {
  queue: "Today's patient queue",
  home: "Start of day overview",
  inpatients: "Admitted patients",
  settings: "Account & practice tools",
  book: "Usually via reception",
  documents: "Cross-patient file search",
  analytics: "Practice insights",
  profile: "Your account",
  about: "Portal information",
}

export interface DoctorNavItem {
  id: DoctorNavId
  href: string
  label: string
  subtitle: string
  section: "clinical" | "settings"
  showBadge?: boolean
}

export interface SettingsHubItem {
  id: DoctorNavId
  href: string
  label: string
  description: string
  group: "account" | "practice" | "scheduling"
}

export function buildDoctorNavItems(): DoctorNavItem[] {
  return [
    {
      id: "queue",
      href: "/doctor-dashboard/appointments",
      label: DOCTOR_NAV_LABELS.queue,
      subtitle: DOCTOR_NAV_SUBTITLES.queue,
      section: "clinical",
      showBadge: true,
    },
    {
      id: "home",
      href: "/doctor-dashboard",
      label: DOCTOR_NAV_LABELS.home,
      subtitle: DOCTOR_NAV_SUBTITLES.home,
      section: "clinical",
    },
    {
      id: "inpatients",
      href: "/doctor-dashboard/inpatients",
      label: DOCTOR_NAV_LABELS.inpatients,
      subtitle: DOCTOR_NAV_SUBTITLES.inpatients,
      section: "clinical",
    },
    {
      id: "settings",
      href: "/doctor-dashboard/settings",
      label: DOCTOR_NAV_LABELS.settings,
      subtitle: DOCTOR_NAV_SUBTITLES.settings,
      section: "settings",
    },
  ]
}

export function getSettingsHubItems(): SettingsHubItem[] {
  return [
    {
      id: "profile",
      href: "/doctor-dashboard/profile",
      label: DOCTOR_NAV_LABELS.profile,
      description: "Name, specialization, availability, and account details.",
      group: "account",
    },
    {
      id: "about",
      href: "/doctor-dashboard/about",
      label: DOCTOR_NAV_LABELS.about,
      description: "Portal overview and feature reference.",
      group: "account",
    },
    {
      id: "analytics",
      href: "/doctor-dashboard/analytics",
      label: DOCTOR_NAV_LABELS.analytics,
      description: "Appointment trends and practice metrics — review outside clinic hours.",
      group: "practice",
    },
    {
      id: "documents",
      href: "/doctor-dashboard/documents",
      label: DOCTOR_NAV_LABELS.documents,
      description: "Search documents across patients. During consults, use patient workspace reports.",
      group: "practice",
    },
    {
      id: "book",
      href: "/doctor-dashboard/book-appointment",
      label: DOCTOR_NAV_LABELS.book,
      description: "Schedule a visit when reception is unavailable.",
      group: "scheduling",
    },
  ]
}

/** Primary sidebar: clinical work + single Settings entry. */
export function getDoctorNavSections() {
  const items = buildDoctorNavItems()
  return [
    {
      title: "Clinical",
      items: items.filter((i) => i.section === "clinical"),
    },
    {
      title: null as string | null,
      items: items.filter((i) => i.section === "settings"),
    },
  ]
}

export function isSettingsRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/doctor-dashboard/settings") ||
    pathname.startsWith("/doctor-dashboard/profile") ||
    pathname.startsWith("/doctor-dashboard/about") ||
    pathname.startsWith("/doctor-dashboard/analytics") ||
    pathname.startsWith("/doctor-dashboard/documents") ||
    pathname.startsWith("/doctor-dashboard/book-appointment")
  )
}

export function getActiveDoctorNavId(pathname: string): DoctorNavId {
  if (pathname.startsWith("/doctor-dashboard/appointments")) return "queue"
  if (pathname.startsWith("/doctor-dashboard/inpatients")) return "inpatients"
  if (pathname.startsWith("/doctor-dashboard/anatomy")) return "queue"
  if (isSettingsRoute(pathname)) return "settings"
  if (pathname === "/doctor-dashboard" || pathname === "/doctor-dashboard/") return "home"
  return "home"
}

/** Page title for top bar — includes settings child routes. */
export function getDoctorPageMeta(pathname: string): { label: string; subtitle: string } {
  if (pathname.startsWith("/doctor-dashboard/appointments")) {
    return { label: DOCTOR_NAV_LABELS.queue, subtitle: DOCTOR_NAV_SUBTITLES.queue }
  }
  if (pathname.startsWith("/doctor-dashboard/inpatients")) {
    return { label: DOCTOR_NAV_LABELS.inpatients, subtitle: DOCTOR_NAV_SUBTITLES.inpatients }
  }
  if (pathname.startsWith("/doctor-dashboard/settings")) {
    return { label: DOCTOR_NAV_LABELS.settings, subtitle: DOCTOR_NAV_SUBTITLES.settings }
  }
  if (pathname.startsWith("/doctor-dashboard/profile")) {
    return { label: DOCTOR_NAV_LABELS.profile, subtitle: "Settings · Account" }
  }
  if (pathname.startsWith("/doctor-dashboard/about")) {
    return { label: DOCTOR_NAV_LABELS.about, subtitle: "Settings · Account" }
  }
  if (pathname.startsWith("/doctor-dashboard/analytics")) {
    return { label: DOCTOR_NAV_LABELS.analytics, subtitle: "Settings · Practice tools" }
  }
  if (pathname.startsWith("/doctor-dashboard/documents")) {
    return { label: DOCTOR_NAV_LABELS.documents, subtitle: "Settings · Practice tools" }
  }
  if (pathname.startsWith("/doctor-dashboard/book-appointment")) {
    return { label: DOCTOR_NAV_LABELS.book, subtitle: "Settings · Scheduling" }
  }
  if (pathname.startsWith("/doctor-dashboard/anatomy")) {
    return { label: "Consultation", subtitle: "Clinical workspace" }
  }
  return { label: DOCTOR_NAV_LABELS.home, subtitle: DOCTOR_NAV_SUBTITLES.home }
}
