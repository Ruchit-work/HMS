/**
 * Server PharmacyService — re-export existing pharmacy path/auth helpers.
 */

export {
  PHARMACY_COLLECTIONS,
  getPharmacyCollectionPath,
  getPharmacyAuthContext,
} from "@/utils/pharmacy/serverPharmacy"
export type { PharmacyAuthContext } from "@/utils/pharmacy/serverPharmacy"

import {
  PHARMACY_COLLECTIONS,
  getPharmacyCollectionPath,
  getPharmacyAuthContext,
} from "@/utils/pharmacy/serverPharmacy"

export const PharmacyServerService = {
  PHARMACY_COLLECTIONS,
  getPharmacyCollectionPath,
  getPharmacyAuthContext,
}

export default PharmacyServerService
