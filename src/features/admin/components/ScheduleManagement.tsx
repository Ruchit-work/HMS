"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Clock,
  Building2,
  GitBranch,
  ShieldAlert,
  CheckCircle2,
  Info,
  Save,
  RotateCcw,
  Coffee,
} from "lucide-react"
import { Button } from "@/shared/components"
import { useAuth } from "@/shared/hooks/useAuth"
import type { BranchTimings, DayTiming } from "@/types/branch"

import { auth } from "@/firebase/config"
import { authedFetchJson } from "@/shared/utils/authedFetch"

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const

type WeekdayKey = (typeof WEEKDAYS)[number]["key"]

interface BranchOption {
  id: string
  name: string
  location: string
  timings: BranchTimings | null
  effectiveSource: string
  isInheriting: boolean
}

const DEFAULT_TIMING: DayTiming = {
  isOpen: true,
  start: "09:00",
  end: "17:00",
  breakStart: "13:00",
  breakEnd: "14:00",
}

function initEmptyTimings(): BranchTimings {
  return {
    monday: { ...DEFAULT_TIMING },
    tuesday: { ...DEFAULT_TIMING },
    wednesday: { ...DEFAULT_TIMING },
    thursday: { ...DEFAULT_TIMING },
    friday: { ...DEFAULT_TIMING },
    saturday: { isOpen: false, start: "09:00", end: "13:00", breakStart: null, breakEnd: null },
    sunday: { isOpen: false, start: "09:00", end: "13:00", breakStart: null, breakEnd: null },
    useHospitalSchedule: false,
  }
}

