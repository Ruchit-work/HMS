"use client"

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react"
import {
  Building,
  MapPin,
  Palette,
  Globe,
  Lock,
  Save,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  Image as ImageIcon,
  Mail,
  Phone,
  Hash,
  ExternalLink,
  UploadCloud,
  X,
  Printer,
} from "lucide-react"
import { Button } from "@/shared/components"
import { useAuth } from "@/shared/hooks/useAuth"
import { authedFetchJson } from "@/shared/utils/authedFetch"

function ImageDropzone({
  label,
  value,
  onChange,
  disabled,
  onNotify,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  onNotify?: (type: "success" | "error", message: string) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      onNotify?.("error", "Please select a valid image file (PNG, JPG, WEBP, SVG)")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      onNotify?.("error", "Image file size should be less than 2MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const rawDataUrl = reader.result
        // Resize image to max 512px to prevent Firestore document limit errors
        const img = new Image()
        img.onerror = () => {
          onChange(rawDataUrl)
        }
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas")
            const maxDim = label.toLowerCase().includes("favicon") ? 128 : 512
            let width = img.width
            let height = img.height

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width)
                width = maxDim
              } else {
                width = Math.round((width * maxDim) / height)
                height = maxDim
              }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext("2d")
            ctx?.drawImage(img, 0, 0, width, height)

            const optimizedUrl = canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.9)
            onChange(optimizedUrl || rawDataUrl)
          } catch {
            onChange(rawDataUrl)
          }
        }
        img.src = rawDataUrl
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    processFile(file)
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700">{label}</label>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const file = e.target.files?.[0]
          processFile(file)
          e.target.value = ""
        }}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled) fileInputRef.current?.click()
        }}
        className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? "border-cyan-500 bg-cyan-50/60 scale-[1.01]"
            : value
            ? "border-slate-300 bg-slate-50/50 hover:border-cyan-500 hover:bg-slate-50"
            : "border-slate-300 bg-slate-50/30 hover:border-cyan-500 hover:bg-cyan-50/30"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {value ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="h-14 max-w-[180px] object-contain rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xs" />
            <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 bg-cyan-50 rounded-lg border border-cyan-200 hover:bg-cyan-100 transition-colors"
              >
                <UploadCloud className="h-3 w-3" /> Change
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange("")
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center py-2">
            <div className="h-9 w-9 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
              <UploadCloud className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Click to upload from device <span className="text-slate-400 font-normal">or drag & drop</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP, SVG (Max 2MB)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface GeneralSettingsData {
  hospitalId: string
  name: string
  code: string
  email: string
  phone: string
  address: string
  registrationNumber: string
  gstNumber: string
  website: string
  city: string
  state: string
  country: string
  pinCode: string
  logo: string
  favicon: string
  primaryColor: string
  secondaryColor: string
  timeZone: string
  dateFormat: string
  timeFormat: "12h" | "24h"
  currency: string
  language: string
}

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST - UTC+05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST - UTC-05:00)" },
  { value: "Europe/London", label: "Europe/London (GMT - UTC+00:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST - UTC+04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT - UTC+08:00)" },
]

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (e.g. 31/07/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (e.g. 07/31/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (e.g. 2026-07-31)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY (e.g. 31 Jul 2026)" },
]

const LANGUAGES = [
  { value: "en", label: "English (Default)" },
  { value: "hi", label: "Hindi (हिन्दी)" },
  { value: "gu", label: "Gujarati (ગુજરાતી)" },
  { value: "es", label: "Spanish (Español)" },
]

import { useMultiHospital } from "@/providers/MultiHospitalProvider"

export default function GeneralSettings({
  onNotify,
}: {
  onNotify?: (type: "success" | "error", message: string) => void
}) {
  const { user } = useAuth()
  const { refreshHospitals } = useMultiHospital()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<GeneralSettingsData | null>(null)

  // Form State
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")

  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [country, setCountry] = useState("India")
  const [pinCode, setPinCode] = useState("")

  const [logo, setLogo] = useState("")
  const [favicon, setFavicon] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#0284c7")
  const [secondaryColor, setSecondaryColor] = useState("#0f172a")

  const [timeZone, setTimeZone] = useState("Asia/Kolkata")
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY")
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h")
  const [currency, setCurrency] = useState("INR ₹")
  const [language, setLanguage] = useState("en")

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetchJson<{ success: boolean; settings: GeneralSettingsData }>(
        "/api/admin/hospital-general-settings"
      )
      const s = res.settings
      setData(s)
      setName(s.name || "")
      setCode(s.code || "")
      setRegistrationNumber(s.registrationNumber || "")
      setGstNumber(s.gstNumber || "")
      setEmail(s.email || "")
      setPhone(s.phone || "")
      setWebsite(s.website || "")

      setAddress(s.address || "")
      setCity(s.city || "")
      setState(s.state || "")
      setCountry(s.country || "India")
      setPinCode(s.pinCode || "")

      setLogo(s.logo || "")
      setFavicon(s.favicon || "")
      setPrimaryColor(s.primaryColor || "#0284c7")
      setSecondaryColor(s.secondaryColor || "#0f172a")

      setTimeZone(s.timeZone || "Asia/Kolkata")
      setDateFormat(s.dateFormat || "DD/MM/YYYY")
      setTimeFormat(s.timeFormat || "12h")
      setCurrency(s.currency || "INR ₹")
      setLanguage(s.language || "en")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load general settings"
      onNotify?.("error", msg)
    } finally {
      setLoading(false)
    }
  }, [onNotify])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    setSaving(true)
    try {
      const payload = {
        name,
        email,
        phone,
        address,
        registrationNumber,
        gstNumber,
        website,
        city,
        state,
        country,
        pinCode,
        logo,
        favicon,
        primaryColor,
        secondaryColor,
        timeZone,
        dateFormat,
        timeFormat,
        currency,
        language,
      }

      const res = await authedFetchJson<{ message?: string }>(
        "/api/admin/hospital-general-settings",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      )

      onNotify?.("success", res.message || "General settings saved successfully.")
      await loadSettings()
      await refreshHospitals()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings"
      onNotify?.("error", msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          Loading general hospital settings…
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto print:max-w-none print:space-y-4 print:p-0">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-b print:border-slate-300 print:rounded-none print:shadow-none print:p-0 print:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm print:hidden">
                <Building className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">{name || "Hospital General Settings"}</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Official Hospital Configuration Profile & System Metadata
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="text-xs"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Profile
            </Button>
            {!isAdmin && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Read-only view
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Hospital Information */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-900">1. Hospital Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital Name *</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Harmony Hospital"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              Hospital Code <Lock className="h-3 w-3 text-slate-400" />
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Hash className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                readOnly
                disabled
                value={code}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-slate-100 text-slate-600 font-mono text-xs font-bold rounded-xl cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Number</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="REG-2026-98765"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">GST Number (Optional)</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="22AAAAA0000A1Z5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-3.5 w-3.5" />
              </span>
              <input
                type="email"
                required
                disabled={!isAdmin}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
                placeholder="contact@hospital.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone className="h-3.5 w-3.5" />
              </span>
              <input
                type="tel"
                required
                disabled={!isAdmin}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Website URL (Optional)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
              <input
                type="url"
                disabled={!isAdmin}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
                placeholder="https://www.harmonyhospital.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Address */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <MapPin className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-900">2. Physical Location & Address</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address *</label>
            <textarea
              rows={2}
              required
              disabled={!isAdmin}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="Building, Ring Road, Landmark"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="Surat"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="Gujarat"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Country *</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="India"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">PIN / Postal Code *</label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="395007"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Branding */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Palette className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-900">3. Branding & Theme Customization</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Controls Column */}
          <div className="lg:col-span-6 space-y-4">
            <ImageDropzone
              label="Hospital Logo"
              value={logo}
              onChange={setLogo}
              disabled={!isAdmin}
              onNotify={onNotify}
            />

            <ImageDropzone
              label="Favicon"
              value={favicon}
              onChange={setFavicon}
              disabled={!isAdmin}
              onNotify={onNotify}
            />
          </div>

          {/* Live Side Preview Panel */}
          <div className="lg:col-span-6 flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-cyan-600" />
                <span className="text-xs font-bold text-slate-800">Live Branding Side Preview</span>
              </div>
              {logo ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Logo Ready in Preview
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                  Default Placeholder
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              This preview shows how your logo and hospital name will look in the top navigation header and sidebar across all portals:
            </p>

            {/* Mock Header Bar Preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Header Branding Mockup</span>
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt="Logo Preview"
                    className="w-8 h-8 object-contain rounded-lg border border-slate-200 bg-white p-0.5 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center shrink-0 shadow-2xs">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                    {name || "Hospital Name"}
                  </p>
                  <p className="text-[10px] text-slate-500">Hospital Portal</p>
                </div>
              </div>
            </div>

            {/* Mock Sidebar Header Preview */}
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xs space-y-1 text-white">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dark Sidebar Mockup</span>
              <div className="flex items-center gap-3 p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt="Sidebar Logo Preview"
                    className="w-8 h-8 object-contain rounded-lg border border-slate-600 bg-white p-0.5 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate max-w-[200px]">
                    {name || "Hospital Name"}
                  </p>
                  <p className="text-[10px] text-slate-400">Admin Dashboard</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic pt-1">
              * Click "Save General Settings" below to persist changes to database and apply app-wide.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Theme Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                disabled={!isAdmin}
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                disabled={!isAdmin}
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-32 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Secondary Theme Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                disabled={!isAdmin}
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-9 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                disabled={!isAdmin}
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-32 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Localization */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Globe className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-900">4. Regional Localization & Preferences</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Time Zone</label>
            <select
              disabled={!isAdmin}
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Date Format</label>
            <select
              disabled={!isAdmin}
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
            >
              {DATE_FORMATS.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Time Format</label>
            <select
              disabled={!isAdmin}
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as "12h" | "24h")}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
            >
              <option value="12h">12-Hour Format (e.g. 02:30 PM)</option>
              <option value="24h">24-Hour Format (e.g. 14:30)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Currency</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
              placeholder="INR ₹"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">System Language (Future Ready)</label>
            <select
              disabled={!isAdmin}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-slate-50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-end gap-3 shadow-2xs print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={loadSettings}
            disabled={saving}
            className="text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            loadingText="Saving Settings..."
            className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save General Settings
          </Button>
        </div>
      )}
    </form>
  )
}
