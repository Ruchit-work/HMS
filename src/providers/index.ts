/**
 * App-wide React providers.
 * Prefer importing from `@/providers` or `@/providers/<Name>Provider`.
 */
export {
  MultiHospitalProvider,
  useMultiHospital,
} from "./MultiHospitalProvider"
export {
  PharmacyPortalProvider,
  usePharmacyPortal,
} from "./PharmacyPortalProvider"
export type { PharmacyPortalTabId } from "./PharmacyPortalProvider"
