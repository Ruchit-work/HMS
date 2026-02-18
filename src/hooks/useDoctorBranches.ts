import { useEffect, useState } from "react"
import { auth } from "@/firebase/config"
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

        if (data.success && data.branches) {
          setBranches(data.branches)
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

