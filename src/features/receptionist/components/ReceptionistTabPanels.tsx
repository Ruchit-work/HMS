"use client"

import { Suspense, useEffect, useRef, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { TabSkeleton, tabSkeletonForTab } from '@/shared/components'

export type ReceptionistTab =
  | "dashboard"
  | "patients"
  | "doctors"
  | "appointments"
  | "book-appointment"
  | "admit-requests"
  | "billing"
  | "whatsapp-bookings"
  | "documents"

interface ReceptionistTabPanelsProps {
  activeTab: ReceptionistTab
  visitedTabs: Set<ReceptionistTab>
  isShellReady: boolean
  receptionistBranchId: string | null
  userName: string
  patientSubTab: "all" | "analytics"
  onPatientSubTabChange: (tab: "all" | "analytics") => void
  patientMode: "existing" | "new"
  onPatientModeChange: (mode: "existing" | "new") => void
  billingFocusQuery: string | null
  onBillingFocusHandled: () => void
  onNotification: (payload: { type: "success" | "error"; message: string } | null) => void
  onTabChange: (tab: ReceptionistTab) => void
  onOpenBilling: (admissionId: string) => void
  onWhatsappPendingCountChange: (count: number) => void
}

// Prefetch helpers — called on sidebar hover
export const prefetchReceptionistTab = (tab: ReceptionistTab) => {
  switch (tab) {
    case "dashboard":
      void import("@/features/receptionist/tabs/DashboardOverview")
      break
    case "patients":
      void import("@/features/admin/tabs/PatientManagement")
      void import("@/features/admin/tabs/PatientAnalytics")
      break
    case "doctors":
      void import("@/features/admin/tabs/DoctorManagement")
      break
    case "appointments":
      void import("@/features/admin/tabs/AppoinmentManagement")
      break
    case "admit-requests":
      void import("@/features/receptionist/tabs/AdmitRequestsPanel")
      break
    case "billing":
      void import("@/features/receptionist/tabs/BillingHistoryPanel")
      break
    case "book-appointment":
      void import("@/features/receptionist/tabs/BookAppointmentPanel")
      break
    case "whatsapp-bookings":
      void import("@/features/receptionist/tabs/WhatsAppBookingsPanel")
      break
    case "documents":
      void import("@/features/documents/DocumentsTab")
      break
  }
}

const DashboardOverview = dynamic(
  () => import("@/features/receptionist/tabs/DashboardOverview"),
  { loading: () => <TabSkeleton variant="dashboard" /> }
)
const PatientManagement = dynamic(
  () => import("@/features/admin/tabs/PatientManagement"),
  { loading: () => <TabSkeleton variant="table" /> }
)
const PatientAnalytics = dynamic(
  () => import("@/features/admin/tabs/PatientAnalytics"),
  { loading: () => <TabSkeleton variant="table" /> }
)
const DoctorManagement = dynamic(
  () => import("@/features/admin/tabs/DoctorManagement"),
  { loading: () => <TabSkeleton variant="table" /> }
)
const AppoinmentManagement = dynamic(
  () => import("@/features/admin/tabs/AppoinmentManagement"),
  { loading: () => <TabSkeleton variant="table" /> }
)
const AdmitRequestsPanel = dynamic(
  () => import("@/features/receptionist/tabs/AdmitRequestsPanel"),
  { loading: () => <TabSkeleton variant="ipd" /> }
)
const BillingHistoryPanel = dynamic(
  () => import("@/features/receptionist/tabs/BillingHistoryPanel"),
  { loading: () => <TabSkeleton variant="billing" /> }
)
const BookAppointmentPanel = dynamic(
  () => import("@/features/receptionist/tabs/BookAppointmentPanel"),
  { loading: () => <TabSkeleton variant="form" /> }
)
const WhatsAppBookingsPanel = dynamic(
  () => import("@/features/receptionist/tabs/WhatsAppBookingsPanel"),
  { loading: () => <TabSkeleton variant="table" /> }
)
const DocumentsTab = dynamic(
  () => import("@/features/documents/DocumentsTab"),
  { loading: () => <TabSkeleton variant="documents" /> }
)

function TabPanel({
  tab,
  activeTab,
  children,
}: {
  tab: ReceptionistTab
  activeTab: ReceptionistTab
  children: ReactNode
}) {
  const isActive = tab === activeTab
  return (
    <div
      role="tabpanel"
      aria-hidden={!isActive}
      className={`rx-tab-panel ${isActive ? "rx-tab-panel--active" : ""}`}
    >
      {children}
    </div>
  )
}

function PanelSuspense({ tab, children }: { tab: ReceptionistTab; children: ReactNode }) {
  return (
    <Suspense fallback={<TabSkeleton variant={tabSkeletonForTab(tab)} />}>
      {children}
    </Suspense>
  )
}

export default function ReceptionistTabPanels({
  activeTab,
  visitedTabs,
  isShellReady,
  receptionistBranchId,
  userName,
  patientSubTab,
  onPatientSubTabChange,
  patientMode,
  onPatientModeChange,
  billingFocusQuery,
  onBillingFocusHandled,
  onNotification,
  onTabChange,
  onOpenBilling,
  onWhatsappPendingCountChange,
}: ReceptionistTabPanelsProps) {
  const scrollPositionsRef = useRef<Partial<Record<ReceptionistTab, number>>>({})
  const prevTabRef = useRef<ReceptionistTab>(activeTab)
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const main = mainRef.current?.closest("main")
    if (!main) return

    if (prevTabRef.current !== activeTab) {
      scrollPositionsRef.current[prevTabRef.current] = main.scrollTop
      prevTabRef.current = activeTab
    }

    const saved = scrollPositionsRef.current[activeTab] ?? 0
    requestAnimationFrame(() => {
      main.scrollTop = saved
    })
  }, [activeTab])

  if (!isShellReady) {
    return (
      <div ref={mainRef} className="rx-tab-panels">
        <TabSkeleton variant={tabSkeletonForTab(activeTab)} />
      </div>
    )
  }

  return (
    <div ref={mainRef} className="rx-tab-panels">
      {visitedTabs.has("dashboard") && (
        <TabPanel tab="dashboard" activeTab={activeTab}>
          <PanelSuspense tab="dashboard">
            <DashboardOverview
              onTabChange={onTabChange}
              receptionistBranchId={receptionistBranchId}
              userName={userName}
            />
          </PanelSuspense>
        </TabPanel>
      )}

      {visitedTabs.has("patients") && (
        <TabPanel tab="patients" activeTab={activeTab}>
          <div className="rx-section-card">
            <div className="rx-subtab-bar">
              <button
                onClick={() => onPatientSubTabChange("all")}
                className={`rx-subtab ${patientSubTab === "all" ? "rx-subtab--active" : ""}`}
              >
                All Patients
              </button>
              <button
                onClick={() => onPatientSubTabChange("analytics")}
                className={`rx-subtab ${patientSubTab === "analytics" ? "rx-subtab--active" : ""}`}
              >
                Analytics
              </button>
            </div>
            <div className="p-6">
              <PanelSuspense tab="patients">
                {patientSubTab === "all" ? (
                  <PatientManagement
                    canDelete={true}
                    canAdd={true}
                    disableAdminGuard={true}
                    receptionistBranchId={receptionistBranchId}
                  />
                ) : (
                  <PatientAnalytics />
                )}
              </PanelSuspense>
            </div>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("doctors") && (
        <TabPanel tab="doctors" activeTab={activeTab}>
          <div className="rx-section-card p-6">
            <PanelSuspense tab="doctors">
              <DoctorManagement canDelete={false} canAdd={false} disableAdminGuard={true} />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("appointments") && (
        <TabPanel tab="appointments" activeTab={activeTab}>
          <div className="rx-section-card p-6">
            <PanelSuspense tab="appointments">
              <AppoinmentManagement
                disableAdminGuard={true}
                receptionistBranchId={receptionistBranchId}
              />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("admit-requests") && (
        <TabPanel tab="admit-requests" activeTab={activeTab}>
          <div className="rx-section-card">
            <PanelSuspense tab="admit-requests">
              <AdmitRequestsPanel
                onNotification={onNotification}
                onOpenBilling={onOpenBilling}
              />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("billing") && (
        <TabPanel tab="billing" activeTab={activeTab}>
          <div className="rx-section-card p-6">
            <PanelSuspense tab="billing">
              <BillingHistoryPanel
                onNotification={onNotification}
                focusBillingQuery={billingFocusQuery}
                onFocusHandled={onBillingFocusHandled}
              />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("book-appointment") && (
        <TabPanel tab="book-appointment" activeTab={activeTab}>
          <div className="rx-section-card p-6">
            <PanelSuspense tab="book-appointment">
              <BookAppointmentPanel
                patientMode={patientMode}
                onPatientModeChange={onPatientModeChange}
                onNotification={onNotification}
                isActive={activeTab === "book-appointment"}
              />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("whatsapp-bookings") && (
        <TabPanel tab="whatsapp-bookings" activeTab={activeTab}>
          <div className="rx-section-card p-6">
            <PanelSuspense tab="whatsapp-bookings">
              <WhatsAppBookingsPanel
                receptionistBranchId={receptionistBranchId}
                onNotification={onNotification}
                onPendingCountChange={onWhatsappPendingCountChange}
                isActive={activeTab === "whatsapp-bookings"}
              />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}

      {visitedTabs.has("documents") && (
        <TabPanel tab="documents" activeTab={activeTab}>
          <div className="rx-section-card p-6">
            <PanelSuspense tab="documents">
              <DocumentsTab
                canUpload={true}
                canEdit={true}
                canDelete={true}
                showPatientSelector={true}
              />
            </PanelSuspense>
          </div>
        </TabPanel>
      )}
    </div>
  )
}
