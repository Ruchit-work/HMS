import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import {
  getHospitalCollectionPath,
  getReceptionistDefaultBranch,
  getUserActiveHospitalId,
} from "@/utils/firebase/serverHospitalQueries"

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const IPD_START_NUMBER = 1000

function resolveDateOfBirthForRegistration(explicitDob: string, ageYears: number): string {
  const dob = explicitDob.trim()
  if (DOB_PATTERN.test(dob)) return dob
  const age = Math.floor(Number(ageYears))
  if (age > 0 && age <= 120) {
    const y = new Date().getFullYear() - age
    return `${y}-01-01`
  }
  return ""
}

export async function GET(req: Request) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-admissions API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const includeAppointmentDetails = searchParams.get("includeAppointmentDetails") !== "false"

    const firestore = admin.firestore()
    const baseRef = firestore.collection("admissions")

    const fetchDocs = async () => {
      if (status) {
        const filteredSnap = await baseRef.where("status", "==", status).get()
        return filteredSnap.docs
      }
      const orderedSnap = await baseRef.orderBy("checkInAt", "desc").get()
      return orderedSnap.docs
    }

    const docs = await fetchDocs()
    const sortedDocs = status
      ? [...docs].sort((a, b) => {
          const aDate = new Date(String(a.get("checkInAt") || "")).getTime()
          const bDate = new Date(String(b.get("checkInAt") || "")).getTime()
          return bDate - aDate
        })
      : docs

    const admissions = includeAppointmentDetails
      ? await Promise.all(
          sortedDocs.map(async (docSnap) => {
            const data = docSnap.data() || {}
            const admissionId = docSnap.id
            let appointmentDetails: Record<string, unknown> | null = null
            const appointmentId = String(data.appointmentId || "")
            if (appointmentId) {
              try {
                const aptSnap = await firestore.collection("appointments").doc(appointmentId).get()
                if (aptSnap.exists) {
                  const aptData = aptSnap.data() || {}
                  appointmentDetails = {
                    appointmentDate: aptData.appointmentDate || null,
                    appointmentTime: aptData.appointmentTime || null,
                    patientPhone: aptData.patientPhone || null,
                    doctorSpecialization: aptData.doctorSpecialization || null
                  }
                }
              } catch {

              }
            }

            return {
              id: admissionId,
              ...data,
              appointmentDetails
            }
          })
        )
      : sortedDocs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          appointmentDetails: null,
        }))

    return Response.json({ admissions })
  } catch (error: any) {

    return Response.json(
      { error: error?.message || "Failed to load admissions" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-create-admission API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : ""
    const doctorId = typeof body?.doctorId === "string" ? body.doctorId.trim() : ""
    const doctorName = typeof body?.doctorName === "string" ? body.doctorName.trim() : ""
    const patientUid = typeof body?.patientUid === "string" ? body.patientUid.trim() : ""
    const patientId = typeof body?.patientId === "string" ? body.patientId.trim() : ""
    const patientName = typeof body?.patientName === "string" ? body.patientName.trim() : ""
    const patientAddress = typeof body?.patientAddress === "string" ? body.patientAddress.trim() : ""
    const patientPhone = typeof body?.patientPhone === "string" ? body.patientPhone.trim() : ""
    const patientGender = typeof body?.patientGender === "string" ? body.patientGender.trim() : ""
    const patientDateOfBirth =
      typeof body?.patientDateOfBirth === "string" ? body.patientDateOfBirth.trim() : ""
    const patientAgeYearsRaw = Number(body?.patientAgeYears)
    const patientAgeYears = Number.isFinite(patientAgeYearsRaw)
      ? Math.max(0, Math.min(120, Math.floor(patientAgeYearsRaw)))
      : 0
    const emergencyContactName =
      typeof body?.emergencyContactName === "string" ? body.emergencyContactName.trim() : ""
    const notes = typeof body?.notes === "string" ? body.notes.trim() : ""
    const admitType = body?.admitType === "planned" ? "planned" : "emergency"
    const plannedAdmitAt = typeof body?.plannedAdmitAt === "string" ? body.plannedAdmitAt : null
    const expectedDischargeAt = typeof body?.expectedDischargeAt === "string" ? body.expectedDischargeAt : null
    const initialDeposit = Math.max(0, Number(body?.initialDeposit || 0))
    const initialDepositPaymentMode =
      body?.initialDepositPaymentMode === "upi" ||
      body?.initialDepositPaymentMode === "card" ||
      body?.initialDepositPaymentMode === "cash" ||
      body?.initialDepositPaymentMode === "other"
        ? body.initialDepositPaymentMode
        : "cash"
    const operationPackage =
      body?.operationPackage && typeof body.operationPackage === "object"
        ? {
            packageId: String(body.operationPackage.packageId || ""),
            packageName: String(body.operationPackage.packageName || ""),
            fixedRate: Number(body.operationPackage.fixedRate || 0),
            paymentTiming:
              body.operationPackage.paymentTiming === "advance" ? "advance" : "after_operation",
            advancePaidAmount: Number(body.operationPackage.advancePaidAmount || 0),
            notes:
              typeof body.operationPackage.notes === "string" && body.operationPackage.notes.trim()
                ? body.operationPackage.notes.trim()
                : null,
          }
        : null

    if (!roomId) {
      return Response.json({ error: "Missing roomId" }, { status: 400 })
    }
    if (!patientUid && !patientId && !patientName) {
      return Response.json({ error: "Patient details are required" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const roomRef = firestore.collection("rooms").doc(roomId)
    const roomSnap = await roomRef.get()
    if (!roomSnap.exists) {
      return Response.json({ error: "Room not found" }, { status: 404 })
    }
    const roomData = roomSnap.data() || {}
    if (roomData.status && roomData.status !== "available") {
      return Response.json({ error: "Room is not available" }, { status: 400 })
    }

    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) {
      return Response.json({ error: "No active hospital found for current user" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const isPlanned = admitType === "planned"
    const admissionRef = firestore.collection("admissions").doc()
    let resolvedPatientUid = patientUid
    let resolvedPatientId = patientId
    let resolvedPatientName = patientName

    const resolvedDob = resolveDateOfBirthForRegistration(patientDateOfBirth, patientAgeYears)

    const { branchId: defaultBranchId, branchName: defaultBranchName } = await getReceptionistDefaultBranch(
      auth.user!.uid,
      auth.user?.role
    )

    // For direct admits with no existing UID, auto-register patient and generate patient ID.
    if (!resolvedPatientUid) {
      const START_NUMBER = 12906
      const generatedPatientId =
        resolvedPatientId ||
        (await firestore.runTransaction(async (tx) => {
          const counterRef = firestore.collection("meta").doc("patientIdCounter")
          const counterSnap = await tx.get(counterRef)
          let lastNumber = START_NUMBER - 1
          if (counterSnap.exists) {
            const data = counterSnap.data()
            const stored = typeof data?.lastNumber === "number" ? data.lastNumber : undefined
            if (stored && stored >= START_NUMBER - 1) {
              lastNumber = stored
            }
          }
          const nextNumber = lastNumber + 1
          tx.set(
            counterRef,
            {
              lastNumber: nextNumber,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          return nextNumber.toString().padStart(6, "0")
        }))

      const patientRef = firestore.collection("patients").doc()
      const nameParts = String(resolvedPatientName || "").trim().split(/\s+/).filter(Boolean)
      const firstName = nameParts[0] || "Patient"
      const lastName = nameParts.slice(1).join(" ") || ""
      const patientDoc: Record<string, unknown> = {
        status: "active",
        firstName,
        lastName,
        email: "",
        phone: patientPhone || "",
        gender: patientGender || "",
        bloodGroup: "",
        address: patientAddress || "",
        dateOfBirth: resolvedDob || "",
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: "receptionist",
        patientId: generatedPatientId,
        hospitalId,
        defaultBranchId,
        defaultBranchName,
      }
      if (emergencyContactName) {
        patientDoc.emergencyContactName = emergencyContactName
      }
      await patientRef.set(patientDoc, { merge: true })
      await firestore
        .collection(getHospitalCollectionPath(hospitalId, "patients"))
        .doc(patientRef.id)
        .set(patientDoc, { merge: true })

      resolvedPatientUid = patientRef.id
      resolvedPatientId = generatedPatientId
      resolvedPatientName = `${firstName}${lastName ? ` ${lastName}` : ""}`.trim()
    } else {
      const patientUpdates: Record<string, unknown> = { updatedAt: nowIso }
      if (patientPhone) patientUpdates.phone = patientPhone
      if (patientGender) patientUpdates.gender = patientGender
      if (resolvedDob) patientUpdates.dateOfBirth = resolvedDob
      if (emergencyContactName) patientUpdates.emergencyContactName = emergencyContactName
      if (patientAddress) patientUpdates.address = patientAddress

      const keys = Object.keys(patientUpdates).filter((k) => k !== "updatedAt")
      if (keys.length > 0) {
        const rootPatientRef = firestore.collection("patients").doc(resolvedPatientUid)
        const hospitalPatientRef = firestore
          .collection(getHospitalCollectionPath(hospitalId, "patients"))
          .doc(resolvedPatientUid)
        await rootPatientRef.set(patientUpdates, { merge: true })
        await hospitalPatientRef.set(patientUpdates, { merge: true })
      }
    }

    if (resolvedPatientUid) {
      const existingAdmissionSnap = await firestore
        .collection("admissions")
        .where("patientUid", "==", resolvedPatientUid)
        .where("status", "in", ["admitted", "scheduled"])
        .limit(1)
        .get()
      if (!existingAdmissionSnap.empty) {
        const activeStatus = String(existingAdmissionSnap.docs[0]?.data()?.status || "")
        return Response.json(
          {
            error:
              activeStatus === "scheduled"
                ? "Patient is already pre-registered for admission"
                : "Patient is already admitted",
          },
          { status: 409 }
        )
      }
    }

    const ipdNo = await firestore.runTransaction(async (tx) => {
      const counterRef = firestore.collection("meta").doc("ipdCounter")
      const counterSnap = await tx.get(counterRef)
      let lastNumber = IPD_START_NUMBER - 1
      if (counterSnap.exists) {
        const stored = Number(counterSnap.data()?.lastNumber || 0)
        if (Number.isFinite(stored) && stored >= IPD_START_NUMBER - 1) {
          lastNumber = stored
        }
      }
      const nextNumber = lastNumber + 1
      tx.set(
        counterRef,
        {
          lastNumber: nextNumber,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      return `IPD-${String(nextNumber).padStart(6, "0")}`
    })

    const initialDepositTransaction =
      initialDeposit > 0
        ? [
            {
              id: `${admissionRef.id}-dep-init`,
              type: "initial",
              amount: initialDeposit,
              note: "Initial deposit at admission",
              paymentMode: initialDepositPaymentMode,
              createdAt: nowIso,
              createdBy: auth.user?.uid || "receptionist",
            },
          ]
        : []
    const admissionPayload = {
      ipdNo,
      appointmentId: "",
      patientUid: resolvedPatientUid || resolvedPatientId || `direct-${admissionRef.id}`,
      patientId: resolvedPatientId || null,
      patientName: resolvedPatientName || null,
      patientAddress: patientAddress || null,
      patientPhone: patientPhone || null,
      patientGender: patientGender || null,
      emergencyContactName: emergencyContactName || null,
      doctorId: doctorId || "unassigned",
      doctorName: doctorName || "To be assigned",
      roomId,
      roomNumber: roomData.roomNumber || "",
      roomType: roomData.roomType || "general",
      roomRatePerDay: Number(roomData.ratePerDay || 0),
      roomStays: [
        {
          roomId,
          roomNumber: roomData.roomNumber || "",
          roomType: roomData.roomType || "general",
          customRoomTypeName: roomData.customRoomTypeName || null,
          ratePerDay: Number(roomData.ratePerDay || 0),
          fromAt: admitType === "planned" && plannedAdmitAt ? plannedAdmitAt : nowIso,
          toAt: null,
        },
      ],
      admitType,
      plannedAdmitAt: admitType === "planned" ? plannedAdmitAt || nowIso : null,
      expectedDischargeAt: expectedDischargeAt || null,
      operationPackage,
      charges: {
        doctorRoundFee: Number(body?.doctorRoundFee || 500),
        nurseRoundFee: Number(body?.nurseRoundFee || 0),
        medicineCharges: Number(body?.medicineCharges || 0),
        injectionCharges: Number(body?.injectionCharges || 0),
        bottleCharges: Number(body?.bottleCharges || 0),
        facilityCharges: Number(body?.facilityCharges || 0),
        otherCharges: Number(body?.otherCharges || 0),
        otherDescription:
          typeof body?.otherDescription === "string" && body.otherDescription.trim()
            ? body.otherDescription.trim()
            : null,
      },
      depositSummary: {
        totalDeposited: initialDeposit,
        totalAdjusted: 0,
        balance: initialDeposit,
      },
      depositTransactions: initialDepositTransaction,
      status: isPlanned ? "scheduled" : "admitted",
      checkInAt: isPlanned && plannedAdmitAt ? plannedAdmitAt : nowIso,
      checkOutAt: null,
      notes: notes || null,
      createdBy: "receptionist",
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    await firestore.runTransaction(async (tx) => {
      if (!isPlanned) {
        tx.update(roomRef, {
          status: "occupied",
          updatedAt: nowIso,
        })
      }
      tx.set(admissionRef, admissionPayload)
    })

    return Response.json({ success: true, admissionId: admissionRef.id })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to create admission" },
      { status: 500 }
    )
  }
}


