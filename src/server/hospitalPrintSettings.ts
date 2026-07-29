import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { DEFAULT_HOSPITAL_PRINT_SETTINGS, normalizeHospitalPrintSettings } from "@/shared/utils/printSettings"
import type { HospitalPrintSettings } from "@/types/print"

export async function getHospitalPrintSettings(hospitalId?: string | null): Promise<HospitalPrintSettings> {
  if (!hospitalId) return DEFAULT_HOSPITAL_PRINT_SETTINGS

  try {
    const initResult = initFirebaseAdmin("getHospitalPrintSettings")
    if (!initResult.ok) return DEFAULT_HOSPITAL_PRINT_SETTINGS

    const snap = await admin.firestore().collection("hospitals").doc(hospitalId).get()
    if (!snap.exists) return DEFAULT_HOSPITAL_PRINT_SETTINGS

    const data = snap.data()
    const rawPrint = data?.settings?.print
    const normalized = normalizeHospitalPrintSettings(rawPrint)

    // Fall back to hospital doc main details if print settings header/address/phone are default/empty
    if (data?.name && (!rawPrint?.headerTitle || rawPrint?.headerTitle === DEFAULT_HOSPITAL_PRINT_SETTINGS.headerTitle)) {
      normalized.headerTitle = data.name
    }
    if (data?.address && (!rawPrint?.address || rawPrint?.address === DEFAULT_HOSPITAL_PRINT_SETTINGS.address)) {
      normalized.address = data.address
    }
    if (data?.phone && (!rawPrint?.phone || rawPrint?.phone === DEFAULT_HOSPITAL_PRINT_SETTINGS.phone)) {
      normalized.phone = data.phone
    }
    if (data?.email && (!rawPrint?.email || rawPrint?.email === DEFAULT_HOSPITAL_PRINT_SETTINGS.email)) {
      normalized.email = data.email
    }

    return normalized
  } catch (err) {
    console.error("Error reading hospital print settings:", err)
    return DEFAULT_HOSPITAL_PRINT_SETTINGS
  }
}
