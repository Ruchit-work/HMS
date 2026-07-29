"use client"

import React, { useState, useEffect } from "react"
import { Printer, Save, RefreshCw, FileText, Smartphone, Image as ImageIcon } from "lucide-react"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { useHospitalPrintSettings } from "@/shared/hooks/useHospitalPrintSettings"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import type { HospitalPrintSettings } from "@/types/print"

type Notify = (type: "success" | "error", message: string) => void

export function HospitalPrintSettingsScreen({ onNotify }: { onNotify: Notify }) {
  const { activeHospitalId } = useMultiHospital()
  const { settings, loading, reload } = useHospitalPrintSettings()

  const [form, setForm] = useState<HospitalPrintSettings>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeHospitalId) {
      onNotify("error", "No active hospital selected.")
      return
    }

    setSaving(true)
    try {
      await authedFetchJson(
        "/api/admin/hospital-print-settings",
        {
          method: "PUT",
          body: JSON.stringify({
            hospitalId: activeHospitalId,
            settings: form,
          }),
        },
        "Failed to update print settings"
      )
      onNotify("success", "Hospital print & branding settings updated successfully!")
      await reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save print settings"
      onNotify("error", msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading hospital print settings...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Printer className="h-5 w-5 text-cyan-600" />
              Document Branding & Print Architecture Settings
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Customize hospital logos, headers, footers, default paper layouts (A4 vs Thermal 80mm), and auto-print triggers.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 transition-all"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Print Settings
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Header & Logo Settings */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-cyan-900 text-[11px] flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" /> Header & Logo Branding
            </h4>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hospital Logo URL</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={form.logoUrl || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Leave blank to use default HMS branding logo badge.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Header Title (Hospital Name)</label>
              <input
                type="text"
                value={form.headerTitle || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, headerTitle: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-cyan-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Header Subtitle / Slogan</label>
              <input
                type="text"
                placeholder="Multi-Specialty Hospital & Medical Center"
                value={form.headerSubtitle || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, headerSubtitle: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hospital Contact Phone</label>
                <input
                  type="text"
                  value={form.phone || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hospital Email</label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hospital Address</label>
              <textarea
                rows={2}
                value={form.address || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Paper Layout & Footer Settings */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-cyan-900 text-[11px] flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Paper Layout & Footer Rules
            </h4>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Default Paper Size</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, paperSize: "A4" }))}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                    form.paperSize !== "Thermal"
                      ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-xs"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  A4 Standard
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, paperSize: "Thermal" }))}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                    form.paperSize === "Thermal"
                      ? "border-cyan-600 bg-cyan-50 text-cyan-900 shadow-xs"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  Thermal (80mm)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Footer Text / Disclaimer</label>
              <textarea
                rows={3}
                placeholder="Thank you for choosing our hospital..."
                value={form.footerText || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, footerText: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none"
              />
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <span className="font-bold text-slate-800 block">Automated Print Triggers</span>
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.autoPrintBooking)}
                  onChange={(e) => setForm((prev) => ({ ...prev, autoPrintBooking: e.target.checked }))}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                />
                <span>Auto-open print modal after appointment booking confirmation</span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.autoPrintPayment)}
                  onChange={(e) => setForm((prev) => ({ ...prev, autoPrintPayment: e.target.checked }))}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                />
                <span>Auto-open print modal after payment receipt generation</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
