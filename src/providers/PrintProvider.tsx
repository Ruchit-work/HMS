"use client"

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react"
import {
  PrintDocumentData,
  PrintAppointmentData,
  PrintBillingData,
  PrintPrescriptionData,
  PrintAdmissionData,
  PrintDischargeData,
  PrintLabReportData,
  PaperSize,
  PrintOptions,
  HospitalPrintSettings,
} from "@/types/print"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { useHospitalPrintSettings } from "@/shared/hooks/useHospitalPrintSettings"
import {
  generateAppointmentSlipPDF,
  generateBillingInvoicePDF,
  generatePrescriptionPDFNew,
  generateAdmissionFormPDF,
  generateDischargeSummaryPDF,
  generateLabReportPDF,
} from "@/shared/utils/documents/pdfGenerators"

interface PrintContextType {
  isOpen: boolean
  documentData: PrintDocumentData | null
  paperSize: PaperSize
  printAppointmentSlip: (data: PrintAppointmentData, options?: PrintOptions) => void
  printBillingInvoice: (data: PrintBillingData, options?: PrintOptions) => void
  printPrescription: (data: PrintPrescriptionData, options?: PrintOptions) => void
  printAdmissionForm: (data: PrintAdmissionData, options?: PrintOptions) => void
  printDischargeSummary: (data: PrintDischargeData, options?: PrintOptions) => void
  printLabReport: (data: PrintLabReportData, options?: PrintOptions) => void
  printCustomDocument: (documentData: PrintDocumentData, options?: PrintOptions) => void
  closePrint: () => void
}

const PrintContext = createContext<PrintContextType | undefined>(undefined)

export function PrintProvider({ children }: { children: ReactNode }) {
  const { activeHospital } = useMultiHospital()
  const { settings: customPrintSettings } = useHospitalPrintSettings()
  const [isOpen, setIsOpen] = useState(false)
  const [documentData, setDocumentData] = useState<PrintDocumentData | null>(null)
  const [paperSize] = useState<PaperSize>("A4")

  // Combine Active Logged-In Hospital Profile & Custom Print Settings dynamically
  const hospitalBranding: HospitalPrintSettings = useMemo(() => {
    const defaultName = activeHospital?.name || "Medical Center"
    const defaultSubtitle = activeHospital?.code
      ? `Hospital Code: ${activeHospital.code}`
      : "Multi-Specialty Healthcare Services"

    return {
      headerTitle: customPrintSettings?.headerTitle || defaultName,
      headerSubtitle: customPrintSettings?.headerSubtitle || defaultSubtitle,
      logoUrl: customPrintSettings?.logoUrl || undefined,
      phone: customPrintSettings?.phone || activeHospital?.phone || "Contact Reception",
      email: customPrintSettings?.email || activeHospital?.email || "info@hospital.com",
      address: customPrintSettings?.address || activeHospital?.address || "Hospital Address",
      footerText:
        customPrintSettings?.footerText ||
        `Computer generated document. Issued by ${defaultName}. All rights reserved.`,
      paperSize: customPrintSettings?.paperSize || "A4",
      taxRegistrationNo: customPrintSettings?.taxRegistrationNo || undefined,
    }
  }, [activeHospital, customPrintSettings])

  const closePrint = useCallback(() => {
    setIsOpen(false)
    setDocumentData(null)
  }, [])

  const printAppointmentSlip = useCallback(
    (data: PrintAppointmentData) => {
      generateAppointmentSlipPDF(data, hospitalBranding)
    },
    [hospitalBranding]
  )

  const printBillingInvoice = useCallback(
    (data: PrintBillingData) => {
      generateBillingInvoicePDF(data, hospitalBranding)
    },
    [hospitalBranding]
  )

  const printPrescription = useCallback(
    (data: PrintPrescriptionData) => {
      generatePrescriptionPDFNew(data, hospitalBranding)
    },
    [hospitalBranding]
  )

  const printAdmissionForm = useCallback(
    (data: PrintAdmissionData) => {
      generateAdmissionFormPDF(data, hospitalBranding)
    },
    [hospitalBranding]
  )

  const printDischargeSummary = useCallback(
    (data: PrintDischargeData) => {
      generateDischargeSummaryPDF(data, hospitalBranding)
    },
    [hospitalBranding]
  )

  const printLabReport = useCallback(
    (data: PrintLabReportData) => {
      generateLabReportPDF(data, hospitalBranding)
    },
    [hospitalBranding]
  )

  const printCustomDocument = useCallback(
    (doc: PrintDocumentData) => {
      switch (doc.type) {
        case "appointment-slip":
          printAppointmentSlip(doc.data)
          break
        case "billing-invoice":
          printBillingInvoice(doc.data)
          break
        case "prescription":
          printPrescription(doc.data)
          break
        case "admission-form":
          printAdmissionForm(doc.data)
          break
        case "discharge-summary":
          printDischargeSummary(doc.data)
          break
        case "lab-report":
          printLabReport(doc.data)
          break
      }
    },
    [
      printAppointmentSlip,
      printBillingInvoice,
      printPrescription,
      printAdmissionForm,
      printDischargeSummary,
      printLabReport,
    ]
  )

  return (
    <PrintContext.Provider
      value={{
        isOpen,
        documentData,
        paperSize,
        printAppointmentSlip,
        printBillingInvoice,
        printPrescription,
        printAdmissionForm,
        printDischargeSummary,
        printLabReport,
        printCustomDocument,
        closePrint,
      }}
    >
      {children}
    </PrintContext.Provider>
  )
}

export function usePrint() {
  const context = useContext(PrintContext)
  if (!context) {
    throw new Error("usePrint must be used within a PrintProvider")
  }
  return context
}
