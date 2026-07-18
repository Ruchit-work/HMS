/**
 * Server PharmacyService — re-export existing pharmacy path/auth helpers.
 */

export {
  PHARMACY_COLLECTIONS,
  getPharmacyCollectionPath,
  getPharmacyAuthContext,
} from "@/shared/utils/pharmacy/serverPharmacy"
export type { PharmacyAuthContext } from "@/shared/utils/pharmacy/serverPharmacy"

import {
  PHARMACY_COLLECTIONS,
  getPharmacyCollectionPath,
  getPharmacyAuthContext,
} from "@/shared/utils/pharmacy/serverPharmacy"

export const PharmacyServerService = {
  PHARMACY_COLLECTIONS,
  getPharmacyCollectionPath,
  getPharmacyAuthContext,
}

export default PharmacyServerService
