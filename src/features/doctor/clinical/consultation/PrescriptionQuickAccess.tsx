"use client"

import { useEffect, useMemo, useState } from "react"
import type { CompletionFormEntry } from "@/types/appointments"
import type { Appointment } from "@/types/patient"
import type { MedicineSuggestion } from "@/utils/medicineSuggestions"
import {
  deletePrescriptionTemplate,
  getFavoriteMedicines,
  getFrequentlyUsedMedicines,
  getPrescriptionTemplates,
  getRecentPrescriptionsFromHistory,
  mergeMedicines,
  savePrescriptionTemplate,
  toggleFavoriteMedicine,
  type FavoriteMedicine,
  type PrescriptionTemplate,
} from "@/utils/prescriptionWorkspace"
import { Bookmark, Clock, FileStack, Star, Trash2 } from "lucide-react"

type MedicineRow = CompletionFormEntry["medicines"][number]

interface PrescriptionQuickAccessProps {
  doctorUid: string
  appointment: Appointment
  patientHistory: Appointment[]
  medicines: MedicineRow[]
  medicineSuggestions: MedicineSuggestion[]
  onApplyMedicines: (medicines: MedicineRow[]) => void
  onCopyPrevious?: () => void
  showUsePrevious?: boolean
}

type TabKey = "favorites" | "frequent" | "templates" | "recent"

export default function PrescriptionQuickAccess({
  doctorUid,
  appointment,
  patientHistory,
  medicines,
  medicineSuggestions,
  onApplyMedicines,
  onCopyPrevious,
  showUsePrevious,
}: PrescriptionQuickAccessProps) {
  const [tab, setTab] = useState<TabKey>("frequent")
  const [favorites, setFavorites] = useState<FavoriteMedicine[]>([])
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([])
  const [templateName, setTemplateName] = useState("")

  useEffect(() => {
    if (!doctorUid) return
    setFavorites(getFavoriteMedicines(doctorUid))
    setTemplates(getPrescriptionTemplates(doctorUid))
  }, [doctorUid, medicines])

  const frequent = useMemo(
    () => getFrequentlyUsedMedicines(medicineSuggestions, 8),
    [medicineSuggestions]
  )

  const recentPrescriptions = useMemo(
    () =>
      getRecentPrescriptionsFromHistory(
        patientHistory,
        appointment.doctorId,
        appointment.id,
        4
      ),
    [patientHistory, appointment.doctorId, appointment.id]
  )

  const tabs: Array<{ id: TabKey; label: string; icon: React.ReactNode }> = [
    { id: "frequent", label: "Frequent", icon: <Clock className="w-3 h-3" /> },
    { id: "favorites", label: "Favourites", icon: <Star className="w-3 h-3" /> },
    { id: "templates", label: "Templates", icon: <FileStack className="w-3 h-3" /> },
    { id: "recent", label: "Recent", icon: <Bookmark className="w-3 h-3" /> },
  ]

  const applySingle = (med: MedicineRow) => {
    onApplyMedicines(mergeMedicines(medicines, [med]))
  }

  const applyMany = (meds: MedicineRow[]) => {
    onApplyMedicines(mergeMedicines(medicines, meds))
  }

  const handleSaveTemplate = () => {
    if (!doctorUid || medicines.length === 0) return
    const name = templateName.trim() || `Template ${templates.length + 1}`
    setTemplates(savePrescriptionTemplate(doctorUid, name, medicines))
    setTemplateName("")
    setTab("templates")
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/70 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-teal-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-2.5 max-h-36 overflow-y-auto">
        {tab === "frequent" && (
          <div className="flex flex-wrap gap-1.5">
            {frequent.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic px-1">No frequent medicines yet.</p>
            ) : (
              frequent.map((med) => (
                <button
                  key={med.name}
                  type="button"
                  onClick={() => applySingle(med)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                  title="Click to add"
                >
                  {med.name}
                </button>
              ))
            )}
          </div>
        )}

        {tab === "favorites" && (
          <div className="space-y-1">
            {favorites.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic px-1">
                Star medicines in the prescription list to save favourites.
              </p>
            ) : (
              favorites.map((med) => (
                <button
                  key={med.name}
                  type="button"
                  onClick={() =>
                    applySingle({
                      name: med.name,
                      dosage: med.dosage ?? "",
                      frequency: med.frequency ?? "",
                      duration: med.duration ?? "7 days",
                    })
                  }
                  className="w-full text-left rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] hover:border-amber-300 hover:bg-amber-50/50"
                >
                  <span className="font-semibold text-slate-800">{med.name}</span>
                  {med.dosage && <span className="text-slate-500 ml-1">· {med.dosage}</span>}
                </button>
              ))
            )}
          </div>
        )}

        {tab === "templates" && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSaveTemplate()
                  }
                }}
              />
              <button
                type="button"
                disabled={medicines.length === 0}
                onClick={handleSaveTemplate}
                className="shrink-0 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            {templates.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic px-1">No templates saved yet.</p>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => applyMany(tpl.medicines)}
                    className="flex-1 min-w-0 text-left text-[11px] font-medium text-slate-800 hover:text-teal-700 truncate"
                  >
                    {tpl.name}
                    <span className="text-slate-500 ml-1">({tpl.medicines.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplates(deletePrescriptionTemplate(doctorUid, tpl.id))}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    aria-label="Delete template"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "recent" && (
          <div className="space-y-1">
            {showUsePrevious && onCopyPrevious && (
              <button
                type="button"
                onClick={onCopyPrevious}
                className="w-full text-left rounded-lg border border-teal-200 bg-teal-50/60 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-50 mb-1"
              >
                Copy last prescription for this patient
              </button>
            )}
            {recentPrescriptions.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic px-1">No recent prescriptions on record.</p>
            ) : (
              recentPrescriptions.map((rx) => (
                <button
                  key={rx.label}
                  type="button"
                  onClick={() => applyMany(rx.medicines)}
                  className="w-full text-left rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <span className="font-medium text-slate-800 block truncate">{rx.label}</span>
                  <span className="text-slate-500">{rx.medicines.length} medicine(s)</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function FavoriteMedicineToggle({
  doctorUid,
  medicine,
  onFavoritesChange,
}: {
  doctorUid: string
  medicine: MedicineRow
  onFavoritesChange?: () => void
}) {
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    if (!doctorUid || !medicine.name.trim()) {
      setIsFavorite(false)
      return
    }
    const favs = getFavoriteMedicines(doctorUid)
    setIsFavorite(favs.some((f) => f.name.trim().toLowerCase() === medicine.name.trim().toLowerCase()))
  }, [doctorUid, medicine.name])

  if (!doctorUid || !medicine.name.trim()) return null

  return (
    <button
      type="button"
      onClick={() => {
        toggleFavoriteMedicine(doctorUid, medicine)
        onFavoritesChange?.()
        setIsFavorite((prev) => !prev)
      }}
      className={`p-1 rounded transition-colors ${
        isFavorite ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-amber-400"
      }`}
      title={isFavorite ? "Remove from favourites" : "Add to favourites"}
      aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
    >
      <Star className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
    </button>
  )
}
