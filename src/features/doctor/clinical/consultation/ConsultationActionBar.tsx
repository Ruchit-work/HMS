"use client"

import { Button } from '@/shared/components'
import {
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Hospital,
  Printer,
  RefreshCw,
  Save,
} from "lucide-react"

interface ConsultationActionBarProps {
  formId: string
  updating: boolean
  admitting: boolean
  canComplete: boolean
  hasDocumentation: boolean
  onSaveDraft: () => void
  onPrintPrescription: () => void
  onSaveAndNext: () => void
  onAdmit: () => void
  recheckupRequired?: boolean
  recheckupDays?: number
  onRecheckupRequiredChange?: (value: boolean) => void
  onRecheckupDaysChange?: (value: number) => void
  className?: string
}

export default function ConsultationActionBar({
  formId,
  updating,
  admitting,
  canComplete,
  hasDocumentation,
  onSaveDraft,
  onPrintPrescription,
  onSaveAndNext,
  onAdmit,
  recheckupRequired = false,
  recheckupDays = 7,
  onRecheckupRequiredChange,
  onRecheckupDaysChange,
  className = "",
}: ConsultationActionBarProps) {
  const disabled = updating || !canComplete || !hasDocumentation

  return (
    <div className={`consultation-action-bar consultation-action-bar--sticky mt-2 ${className}`.trim()}>
      <div className="consultation-action-bar__secondary">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSaveDraft}
          title="Save draft (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
          Save draft
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrintPrescription}
          title="Print prescription PDF"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Rx
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdmit}
          disabled={disabled || admitting}
          title="Request admission"
        >
          <Hospital className="w-3.5 h-3.5" />
          {admitting ? "Sending…" : "Admit"}
        </Button>
      </div>

      {onRecheckupRequiredChange && (
        <div className="consultation-action-bar__followup">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recheckupRequired}
              onChange={(e) => onRecheckupRequiredChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-700 whitespace-nowrap flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-slate-400" />
              Follow-up
            </span>
          </label>
          {recheckupRequired && onRecheckupDaysChange && (
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[10px] text-slate-400">in</span>
              <div className="relative inline-flex items-center rounded border border-slate-300 bg-white shadow-xs overflow-hidden focus-within:ring-1 focus-within:ring-sky-500 focus-within:border-sky-500">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={recheckupDays}
                  onChange={(e) =>
                    onRecheckupDaysChange(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-9 px-1 py-0.5 text-xs text-slate-800 font-semibold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex flex-col border-l border-slate-200 divide-y divide-slate-100 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => onRecheckupDaysChange(Math.min(365, (recheckupDays || 1) + 1))}
                    className="px-1 py-[1px] hover:bg-sky-100 text-slate-500 hover:text-sky-700 transition-colors flex items-center justify-center"
                    title="Increase days"
                    aria-label="Increase days"
                  >
                    <ChevronUp className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRecheckupDaysChange(Math.max(1, (recheckupDays || 1) - 1))}
                    className="px-1 py-[1px] hover:bg-sky-100 text-slate-500 hover:text-sky-700 transition-colors flex items-center justify-center"
                    title="Decrease days"
                    aria-label="Decrease days"
                  >
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <span className="text-[10px] text-slate-400">days</span>
            </div>
          )}
        </div>
      )}

      <div className="consultation-action-bar__primary">
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={onSaveAndNext}
          title="Complete and open next patient (Ctrl+Shift+Enter)"
          className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          Save &amp; next
        </Button>
        <Button
          type="submit"
          form={formId}
          size="sm"
          disabled={disabled}
          title="Complete consultation (Ctrl+Enter)"
          className="bg-slate-900 hover:bg-black text-white border-transparent"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {updating ? "Completing…" : "Complete"}
        </Button>
      </div>
    </div>
  )
}
