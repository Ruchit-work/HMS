"use client"

import { Appointment } from "@/types/patient"
import { ViewModal } from "@/shared/components"
import { formatDate, formatDateTime } from "@/shared/utils/shared/date"
import DocumentListCompact from "@/features/documents/DocumentListCompact"
import PrescriptionDisplay from "@/features/prescription/PrescriptionDisplay"
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import type { PatientVisitHistoryItem } from "@/features/receptionist/utils/visitHistoryDisplay"
import {
  displayValue,
  formatBillingAmount,
  formatVisitDateTime,
  getAppointmentType,
  getPaymentStatusClasses,
  getPaymentStatusLabel,
  getPrimaryDiagnosis,
  getVisitStatusLabel,
  getVisitType,
  hasText,
  normalizeVisitStatus,
  resolveBillingAmount,
} from "@/features/receptionist/utils/visitHistoryDisplay"

interface PatientVisitDetailModalProps {
  visit: PatientVisitHistoryItem | null
  isOpen: boolean
  onClose: () => void
}

function DetailSection({
  title,
  children,
  accent,
}: {
  title: string
  children: React.ReactNode
  accent?: "cyan" | "default"
}) {
  const titleClass =
    accent === "cyan"
      ? "text-cyan-700"
      : "text-slate-500"

  return (
    <div
      className={`rounded-xl border p-4 ${
        accent === "cyan"
          ? "border-cyan-200 bg-cyan-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className={`mb-3 text-xs font-semibold uppercase tracking-wider ${titleClass}`}>
        {title}
      </p>
      {children}
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
  multiline,
}: {
  label: string
  value: string
  mono?: boolean
  multiline?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {multiline ? (
        <p
          className={`rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words ${
            mono ? "font-mono text-[11px]" : ""
          }`}
        >
          {value}
        </p>
      ) : (
        <p
          className={`text-sm text-slate-800 break-words ${mono ? "font-mono text-[11px]" : ""}`}
        >
          {value}
        </p>
      )}
    </div>
  )
}

function DetailGrid({
  fields,
}: {
  fields: Array<{ label: string; value: unknown; mono?: boolean; multiline?: boolean }>
}) {
  const visibleFields = fields.filter(({ value }) => hasText(value))
  if (visibleFields.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {visibleFields.map(({ label, value, mono, multiline }) => (
        <DetailField
          key={label}
          label={label}
          value={displayValue(value)}
          mono={mono}
          multiline={multiline}
        />
      ))}
    </div>
  )
}

export default function PatientVisitDetailModal({
  visit,
  isOpen,
  onClose,
}: PatientVisitDetailModalProps) {
  if (!visit) return null

  const record = visit as Record<string, unknown>
  const appointment = visit as unknown as Appointment
  const visitStatusLabel = getVisitStatusLabel(visit.status)
  const paymentStatusLabel = getPaymentStatusLabel(visit.paymentStatus)
  const billingAmount = visit.billingAmount ?? resolveBillingAmount(record)
  const department =
    visit.department || visit.doctorSpecialization || displayValue(record.department)
  const dateTimeLabel = formatVisitDateTime(visit.appointmentDate, visit.appointmentTime)

  const diagnosisHistory = Array.isArray(record.diagnosisHistory)
    ? (record.diagnosisHistory as Array<Record<string, unknown>>)
    : []

  const billingRecord =
    record.billingRecord && typeof record.billingRecord === "object"
      ? (record.billingRecord as Record<string, unknown>)
      : null

  const otherServices = Array.isArray(billingRecord?.otherServices)
    ? (billingRecord.otherServices as Array<{ description?: string; amount?: number }>)
    : []

  const chargeLineItems = Array.isArray(billingRecord?.chargeLineItems)
    ? (billingRecord.chargeLineItems as Array<Record<string, unknown>>)
    : []

  const hasCancellationInfo = [
    record.cancelledAt,
    record.cancelledBy,
    record.notAttendedAt,
    record.markedNotAttendedBy,
    record.cancellationPolicy,
    record.hoursBeforeCancellation,
    record.refundStatus,
    record.refundAmount,
    record.cancellationFee,
    record.refundTransactionId,
    record.refundProcessedAt,
  ].some(hasText)

  const hasPatientSnapshot = [
    record.patientName,
    record.patientEmail,
    record.patientPhone,
    record.patientGender,
    record.patientBloodGroup,
    record.patientDateOfBirth,
    record.patientAllergies,
    record.patientCurrentMedications,
    record.patientOccupation,
    record.patientFamilyHistory,
    record.patientPregnancyStatus,
    record.patientHeightCm,
    record.patientWeightKg,
    record.patientDrinkingHabits,
    record.patientSmokingHabits,
    record.patientVegetarian,
  ].some(hasText)

  const hasSymptoms = [
    record.associatedSymptoms,
    record.symptomOnset,
    record.symptomDuration,
    record.symptomSeverity,
    record.symptomProgression,
    record.symptomTriggers,
    record.patientAdditionalConcern,
  ].some(hasText)

  const hasVitals = [
    record.vitalTemperatureC,
    record.vitalBloodPressure,
    record.vitalHeartRate,
    record.vitalRespiratoryRate,
    record.vitalSpO2,
  ].some(hasText)

  return (
    <ViewModal
      isOpen={isOpen}
      onClose={onClose}
      title="Visit Details"
      subtitle="Complete visit record"
      headerColor="blue"
      zIndex={60}
      size="2xl"
    >
      <div className="space-y-5 max-h-[calc(95vh-8rem)] overflow-y-auto pr-1">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {dateTimeLabel}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              {visit.doctorName || "Doctor TBD"}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">{department}</p>
            <p className="mt-2 text-xs font-mono text-slate-400">Visit ID: {visit.id}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <ClinicalStatusBadge
              status={normalizeVisitStatus(visit.status)}
              label={visitStatusLabel}
              size="sm"
            />
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusClasses(
                paymentStatusLabel
              )}`}
            >
              {paymentStatusLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
            {getVisitType(record)}
          </span>
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
            {getAppointmentType(record)}
          </span>
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
            {formatBillingAmount(billingAmount)}
          </span>
          {hasText(record.branchName) || hasText(record.branchId) ? (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
              {displayValue(record.branchName || record.branchId)}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DetailSection title="Visit Information">
            <DetailGrid
              fields={[
                { label: "Date", value: visit.appointmentDate ? formatDate(visit.appointmentDate) : null },
                { label: "Time", value: visit.appointmentTime },
                { label: "Visit Status", value: visitStatusLabel },
                { label: "Department", value: department },
                { label: "Visit Type", value: getVisitType(record) },
                { label: "Appointment Type", value: getAppointmentType(record) },
                { label: "Branch", value: record.branchName || record.branchId },
              ]}
            />
          </DetailSection>

          <DetailSection title="Doctor & Provider">
            <DetailGrid
              fields={[
                { label: "Doctor", value: visit.doctorName },
                { label: "Doctor ID", value: record.doctorId, mono: true },
                { label: "Specialization", value: visit.doctorSpecialization },
                { label: "Department", value: department },
              ]}
            />
          </DetailSection>
        </div>

        {hasPatientSnapshot ? (
          <DetailSection title="Patient Snapshot">
            <DetailGrid
              fields={[
                { label: "Name", value: record.patientName },
                { label: "Email", value: record.patientEmail },
                { label: "Phone", value: record.patientPhone },
                { label: "Gender", value: record.patientGender },
                { label: "Blood Group", value: record.patientBloodGroup },
                {
                  label: "Date of Birth",
                  value: record.patientDateOfBirth
                    ? formatDate(String(record.patientDateOfBirth))
                    : null,
                },
                { label: "Allergies", value: record.patientAllergies, multiline: true },
                {
                  label: "Current Medications",
                  value: record.patientCurrentMedications,
                  multiline: true,
                },
                { label: "Occupation", value: record.patientOccupation },
                { label: "Family History", value: record.patientFamilyHistory, multiline: true },
                { label: "Pregnancy Status", value: record.patientPregnancyStatus },
                { label: "Height (cm)", value: record.patientHeightCm },
                { label: "Weight (kg)", value: record.patientWeightKg },
                { label: "Drinking Habits", value: record.patientDrinkingHabits },
                { label: "Smoking Habits", value: record.patientSmokingHabits },
                { label: "Vegetarian", value: record.patientVegetarian },
              ]}
            />
          </DetailSection>
        ) : null}

        <DetailSection title="Clinical Information">
          <div className="space-y-3">
            <DetailField
              label="Chief Complaint"
              value={displayValue(visit.chiefComplaint)}
              multiline
            />
            <DetailField
              label="Medical History"
              value={displayValue(visit.medicalHistory)}
              multiline
            />
            {hasSymptoms ? (
              <DetailGrid
                fields={[
                  { label: "Associated Symptoms", value: record.associatedSymptoms, multiline: true },
                  { label: "Symptom Onset", value: record.symptomOnset },
                  { label: "Symptom Duration", value: record.symptomDuration },
                  { label: "Symptom Severity", value: record.symptomSeverity },
                  { label: "Symptom Progression", value: record.symptomProgression },
                  { label: "Symptom Triggers", value: record.symptomTriggers, multiline: true },
                  {
                    label: "Additional Concerns",
                    value: record.patientAdditionalConcern,
                    multiline: true,
                  },
                ]}
              />
            ) : null}
            {hasText(visit.doctorNotes) ? (
              <DetailField
                label="Doctor Notes"
                value={displayValue(visit.doctorNotes)}
                multiline
              />
            ) : null}
          </div>
        </DetailSection>

        {hasVitals ? (
          <DetailSection title="Vitals">
            <DetailGrid
              fields={[
                {
                  label: "Temperature (°C)",
                  value: record.vitalTemperatureC,
                },
                { label: "Blood Pressure", value: record.vitalBloodPressure },
                { label: "Heart Rate", value: record.vitalHeartRate },
                { label: "Respiratory Rate", value: record.vitalRespiratoryRate },
                { label: "SpO₂ (%)", value: record.vitalSpO2 },
              ]}
            />
          </DetailSection>
        ) : null}

        <DetailSection title="Diagnosis" accent="cyan">
          <div className="space-y-3">
            <DetailField label="Primary Diagnosis" value={getPrimaryDiagnosis(visit)} multiline />
            {Array.isArray(visit.finalDiagnosis) && visit.finalDiagnosis.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Final Diagnosis
                </p>
                <div className="flex flex-wrap gap-2">
                  {visit.finalDiagnosis.map((diagnosis) => (
                    <span
                      key={diagnosis}
                      className="inline-flex items-center rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-800"
                    >
                      {diagnosis}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {hasText(visit.customDiagnosis) ? (
              <DetailField
                label="Custom Diagnosis"
                value={displayValue(visit.customDiagnosis)}
                multiline
              />
            ) : null}
            {diagnosisHistory.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Diagnosis History
                </p>
                <div className="space-y-2">
                  {diagnosisHistory.map((entry, index) => (
                    <div
                      key={`${entry.updatedAt}-${index}`}
                      className="rounded-lg border border-cyan-100 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <p className="font-medium text-slate-800">
                        {Array.isArray(entry.diagnoses)
                          ? entry.diagnoses.join(", ")
                          : displayValue(entry.diagnoses)}
                      </p>
                      {hasText(entry.customDiagnosis) ? (
                        <p className="mt-1 text-slate-600">{displayValue(entry.customDiagnosis)}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {displayValue(entry.updatedByRole)} ·{" "}
                        {entry.updatedAt ? formatDateTime(String(entry.updatedAt)) : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DetailSection>

        {hasText(visit.medicine) ? (
          <PrescriptionDisplay appointment={appointment} variant="modal" showPdfButton />
        ) : null}

        <DetailSection title="Billing & Payment">
          <DetailGrid
            fields={[
              { label: "Payment Status", value: paymentStatusLabel },
              { label: "Payment Method", value: record.paymentMethod },
              { label: "Payment Type", value: record.paymentType },
              { label: "Consultation Fee", value: formatBillingAmount(Number(record.consultationFee || 0)) },
              {
                label: "Total Consultation Fee",
                value: formatBillingAmount(Number(record.totalConsultationFee || 0)),
              },
              { label: "Amount Paid", value: formatBillingAmount(Number(record.paymentAmount || 0)) },
              {
                label: "Remaining Amount",
                value: formatBillingAmount(Number(record.remainingAmount || 0)),
              },
              { label: "Transaction ID", value: record.transactionId, mono: true },
              {
                label: "Paid At",
                value: record.paidAt ? formatDateTime(String(record.paidAt)) : null,
              },
            ]}
          />
        </DetailSection>

        {billingRecord ? (
          <DetailSection title="Billing Record">
            <DetailGrid
              fields={[
                { label: "Billing ID", value: billingRecord.id, mono: true },
                { label: "Type", value: billingRecord.type },
                { label: "Status", value: billingRecord.status },
                { label: "Total Amount", value: formatBillingAmount(Number(billingRecord.totalAmount || 0)) },
                { label: "Gross Total", value: formatBillingAmount(Number(billingRecord.grossTotal || 0)) },
                { label: "Net Payable", value: formatBillingAmount(Number(billingRecord.netPayable || 0)) },
                { label: "Consultation Fee", value: formatBillingAmount(Number(billingRecord.consultationFee || 0)) },
                { label: "Payment Method", value: billingRecord.paymentMethod },
                { label: "Payment Reference", value: billingRecord.paymentReference, mono: true },
                { label: "Transaction ID", value: billingRecord.transactionId, mono: true },
                {
                  label: "Generated At",
                  value: billingRecord.generatedAt
                    ? formatDateTime(String(billingRecord.generatedAt))
                    : null,
                },
                {
                  label: "Paid At",
                  value: billingRecord.paidAt ? formatDateTime(String(billingRecord.paidAt)) : null,
                },
                { label: "Handled By", value: billingRecord.handledBy },
                { label: "Settlement Mode", value: billingRecord.settlementMode },
              ]}
            />
            {otherServices.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Other Services
                </p>
                <div className="space-y-2">
                  {otherServices.map((service, index) => (
                    <div
                      key={`${service.description}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-700">{service.description || "Service"}</span>
                      <span className="font-medium text-slate-900">
                        {formatBillingAmount(Number(service.amount || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {chargeLineItems.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Charge Line Items
                </p>
                <div className="space-y-2">
                  {chargeLineItems.map((item, index) => (
                    <div
                      key={String(item.id || index)}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{displayValue(item.name)}</span>
                        <span className="text-slate-900">
                          {formatBillingAmount(Number(item.amount || 0))}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {displayValue(item.category)} · {displayValue(item.addedByRole)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DetailSection>
        ) : null}

        {hasCancellationInfo ? (
          <DetailSection title="Cancellation & Refund">
            <DetailGrid
              fields={[
                {
                  label: "Cancelled At",
                  value: record.cancelledAt ? formatDateTime(String(record.cancelledAt)) : null,
                },
                { label: "Cancelled By", value: record.cancelledBy },
                {
                  label: "Not Attended At",
                  value: record.notAttendedAt ? formatDateTime(String(record.notAttendedAt)) : null,
                },
                { label: "Marked Not Attended By", value: record.markedNotAttendedBy },
                { label: "Cancellation Policy", value: record.cancellationPolicy, multiline: true },
                { label: "Hours Before Cancellation", value: record.hoursBeforeCancellation },
                { label: "Refund Status", value: record.refundStatus },
                {
                  label: "Refund Amount",
                  value: formatBillingAmount(Number(record.refundAmount || 0)),
                },
                {
                  label: "Cancellation Fee",
                  value: formatBillingAmount(Number(record.cancellationFee || 0)),
                },
                { label: "Refund Transaction ID", value: record.refundTransactionId, mono: true },
                {
                  label: "Refund Processed At",
                  value: record.refundProcessedAt
                    ? formatDateTime(String(record.refundProcessedAt))
                    : null,
                },
              ]}
            />
          </DetailSection>
        ) : null}

        {[record.admissionId, record.admissionRequestId].some(hasText) ? (
          <DetailSection title="Linked Records">
            <DetailGrid
              fields={[
                { label: "Admission ID", value: record.admissionId, mono: true },
                { label: "Admission Request ID", value: record.admissionRequestId, mono: true },
              ]}
            />
          </DetailSection>
        ) : null}

        {record.whatsappPending && hasText(record.whatsappNotes) ? (
          <DetailSection title="WhatsApp Notes" accent="cyan">
            <DetailField
              label="Notes"
              value={displayValue(record.whatsappNotes)}
              multiline
            />
          </DetailSection>
        ) : null}

        <DetailSection title="Documents">
          <DocumentListCompact
            patientId={String(record.patientId || "")}
            patientUid={String(record.patientUid || record.patientId || "")}
            appointmentId={visit.id}
            title="Visit Documents"
            maxItems={10}
          />
        </DetailSection>

        <details className="group">
          <summary className="flex cursor-pointer list-none select-none items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600">
            <svg
              className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            System Information
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Visit ID", value: visit.id, mono: true },
              { label: "Patient ID", value: record.patientId, mono: true },
              { label: "Patient UID", value: record.patientUid, mono: true },
              { label: "Doctor ID", value: record.doctorId, mono: true },
              { label: "Branch ID", value: record.branchId, mono: true },
              { label: "Created By", value: record.createdBy },
              {
                label: "Created At",
                value: record.createdAt ? formatDateTime(String(record.createdAt)) : null,
              },
              {
                label: "Last Updated",
                value: record.updatedAt ? formatDateTime(String(record.updatedAt)) : null,
              },
            ]
              .filter(({ value }) => hasText(value))
              .map(({ label, value, mono }) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className={`truncate text-slate-700 ${mono ? "font-mono text-[11px]" : ""}`}>
                    {displayValue(value)}
                  </p>
                </div>
              ))}
          </div>
        </details>
      </div>
    </ViewModal>
  )
}
