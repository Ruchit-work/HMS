import { useEffect, useState } from "react"
import { auth, db } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import type { Branch } from "@/types/branch"

export function useDoctorBranches(activeHospitalId: string | null) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchBranches = async () => {
      if (!activeHospitalId) return

      try {
        setLoading(true)
        const currentUser = auth.currentUser
        if (!currentUser) {
          return
        }
        const token = await currentUser.getIdToken()

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = await response.json()

        if (data.success && Array.isArray(data.branches)) {
          let result: Branch[] = data.branches

          // If doctor has explicit branchIds, restrict branches to those
          try {
            const doctorSnap = await getDoc(doc(db, "doctors", currentUser.uid))
            if (doctorSnap.exists()) {
              const doctorData = doctorSnap.data() as any
              const branchIds: string[] = Array.isArray(doctorData.branchIds) ? doctorData.branchIds : []
              if (branchIds.length > 0) {
                result = result.filter((b) => branchIds.includes(b.id))
              }
            }
          } catch {
            // ignore filtering errors; fall back to all hospital branches
          }

          setBranches(result)
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }

    fetchBranches()
  }, [activeHospitalId])

  return { branches, loadingBranches: loading }
}

