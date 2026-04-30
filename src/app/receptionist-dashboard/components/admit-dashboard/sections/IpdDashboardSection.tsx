"use client"

import StatsCard from "@/app/receptionist-dashboard/components/admit-dashboard/StatsCard"
import SectionCard from "@/app/receptionist-dashboard/components/admit-dashboard/SectionCard"
import RoomAvailability, { RoomAvailabilityRow } from "@/app/receptionist-dashboard/components/admit-dashboard/RoomAvailability"
import OverviewCard, { OverviewMetric } from "@/app/receptionist-dashboard/components/admit-dashboard/OverviewCard"

type DashboardStat = {
  title: string
  value: number
  subtitle: string
  icon: any
  accentClass: string
}

type KpiSummary = {
  doctorRequestedDischarge: number
  expectedDischargeSoon: number
  roundsPending: number
}

type FinanceSummary = {
  totalDeposited: number
  totalAdjusted: number
  depositBalance: number
  payLaterCases: number
  packageCases: number
}

type ExpectedDischargeRow = {
  id: string
  patientName: string
  roomNumber: string
  doctorName: string
  expectedAt: string
  overdue: boolean
}

type RoundPendingRow = {
  id: string
  patientName: string
  doctorName: string
  latestRoundAt: string
}

interface IpdDashboardSectionProps {
  todayOverviewMetrics: OverviewMetric[]
  roomOccupancyRate: number
  occupiedRoomsCount: number
  totalRooms: number
  roomRows: RoomAvailabilityRow[]
  onManageRooms: () => void
  dashboardStats: DashboardStat[]
  ipdKpiSummary: KpiSummary
  ipdFinanceSummary: FinanceSummary
  openAdmissionsDeskWithFocus: (focus: "doctor_requested_discharge" | "expected_discharge_soon" | "rounds_pending" | "pay_later") => void
  expectedDischargeRows: ExpectedDischargeRow[]
  roundPendingRows: RoundPendingRow[]
}

export default function IpdDashboardSection({
  todayOverviewMetrics,
  roomOccupancyRate,
  occupiedRoomsCount,
  totalRooms,
  roomRows,
  onManageRooms,
  dashboardStats,
  ipdKpiSummary,
  ipdFinanceSummary,
  openAdmissionsDeskWithFocus,
  expectedDischargeRows,
  roundPendingRows,
}: IpdDashboardSectionProps) {
  return (
    <>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionCard title="Today's Overview" subtitle="Quick summary">
            <OverviewCard
              metrics={todayOverviewMetrics}
              occupancyPercent={roomOccupancyRate}
              occupiedBeds={occupiedRoomsCount}
              totalBeds={totalRooms}
            />
          </SectionCard>
        </div>
        <div>
          <SectionCard title="Room Availability" subtitle="Real-time room status">
            <RoomAvailability rows={roomRows} onManageRooms={onManageRooms} />
          </SectionCard>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            subtitle={stat.subtitle}
            icon={stat.icon}
            accentClass={stat.accentClass}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor Requested Discharge</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{ipdKpiSummary.doctorRequestedDischarge}</p>
          <p className="mt-1 text-xs text-slate-500">Needs receptionist discharge processing</p>
          <button
            onClick={() => openAdmissionsDeskWithFocus("doctor_requested_discharge")}
            className="mt-2 inline-flex rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800"
          >
            View in Admissions Desk
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected Discharge (24h)</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{ipdKpiSummary.expectedDischargeSoon}</p>
          <p className="mt-1 text-xs text-slate-500">Plan billing and room turnover</p>
          <button
            onClick={() => openAdmissionsDeskWithFocus("expected_discharge_soon")}
            className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          >
            View in Admissions Desk
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor Rounds Pending</p>
          <p className="mt-2 text-2xl font-bold text-violet-700">{ipdKpiSummary.roundsPending}</p>
          <p className="mt-1 text-xs text-slate-500">No round in last 24 hours</p>
          <button
            onClick={() => openAdmissionsDeskWithFocus("rounds_pending")}
            className="mt-2 inline-flex rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:text-violet-800"
          >
            View in Admissions Desk
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay Later Cases</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">{ipdFinanceSummary.payLaterCases}</p>
          <p className="mt-1 text-xs text-slate-500">Settlement expected at discharge</p>
          <button
            onClick={() => openAdmissionsDeskWithFocus("pay_later")}
            className="mt-2 inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800"
          >
            View in Admissions Desk
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Expected Discharge List</h3>
            <p className="text-xs text-slate-500">Patients with planned discharge dates</p>
          </div>
          <div className="divide-y divide-slate-100">
            {expectedDischargeRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No expected discharge dates captured yet.</p>
            ) : (
              expectedDischargeRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {row.roomNumber} · Dr. {row.doctorName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600">{new Date(row.expectedAt).toLocaleString()}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.overdue ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {row.overdue ? "Overdue" : "Scheduled"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Doctor Round Follow-up</h3>
            <p className="text-xs text-slate-500">Inpatients needing fresh doctor updates</p>
          </div>
          <div className="divide-y divide-slate-100">
            {roundPendingRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">All admitted patients have recent rounds.</p>
            ) : (
              roundPendingRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.patientName}</p>
                    <p className="text-xs text-slate-500">Dr. {row.doctorName}</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    {row.latestRoundAt ? `Last: ${new Date(row.latestRoundAt).toLocaleString()}` : "No rounds yet"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">IPD Financial Mini Summary</h3>
            <p className="text-xs text-slate-500">Deposit and package snapshot for active admissions</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Deposited</p>
            <p className="text-lg font-bold text-slate-900">₹{ipdFinanceSummary.totalDeposited.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Adjusted</p>
            <p className="text-lg font-bold text-slate-900">₹{ipdFinanceSummary.totalAdjusted.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Deposit Balance</p>
            <p className="text-lg font-bold text-slate-900">₹{ipdFinanceSummary.depositBalance.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Pay Later Cases</p>
            <p className="text-lg font-bold text-slate-900">{ipdFinanceSummary.payLaterCases}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Package Admissions</p>
            <p className="text-lg font-bold text-slate-900">{ipdFinanceSummary.packageCases}</p>
          </div>
        </div>
      </section>
    </>
  )
}
