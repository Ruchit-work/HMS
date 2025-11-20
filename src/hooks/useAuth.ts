"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

type UserRole = "patient" | "doctor" | "admin" | "receptionist" | null
const STAFF_ROLES: Exclude<UserRole, "patient" | null>[] = ["admin", "doctor", "receptionist"]

interface AuthUser {
  uid: string
  email: string | null
  role: UserRole
  status?: string
  data?: Record<string, unknown>
}

// Cache user data to avoid repeated queries
const userDataCache = new Map<string, { role: UserRole; data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function getUserRole(uid: string, requiredRole?: UserRole): Promise<{ role: UserRole; data: any } | null> {
  // Check cache first
  const cached = userDataCache.get(uid)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached
  }

  try {
    // If required role is specified, check only that collection
    if (requiredRole === "admin") {
      const adminDoc = await getDoc(doc(db, "admins", uid))
      if (adminDoc.exists()) {
        const data = { role: "admin" as UserRole, data: adminDoc.data() }
        userDataCache.set(uid, { ...data, timestamp: Date.now() })
        return data
      }
      return null
    }

    if (requiredRole === "doctor") {
      const doctorDoc = await getDoc(doc(db, "doctors", uid))
      if (doctorDoc.exists()) {
        const data = { role: "doctor" as UserRole, data: doctorDoc.data() }
        userDataCache.set(uid, { ...data, timestamp: Date.now() })
        return data
      }
      return null
    }

    if (requiredRole === "patient") {
      const patientDoc = await getDoc(doc(db, "patients", uid))
      if (patientDoc.exists()) {
        const data = { role: "patient" as UserRole, data: patientDoc.data() }
        userDataCache.set(uid, { ...data, timestamp: Date.now() })
        return data
      }
      return null
    }

    if (requiredRole === "receptionist") {
      const receptionistDoc = await getDoc(doc(db, "receptionists", uid))
      if (receptionistDoc.exists()) {
        const data = { role: "receptionist" as UserRole, data: receptionistDoc.data() }
        userDataCache.set(uid, { ...data, timestamp: Date.now() })
        return data
      }
      return null
    }

    // No specific role required, check all collections sequentially
    const adminDoc = await getDoc(doc(db, "admins", uid))
    if (adminDoc.exists()) {
      const data = { role: "admin" as UserRole, data: adminDoc.data() }
      userDataCache.set(uid, { ...data, timestamp: Date.now() })
      return data
    }

    const doctorDoc = await getDoc(doc(db, "doctors", uid))
    if (doctorDoc.exists()) {
      const data = { role: "doctor" as UserRole, data: doctorDoc.data() }
      userDataCache.set(uid, { ...data, timestamp: Date.now() })
      return data
    }

    const patientDoc = await getDoc(doc(db, "patients", uid))
    if (patientDoc.exists()) {
      const data = { role: "patient" as UserRole, data: patientDoc.data() }
      userDataCache.set(uid, { ...data, timestamp: Date.now() })
      return data
    }

    const receptionistDoc = await getDoc(doc(db, "receptionists", uid))
    if (receptionistDoc.exists()) {
      const data = { role: "receptionist" as UserRole, data: receptionistDoc.data() }
      userDataCache.set(uid, { ...data, timestamp: Date.now() })
      return data
    }

    return null
  } catch (error) {
    console.error("Error getting user role:", error)
    return null
  }
}

export function useAuth(requiredRole?: UserRole, redirectPath?: string) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // No user logged in
        if (requiredRole) {
          // Protected route - redirect to login
          const loginPath = redirectPath || `/auth/login?role=${requiredRole}`
          router.replace(loginPath)
        }
        setLoading(false)
        return
      }

      try {
        const userRoleData = await getUserRole(currentUser.uid, requiredRole)
        
        if (!userRoleData) {
          // User exists in auth but not in any collection - sign them out
          await signOut(auth)
          router.replace("/")
          setLoading(false)
          return
        }

        // ⚠️ TEMPORARILY DISABLED: MFA verification for staff roles (for testing with trial Twilio account)
        // TODO: Uncomment this section when ready for production 2FA
        // Verify MFA for staff roles
        // if (
        //   userRoleData.role === "admin" ||
        //   userRoleData.role === "doctor" ||
        //   userRoleData.role === "receptionist"
        // ) {
        //   const tokenResult = await currentUser.getIdTokenResult(true)
        //   const authTime = tokenResult?.claims?.auth_time ? String(tokenResult.claims.auth_time) : null
        //   const mfaDoc = await getDoc(doc(db, "mfaSessions", currentUser.uid))
        //   const storedAuthTime = mfaDoc.exists() ? String(mfaDoc.data()?.authTime || "") : ""

        //   if (!authTime || !storedAuthTime || storedAuthTime !== authTime) {
        //     await signOut(auth)
        //     const loginPath = redirectPath || `/auth/login?role=${userRoleData.role}`
        //     router.replace(loginPath)
        //     setLoading(false)
        //     return
        //   }
        // }

        // If route requires specific role and user has different role
        if (requiredRole && requiredRole !== userRoleData.role) {
          const dashboardPath = `/${userRoleData.role}-dashboard`
          router.replace(dashboardPath)
          return
        }

        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          role: userRoleData.role,
          status: userRoleData.data?.status,
          data: userRoleData.data
        })
        setLoading(false)
      } catch (error) {
        console.error("Auth error:", error)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router, requiredRole, redirectPath])

  return { user, loading }
}

// Hook for public routes (login, signup) - redirects if already authenticated
export function usePublicRoute() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is logged in - check their role and redirect to dashboard using cached data
        const userRoleData = await getUserRole(currentUser.uid)
        if (userRoleData) {
        // ⚠️ TEMPORARILY DISABLED: MFA check for staff roles in public routes (for testing with trial Twilio account)
        // TODO: Uncomment this section when ready for production 2FA
        // if (
        //   userRoleData.role === "admin" ||
        //   userRoleData.role === "doctor" ||
        //   userRoleData.role === "receptionist"
        // ) {
        //     const tokenResult = await currentUser.getIdTokenResult(true)
        //     const authTime = tokenResult?.claims?.auth_time ? String(tokenResult.claims.auth_time) : null
        //     const mfaDoc = await getDoc(doc(db, "mfaSessions", currentUser.uid))
        //     const storedAuthTime = mfaDoc.exists() ? String(mfaDoc.data()?.authTime || "") : ""

        //     if (!authTime || !storedAuthTime || storedAuthTime !== authTime) {
        //       // MFA not complete yet - allow login page to handle OTP flow
        //       setLoading(false)
        //       return
        //     }
        // }

          router.replace(`/${userRoleData.role}-dashboard`)
        } else {
          // User exists but no data - sign them out
          await signOut(auth)
        }
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  return { loading }
}

