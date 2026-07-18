/**
 * Server BranchService — re-exports existing hospital branch helpers.
 */

export {
  getFirstActiveBranchForHospital,
  getBranchIfBelongsToHospital,
  getReceptionistDefaultBranch,
} from "@/shared/utils/firebase/serverHospitalQueries"

import {
  getFirstActiveBranchForHospital,
  getBranchIfBelongsToHospital,
  getReceptionistDefaultBranch,
} from "@/shared/utils/firebase/serverHospitalQueries"

export const BranchServerService = {
  getFirstActiveBranchForHospital,
  getBranchIfBelongsToHospital,
  getReceptionistDefaultBranch,
}

export default BranchServerService
