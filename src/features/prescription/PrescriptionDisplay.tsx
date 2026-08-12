"use client"

import { useState } from "react"
import { Appointment } from "@/types/patient"
import { convertPrescriptionToPrintData, isValid6DigitPatientId, fetch6DigitPatientId } from "@/shared/utils/printConverters"
import { renderPrescriptionDocumentHTML } from "@/shared/utils/documents/documentTemplateEngine"
import { renderHTMLToPdfDownload, inspectAppComputedStyles } from "@/shared/utils/documents/html2pdfEngine"
import { Button } from '@/shared/components'

// Helper function to parse prescription text
const parsePrescription = (text: string) => {
  if (!text) return null
  
  const lines = text.split('\n').filter(line => line.trim())
  const medicines: Array<{emoji: string, name: string, dosage: string, frequency: string, duration: string}> = []
  let advice = ""
  
  let currentMedicine: {emoji: string, name: string, dosage: string, frequency: string, duration: string} | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip prescription header
    if (line.includes('🧾') && line.includes('Prescription')) continue
    
    // Check for medicine line (contains emoji and medicine name) - matches *1️⃣ Medicine Name Dosage*
    const medicineMatch = line.match(/\*([1-9]️⃣|🔟)\s+(.+?)\*/)
    if (medicineMatch) {
      // Save previous medicine
      if (currentMedicine) {
        medicines.push(currentMedicine)
      }
      
      const emoji = medicineMatch[1]
      let nameWithDosage = medicineMatch[2].trim()
      
      // Extract dosage from anywhere (e.g., "20mg", "400mg")
      const dosageMatch = nameWithDosage.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap))/i)
      let dosage = ""
      if (dosageMatch) {
        dosage = dosageMatch[1]
        nameWithDosage = nameWithDosage.replace(dosageMatch[0], '').trim()
      }
      
      // Extract duration if present in the line (e.g., "for 14 days", "for 7 days")
      let duration = ""
      const durationMatch = nameWithDosage.match(/(?:for|duration)\s+(\d+\s*(?:days?|weeks?|months?))/i)
      if (durationMatch) {
        duration = durationMatch[1]
        nameWithDosage = nameWithDosage.replace(durationMatch[0], '').trim()
      }
      
      // Extract frequency if present (e.g., "daily", "twice", "three times")
      let frequency = ""
      const frequencyMatch = nameWithDosage.match(/(daily|once|twice|three times|four times|\d+\s*times)/i)
      if (frequencyMatch) {
        frequency = frequencyMatch[1]
        nameWithDosage = nameWithDosage.replace(frequencyMatch[0], '').trim()
      }
      
      // Clean up name (remove brackets, dashes, extra spaces)
      const name = nameWithDosage.replace(/\[.*?\]/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim()
      
      currentMedicine = {
        emoji,
        name: name || "Medicine",
        dosage,
        frequency,
        duration
      }
    } else if (currentMedicine) {
      // Check for frequency (starts with • and doesn't contain "duration")
      if (line.startsWith('•') && !line.toLowerCase().includes('duration')) {
        const freq = line.replace('•', '').trim()
        if (freq && !currentMedicine.frequency) {
          currentMedicine.frequency = freq
        }
      }
      
      // Check for duration (starts with • and contains "duration")
      if (line.startsWith('•') && line.toLowerCase().includes('duration')) {
        const duration = line.replace('•', '').replace(/duration:/i, '').trim()
        if (duration) {
          currentMedicine.duration = duration
        }
      }
    }
    
    // Check for advice
    if (line.includes('📌') && line.includes('Advice')) {
      advice = line.replace(/📌\s*\*?Advice:\*?\s*/i, '').trim()
    }
  }
  
  // Add last medicine
  if (currentMedicine) {
    medicines.push(currentMedicine)
  }
  
  return { medicines, advice }
}

interface PrescriptionDisplayProps {
  appointment: Appointment
  showPdfButton?: boolean
  variant?: "default" | "modal" | "compact" // Different styling variants
  onPdfClick?: (e?: React.MouseEvent) => void
  showHeader?: boolean // Whether to show the main header
  compact?: boolean // Legacy prop for backward compatibility
}