export default function ScheduleManagement({
  onNotify,
}: {
  onNotify?: (type: "success" | "error", message: string) => void
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hospitalSchedule, setHospitalSchedule] = useState<BranchTimings>(initEmptyTimings())
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedTarget, setSelectedTarget] = useState<"hospital" | string>("hospital")
  const [activeTimings, setActiveTimings] = useState<BranchTimings>(initEmptyTimings())
  const [useHospitalSchedule, setUseHospitalSchedule] = useState(false)

  const loadScheduleData = useCallback(async () => {
    setLoading(true)
    try {
      if (!auth.currentUser) {
        setLoading(false)
        return
      }

      const data = await authedFetchJson<{
        hospitalSchedule?: BranchTimings
        branches?: BranchOption[]
      }>("/api/admin/working-hours")

      const loadedHospitalSchedule = data.hospitalSchedule || initEmptyTimings()
      setHospitalSchedule(loadedHospitalSchedule)
      setBranches(data.branches || [])

      if (selectedTarget === "hospital") {
        setActiveTimings(loadedHospitalSchedule)
        setUseHospitalSchedule(false)
      } else {
        const found = (data.branches || []).find((b: BranchOption) => b.id === selectedTarget)
        if (found && found.timings) {
          setActiveTimings(found.timings)
          setUseHospitalSchedule(found.timings.useHospitalSchedule === true)
        } else {
          setActiveTimings({ ...loadedHospitalSchedule, useHospitalSchedule: true })
          setUseHospitalSchedule(true)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load schedules"
      onNotify?.("error", msg)
    } finally {
      setLoading(false)
    }
  }, [selectedTarget, onNotify])

  useEffect(() => {
    if (auth.currentUser) {
      void loadScheduleData()
    }
    const unsubscribe = auth.onAuthStateChanged((currUser) => {
      if (currUser) {
        void loadScheduleData()
      }
    })
    return () => unsubscribe()
  }, [loadScheduleData])

  const handleTargetChange = (target: "hospital" | string) => {
    setSelectedTarget(target)
    if (target === "hospital") {
      setActiveTimings(hospitalSchedule)
      setUseHospitalSchedule(false)
    } else {
      const found = branches.find((b) => b.id === target)
      if (found && found.timings) {
        setActiveTimings(found.timings)
        setUseHospitalSchedule(found.timings.useHospitalSchedule === true)
      } else {
        setActiveTimings({ ...hospitalSchedule, useHospitalSchedule: true })
        setUseHospitalSchedule(true)
      }
    }
  }

  const updateDayField = (
    day: WeekdayKey,
    field: keyof DayTiming,
    value: string | boolean | null
  ) => {
    setActiveTimings((prev) => {
      const currentDay = prev[day] || { ...DEFAULT_TIMING, isOpen: true }
      return {
        ...prev,
        [day]: {
          ...currentDay,
          [field]: value,
        },
      }
    })
  }

  const handleSave = async () => {
    if (!isAdmin) return
    setSaving(true)
    try {
      const payload = {
        targetType: selectedTarget === "hospital" ? "hospital" : "branch",
        branchId: selectedTarget === "hospital" ? undefined : selectedTarget,
        timings: {
          ...activeTimings,
          useHospitalSchedule: selectedTarget !== "hospital" ? useHospitalSchedule : false,
        },
      }

      const data = await authedFetchJson<{ message?: string }>("/api/admin/working-hours", {
        method: "PUT",
        body: JSON.stringify(payload),
      })

      onNotify?.("success", data.message || "Schedule updated successfully")
      await loadScheduleData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save schedule"
      onNotify?.("error", msg)
    } finally {
      setSaving(false)
    }
  }

  // Calculate current active source for Preview
  const currentBranchObj = branches.find((b) => b.id === selectedTarget)
  let effectiveSourceLabel = "Hospital Default Schedule"
  let sourceBadgeColor = "bg-cyan-100 text-cyan-800 border-cyan-300"

  if (selectedTarget === "hospital") {
    effectiveSourceLabel = "Hospital Default Schedule"
    sourceBadgeColor = "bg-cyan-100 text-cyan-800 border-cyan-300"
  } else if (currentBranchObj) {
    if (useHospitalSchedule || !currentBranchObj.timings) {
      effectiveSourceLabel = "Hospital Default Schedule (Inherited by Branch)"
      sourceBadgeColor = "bg-purple-100 text-purple-800 border-purple-300"
    } else {
      effectiveSourceLabel = "Branch Custom Schedule"
      sourceBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300"
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          Loading working hours & schedule configuration…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm">
                <Clock className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">Hospital & Branch Schedule</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Configure working days, operating hours, and break times. Changes update appointment slot availability dynamically.
            </p>
          </div>

          {!isAdmin && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Read-only view (Admin permission required to edit)
            </div>
          )}
        </div>

        {/* Effective Schedule Source Preview Badge */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">Effective Schedule Source Preview:</span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-2xs ${sourceBadgeColor}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {effectiveSourceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Target Selector Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
        <button
          type="button"
          onClick={() => handleTargetChange("hospital")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
            selectedTarget === "hospital"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Hospital Default Schedule
        </button>

        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleTargetChange(b.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              selectedTarget === b.id
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <GitBranch className="h-4 w-4" />
            Branch: {b.name}
          </button>
        ))}
      </div>

      {/* Branch Inheritance Toggle (When a branch is selected) */}
      {selectedTarget !== "hospital" && isAdmin && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useHospitalSchedule}
              onChange={(e) => {
                setUseHospitalSchedule(e.target.checked)
                if (e.target.checked) {
                  setActiveTimings({ ...hospitalSchedule, useHospitalSchedule: true })
                }
              }}
              className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <p className="text-xs font-bold text-purple-900">Inherit Hospital Default Schedule</p>
              <p className="text-[11px] text-purple-700">
                When checked, this branch will automatically use the hospital default working days and hours.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Day by Day Editor Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {selectedTarget === "hospital"
              ? "Hospital Default Working Days & Hours"
              : `Branch Schedule for ${branches.find((b) => b.id === selectedTarget)?.name || "Branch"}`}
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {WEEKDAYS.map(({ key, label }) => {
            const dayConfig = activeTimings[key] || {
              isOpen: false,
              start: "09:00",
              end: "17:00",
              breakStart: null,
              breakEnd: null,
            }
            const isOpen = dayConfig.isOpen !== false && Boolean(dayConfig.start)

            return (
              <div
                key={key}
                className={`flex flex-col md:flex-row md:items-center justify-between p-4 md:px-6 gap-4 transition-colors ${
                  isOpen ? "bg-white" : "bg-slate-50/70"
                }`}
              >
                {/* Day & Open Toggle */}
                <div className="flex items-center gap-4 min-w-[160px]">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin || (selectedTarget !== "hospital" && useHospitalSchedule)}
                      checked={isOpen}
                      onChange={(e) => updateDayField(key, "isOpen", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600" />
                  </label>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    <span
                      className={`inline-block text-[10px] font-bold ${
                        isOpen ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {isOpen ? "OPEN FOR BOOKING" : "CLOSED"}
                    </span>
                  </div>
                </div>

                {/* Operating Hours Pickers */}
                {isOpen ? (
                  <div className="flex flex-wrap items-center gap-4 flex-1 md:justify-end">
                    {/* Working Hours */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <span>Open:</span>
                        <input
                          type="time"
                          disabled={!isAdmin || (selectedTarget !== "hospital" && useHospitalSchedule)}
                          value={dayConfig.start || "09:00"}
                          onChange={(e) => updateDayField(key, "start", e.target.value)}
                          className="bg-transparent font-mono text-xs font-bold text-slate-900 border-b border-slate-300 focus:border-cyan-600 outline-none"
                        />
                        <span className="mx-1 text-slate-400">–</span>
                        <span>Close:</span>
                        <input
                          type="time"
                          disabled={!isAdmin || (selectedTarget !== "hospital" && useHospitalSchedule)}
                          value={dayConfig.end || "17:00"}
                          onChange={(e) => updateDayField(key, "end", e.target.value)}
                          className="bg-transparent font-mono text-xs font-bold text-slate-900 border-b border-slate-300 focus:border-cyan-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* Optional Break Time (Future Ready) */}
                    <div className="flex items-center gap-2 bg-amber-50/50 px-3 py-1.5 rounded-lg border border-amber-200/60">
                      <Coffee className="h-3.5 w-3.5 text-amber-600" />
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <span className="text-amber-800">Break:</span>
                        <input
                          type="time"
                          disabled={!isAdmin || (selectedTarget !== "hospital" && useHospitalSchedule)}
                          value={dayConfig.breakStart || ""}
                          onChange={(e) => updateDayField(key, "breakStart", e.target.value || null)}
                          className="bg-transparent font-mono text-xs text-amber-900 border-b border-amber-300 focus:border-amber-600 outline-none"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          disabled={!isAdmin || (selectedTarget !== "hospital" && useHospitalSchedule)}
                          value={dayConfig.breakEnd || ""}
                          onChange={(e) => updateDayField(key, "breakEnd", e.target.value || null)}
                          className="bg-transparent font-mono text-xs text-amber-900 border-b border-amber-300 focus:border-amber-600 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No slots will be generated on closed days.</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Save Bar */}
        {isAdmin && (
          <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={loadScheduleData}
              disabled={saving}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              loadingText="Saving Schedule..."
              onClick={handleSave}
              className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save Schedule & Update Availability
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
