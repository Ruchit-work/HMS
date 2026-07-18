import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import {
  DEFAULT_HOSPITAL_BILLING_SETTINGS,
  normalizeHospitalBillingSettings,
  type HospitalBillingSettings,
} from "@/shared/utils/billingSettings"

/**
 * Resolve one hospital's billing policy. Missing settings use legacy-compatible
 * defaults, so existing hospitals remain operational before explicit migration.
 */
export async function getHospitalBillingSettings(
  hospitalId: string | null | undefined
): Promise<HospitalBillingSettings> {
  if (!hospitalId) return DEFAULT_HOSPITAL_BILLING_SETTINGS

  const initResult = initFirebaseAdmin("hospital billing settings resolver")
  if (!initResult.ok) return DEFAULT_HOSPITAL_BILLING_SETTINGS

  const hospital = await admin.firestore().collection("hospitals").doc(hospitalId).get()
  if (!hospital.exists) return DEFAULT_HOSPITAL_BILLING_SETTINGS

  return normalizeHospitalBillingSettings(hospital.data()?.settings?.billing)
}
