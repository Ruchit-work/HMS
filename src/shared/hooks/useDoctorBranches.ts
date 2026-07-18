import { useEffect, useState } from "react"
import { auth, db } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import type { Branch } from "@/types/branch"
import { fetchBranches } from "@/services/BranchService"

export function useDoctorBranches(activeHospitalId: string | null) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!activeHospitalId) return

      try {
        setLoading(true)
        const currentUser = auth.currentUser
        if (!currentUser) {
          return
        }
        const token = await currentUser.getIdToken()
        const result = await fetchBranches(activeHospitalId, { token })

        if (result.success) {
          let next: Branch[] = result.branches

          // If doctor has explicit branchIds, restrict branches to those
          try {
            const doctorSnap = await getDoc(doc(db, "doctors", currentUser.uid))
            if (doctorSnap.exists()) {
              const doctorData = doctorSnap.data() as { branchIds?: string[] }
              const branchIds: string[] = Array.isArray(doctorData.branchIds) ? doctorData.branchIds : []
              if (branchIds.length > 0) {
                next = next.filter((b) => branchIds.includes(b.id))
              }
            }
          } catch {
            // ignore filtering errors; fall back to all hospital branches
          }

          setBranches(next)
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [activeHospitalId])

  return { branches, loadingBranches: loading }
}
