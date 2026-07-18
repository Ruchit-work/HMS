"use client"

import type { ReactNode } from "react"

export type TabSkeletonVariant =
  | "dashboard"
  | "table"
  | "billing"
  | "form"
  | "ipd"
  | "documents"
  | "generic"

interface TabSkeletonProps {
  variant?: TabSkeletonVariant
  className?: string
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`rx-skeleton ${className}`} />
}

function KpiRow({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-3 ${count === 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <Bone className="h-9 w-9 rounded-lg" />
            <Bone className="h-5 w-16 rounded-full" />
          </div>
          <Bone className="mt-3 h-7 w-24" />
          <Bone className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

function TableBlock({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="space-y-2">
          <Bone className="h-4 w-36" />
          <Bone className="h-3 w-52" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-8 w-40 rounded-lg" />
          <Bone className="h-8 w-28 rounded-lg" />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-3.5 w-40" />
              <Bone className="h-3 w-28" />
            </div>
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <Bone className="h-7 w-56" />
        <Bone className="mt-2 h-4 w-72" />
      </div>
      <KpiRow />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <Bone className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <Bone className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Bone className="h-3 w-36" />
                <Bone className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <Bone className="h-4 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bone className="h-8 w-8 rounded-full" />
                <Bone className="h-3 w-32" />
              </div>
              <Bone className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BillingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <Bone className="h-5 w-40" />
          <Bone className="mt-2 h-3 w-56" />
        </div>
        <KpiRow />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-8 w-28 rounded-lg" />
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <Bone className="h-5 w-20 rounded-md" />
                <Bone className="h-5 w-24 rounded-full" />
                <Bone className="h-5 w-16 rounded-full" />
              </div>
              <Bone className="h-5 w-48" />
              <Bone className="h-4 w-64" />
            </div>
            <Bone className="h-24 w-44 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-10 flex-1 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-1">
          <Bone className="h-4 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 lg:col-span-2">
          <Bone className="h-4 w-32" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bone key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <Bone className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function IpdSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <Bone className="h-8 w-48" />
      <KpiRow count={4} />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <TableBlock rows={5} />
    </div>
  )
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-32" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <Bone className="h-10 w-10 rounded-lg" />
            <Bone className="mt-3 h-4 w-3/4" />
            <Bone className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

function GenericSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Bone className="h-5 w-40" />
        <Bone className="mt-3 h-4 w-full max-w-lg" />
      </div>
      <TableBlock rows={4} />
    </div>
  )
}

const VARIANT_MAP: Record<TabSkeletonVariant, () => ReactNode> = {
  dashboard: DashboardSkeleton,
  table: () => <TableBlock />,
  billing: BillingSkeleton,
  form: FormSkeleton,
  ipd: IpdSkeleton,
  documents: DocumentsSkeleton,
  generic: GenericSkeleton,
}

export default function TabSkeleton({ variant = "generic", className = "" }: TabSkeletonProps) {
  const Content = VARIANT_MAP[variant]
  return (
    <div className={`rx-tab-skeleton ${className}`} aria-hidden="true">
      <Content />
    </div>
  )
}

export function tabSkeletonForTab(tab: string): TabSkeletonVariant {
  const map: Record<string, TabSkeletonVariant> = {
    dashboard: "dashboard",
    patients: "table",
    doctors: "table",
    appointments: "table",
    "admit-requests": "ipd",
    billing: "billing",
    "book-appointment": "form",
    "whatsapp-bookings": "table",
    documents: "documents",
  }
  return map[tab] ?? "generic"
}
