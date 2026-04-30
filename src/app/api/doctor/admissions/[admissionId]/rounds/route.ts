import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

interface Params {
  admissionId: string
}

export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return Response.json({ error: "Access denied. This endpoint requires doctor role." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("doctor-mark-round API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })

    const { admissionId } = await context.params
    if (!admissionId) return Response.json({ error: "Missing admissionId" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const notes = typeof body?.notes === "string" ? body.notes.trim() : ""
    const prescriptionNote = typeof body?.prescriptionNote === "string" ? body.prescriptionNote.trim() : ""
    const medicineName = typeof body?.medicineName === "string" ? body.medicineName.trim() : ""
    const injectionName = typeof body?.injectionName === "string" ? body.injectionName.trim() : ""
    const additionalNote = typeof body?.additionalNote === "string" ? body.additionalNote.trim() : ""
    const fee = Number(body?.fee || 0)
    const medicineCharge = Number(body?.medicineCharge || 0)
    const injectionCharge = Number(body?.injectionCharge || 0)
    const bottleCharge = Number(body?.bottleCharge || 0)
    const drugCharge = Number(body?.drugCharge || 0)
    const otherCharge = Number(body?.otherCharge || 0)
    if (!Number.isFinite(fee) || fee < 0) {
      return Response.json({ error: "Round fee must be a valid positive number" }, { status: 400 })
    }
    for (const value of [medicineCharge, injectionCharge, bottleCharge, drugCharge, otherCharge]) {
      if (!Number.isFinite(value) || value < 0) {
        return Response.json({ error: "Charge values must be valid positive numbers" }, { status: 400 })
      }
    }
    const medicineEntries = Array.isArray(body?.medicineEntries)
      ? body.medicineEntries
          .map((entry: any) => {
            const category =
              entry?.category === "injection" || entry?.category === "bottle" || entry?.category === "other"
                ? entry.category
                : "medicine"
            const source =
              entry?.source === "outside"
                ? "outside"
                : entry?.source === "pharmacy_billed"
                  ? "pharmacy_billed"
                  : "hospital"
            const qty = Math.max(1, Number(entry?.qty || 1))
            const unitPrice = Math.max(0, Number(entry?.unitPrice || 0))
            const totalPrice = Math.max(0, Number(entry?.totalPrice || qty * unitPrice))
            const name = String(entry?.name || "").trim()
            if (!name) return null
            return {
              medicineId: entry?.medicineId ? String(entry.medicineId) : null,
              name,
              category,
              qty,
              unitPrice,
              totalPrice,
              source,
            }
          })
          .filter(Boolean)
      : []

    const firestore = admin.firestore()
    const admissionRef = firestore.collection("admissions").doc(admissionId)
    const nowIso = new Date().toISOString()

    const result = await firestore.runTransaction(async (tx) => {
      const admissionSnap = await tx.get(admissionRef)
      if (!admissionSnap.exists) throw new Error("Admission not found")
      const admission = admissionSnap.data() || {}
      if (admission.status !== "admitted") throw new Error("Rounds can only be marked for admitted patients")
      if (String(admission.doctorId || "") !== auth.user!.uid) {
        throw new Error("You can mark rounds only for your admitted patients")
      }

      const existingRounds = Array.isArray(admission.doctorRounds) ? admission.doctorRounds : []
      const roundEntry = {
        roundAt: nowIso,
        doctorId: auth.user!.uid,
        doctorName: admission.doctorName || null,
        notes: notes || null,
        fee,
        markedBy: "doctor",
        prescriptionNote: prescriptionNote || null,
        medicineName: medicineName || null,
        injectionName: injectionName || null,
        additionalNote: additionalNote || null,
        medicineCharge,
        injectionCharge,
        bottleCharge,
        otherCharge: otherCharge + drugCharge,
        medicineEntries,
      }
      const doctorRounds = [...existingRounds, roundEntry]
      const totalDoctorRoundFee = doctorRounds.reduce((sum, round) => sum + Number(round?.fee || 0), 0)
      const hospitalMedicineEntries = medicineEntries.filter((entry: any) => entry.source === "hospital")
      const hospitalMedicineTotal = hospitalMedicineEntries
        .filter((entry: any) => entry.category === "medicine")
        .reduce((sum: number, entry: any) => sum + Number(entry.totalPrice || 0), 0)
      const hospitalInjectionTotal = hospitalMedicineEntries
        .filter((entry: any) => entry.category === "injection")
        .reduce((sum: number, entry: any) => sum + Number(entry.totalPrice || 0), 0)
      const hospitalBottleTotal = hospitalMedicineEntries
        .filter((entry: any) => entry.category === "bottle")
        .reduce((sum: number, entry: any) => sum + Number(entry.totalPrice || 0), 0)
      const hospitalOtherTotal = hospitalMedicineEntries
        .filter((entry: any) => entry.category === "other")
        .reduce((sum: number, entry: any) => sum + Number(entry.totalPrice || 0), 0)
      const currentCharges = admission.charges && typeof admission.charges === "object" ? admission.charges : {}
      const nextCharges = {
        ...currentCharges,
        doctorRoundFee: totalDoctorRoundFee,
        medicineCharges: Number(currentCharges.medicineCharges || 0) + medicineCharge + hospitalMedicineTotal,
        injectionCharges: Number(currentCharges.injectionCharges || 0) + injectionCharge + hospitalInjectionTotal,
        bottleCharges: Number(currentCharges.bottleCharges || 0) + bottleCharge + hospitalBottleTotal,
        otherCharges: Number(currentCharges.otherCharges || 0) + otherCharge + drugCharge + hospitalOtherTotal,
      }
      const existingUpdates = Array.isArray(admission.clinicalUpdates) ? admission.clinicalUpdates : []
      const clinicalUpdates = [
        ...existingUpdates,
        {
          updatedAt: nowIso,
          doctorId: auth.user!.uid,
          doctorName: admission.doctorName || null,
          roundNote: notes || null,
          prescriptionNote: prescriptionNote || null,
          medicineName: medicineName || null,
          injectionName: injectionName || null,
          additionalNote: additionalNote || null,
        },
      ]
      const existingLineItems = Array.isArray(admission.chargeLineItems) ? admission.chargeLineItems : []
      const nextLineItems = [...existingLineItems]
      if (medicineCharge > 0) {
        nextLineItems.push({
          id: `${admissionId}-med-${Date.now()}`,
          addedAt: nowIso,
          addedByRole: "doctor",
          category: "medicine",
          name: medicineName || "Medicine",
          amount: medicineCharge,
        })
      }
      if (injectionCharge > 0) {
        nextLineItems.push({
          id: `${admissionId}-inj-${Date.now()}`,
          addedAt: nowIso,
          addedByRole: "doctor",
          category: "injection",
          name: injectionName || "Injection",
          amount: injectionCharge,
        })
      }
      if (bottleCharge > 0) {
        nextLineItems.push({
          id: `${admissionId}-bot-${Date.now()}`,
          addedAt: nowIso,
          addedByRole: "doctor",
          category: "bottle",
          name: "Bottle",
          amount: bottleCharge,
        })
      }
      if (otherCharge > 0) {
        nextLineItems.push({
          id: `${admissionId}-oth-${Date.now()}`,
          addedAt: nowIso,
          addedByRole: "doctor",
          category: "other",
          name: additionalNote || "Other",
          amount: otherCharge,
        })
      }
      if (drugCharge > 0) {
        nextLineItems.push({
          id: `${admissionId}-drug-${Date.now()}`,
          addedAt: nowIso,
          addedByRole: "doctor",
          category: "other",
          name: "Drug",
          amount: drugCharge,
        })
      }
      hospitalMedicineEntries.forEach((entry: any) => {
        nextLineItems.push({
          id: `${admissionId}-${entry.category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          addedAt: nowIso,
          addedByRole: "doctor",
          category: entry.category,
          name: `${entry.name} x${entry.qty}`,
          amount: Number(entry.totalPrice || 0),
        })
      })

      tx.update(admissionRef, {
        doctorRounds,
        clinicalUpdates,
        chargeLineItems: nextLineItems,
        charges: nextCharges,
        updatedAt: nowIso,
      })

      return {
        roundCount: doctorRounds.length,
        totalDoctorRoundFee,
        lastRoundAt: nowIso,
      }
    })

    return Response.json({ success: true, ...result })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to mark round" }, { status: 500 })
  }
}

