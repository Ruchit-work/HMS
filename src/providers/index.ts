/**
 * App-wide React providers.
 * Prefer importing from `@/providers` or `@/providers/<Name>Provider`.
 */
export {
  MultiHospitalProvider,
  useMultiHospital,
} from "./MultiHospitalProvider"
export {
  BranchProvider,
  useBranch,
  useBranchSelection,
} from "./BranchProvider"
export type { BranchContextValue } from "./BranchProvider"
export {
  AdminHospitalDataProvider,
  useAdminHospitalData,
  useAdminHospitalDataOptional,
} from "./AdminHospitalDataProvider"
export type {
  AdminHospitalDataValue,
  AdminHospitalBillingRecord,
  AdminHospitalRecord,
} from "./AdminHospitalDataProvider"
export {
  PharmacyPortalProvider,
  usePharmacyPortal,
} from "./PharmacyPortalProvider"
export type { PharmacyPortalTabId } from "./PharmacyPortalProvider"