export default function PrescriptionDisplay({ 
  appointment, 
  showPdfButton = true,
  variant = "default",
  onPdfClick
}: PrescriptionDisplayProps) {
  const [downloadState, setDownloadState] = useState<"idle" | "generating" | "success">("idle")
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Only show for completed appointments with medicine or notes
  if (appointment.status !== "completed" || (!appointment.medicine && !appointment.doctorNotes)) {
    return null
  }

  const handlePdfClick = async (e?: React.MouseEvent) => {
    if (onPdfClick) {
      onPdfClick(e)
    } else if (e) {
      e.stopPropagation()
    }

    if (downloadState === "generating") return
    console.log("[PDF Step 1] Download button clicked")
    inspectAppComputedStyles("1. Download Button Clicked")

    setDownloadState("generating")
    setToastMessage(null)

    try {
      let aptToPrint = appointment
      if (!isValid6DigitPatientId(appointment.patientId)) {
        const targetUid = appointment.patientUid || appointment.patientId
        const hospId = (appointment as any)?.hospitalId
        if (targetUid) {
          const fetchedId = await fetch6DigitPatientId(String(targetUid), hospId || undefined)
          if (fetchedId) {
            aptToPrint = {
              ...appointment,
              patientId: fetchedId,
              patientSequentialId: fetchedId,
            } as any
          }
        }
      }

      const printData = convertPrescriptionToPrintData(aptToPrint)
      const html = renderPrescriptionDocumentHTML(printData)
      const safeName = (aptToPrint.patientName || "Patient").replace(/\s+/g, "_")
      const safeDate = (aptToPrint.appointmentDate || new Date().toISOString().split("T")[0]).replace(/[\s,/]+/g, "_")

      await renderHTMLToPdfDownload(html, `Prescription_${safeName}_${safeDate}.pdf`)

      setDownloadState("success")
      setToastMessage({ type: "success", text: "PDF downloaded successfully" })

      setTimeout(() => {
        setDownloadState("idle")
      }, 2500)
      setTimeout(() => {
        setToastMessage(null)
      }, 4000)
    } catch (err) {
      console.error("PDF download failed:", err)
      setDownloadState("idle")
      setToastMessage({ type: "error", text: "Failed to download PDF. Please try again." })
      setTimeout(() => {
        setToastMessage(null)
      }, 4000)
    }
  }

  const containerClass = variant === "modal" 
    ? "bg-white rounded-lg shadow-sm border border-green-200 p-4 sm:p-6 lg:col-span-2"
    : "md:col-span-2 bg-green-50 rounded-lg p-4"

  const headerClass = variant === "modal"
    ? "text-base sm:text-lg font-semibold text-gray-900"
    : "font-semibold text-gray-900"

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={headerClass + " flex items-center gap-2"}>
          <span>💊</span>
          <span>Prescription & Doctor&apos;s Notes</span>
        </h4>
        {showPdfButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePdfClick}
            disabled={downloadState === "generating"}
            className={`whitespace-nowrap shrink-0 justify-center min-w-[145px] ${
              downloadState === "success" ? "text-emerald-700 border-emerald-300 bg-emerald-50" : ""
            }`}
          >
            {downloadState === "generating" ? (
              <>
                <svg className="w-4 h-4 animate-spin text-cyan-600 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : downloadState === "success" ? (
              <>
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Downloaded ✓</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download PDF</span>
              </>
            )}
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {/* Final Diagnosis */}
        {((appointment as any).finalDiagnosis && Array.isArray((appointment as any).finalDiagnosis) && (appointment as any).finalDiagnosis.length > 0) && (
          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
            <h5 className="text-cyan-900 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Final Diagnosis</span>
            </h5>
            <div className="flex flex-wrap gap-2">
              {(appointment as any).finalDiagnosis.map((diagnosis: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 bg-cyan-100 border border-cyan-300 rounded-lg text-sm font-medium text-cyan-900"
                >
                  {diagnosis}
                </span>
              ))}
            </div>
            {(appointment as any).customDiagnosis && (
              <div className="mt-3 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
                <p className="text-sm font-semibold text-cyan-900 mb-1">Custom Diagnosis:</p>
                <p className="text-sm text-cyan-900 whitespace-pre-line">{(appointment as any).customDiagnosis}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Prescription/Medicine */}
        {!appointment.medicine && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h5 className="text-gray-700 font-semibold mb-1 flex items-center gap-2">
              <span>💊</span>
              <span>Prescribed Medicines</span>
            </h5>
            <p className="text-sm text-gray-500">No new medications prescribed.</p>
          </div>
        )}
        {appointment.medicine && (() => {
          const parsed = parsePrescription(appointment.medicine)
          if (parsed && parsed.medicines.length > 0) {
            return (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h5 className="text-gray-700 font-semibold mb-3 flex items-center gap-2">
                  <span>💊</span>
                  <span>Prescribed Medicines</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {parsed.medicines.map((med, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className="text-lg">{med.emoji}</span>
                        <div className="flex-1">
                          <h6 className="font-semibold text-gray-900 text-sm">
                            {med.name}
                            {med.dosage && <span className="text-gray-600 font-normal"> ({med.dosage})</span>}
                          </h6>
                        </div>
                      </div>
                      <div className="ml-7 space-y-0.5 text-sm text-gray-700">
                        {med.frequency && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">•</span>
                            <span>{med.frequency}</span>
                          </div>
                        )}
                        {med.duration && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">•</span>
                            <span><span className="font-medium">Duration:</span> {med.duration}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {parsed.advice && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h6 className="text-gray-700 font-semibold mb-2 flex items-center gap-2">
                      <span>📌</span>
                      <span>Advice</span>
                    </h6>
                    <p className="text-gray-900 text-sm whitespace-pre-line">{parsed.advice}</p>
                  </div>
                )}
              </div>
            )
          } else {
            // Fallback to plain text if parsing fails
            return (
              <div>
                <span className="text-gray-600 font-medium">💊 Prescribed Medicine:</span>
                <p className="text-gray-900 mt-1 bg-white p-3 rounded border whitespace-pre-line text-sm">
                  {appointment.medicine}
                </p>
              </div>
            )
          }
        })()}
        
        {/* Doctor Notes */}
        {appointment.doctorNotes && (
          <div>
            <h5 className="text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <span>📝</span>
              <span>Doctor&apos;s Notes</span>
            </h5>
            <p className="text-gray-900 bg-white p-3 rounded border whitespace-pre-line text-sm">
              {appointment.doctorNotes}
            </p>
          </div>
        )}
      </div>
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage.type === "success" ? (
            <span className="text-emerald-400 font-bold text-sm">✓</span>
          ) : (
            <span className="text-rose-400 font-bold text-sm">✕</span>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  )
}

