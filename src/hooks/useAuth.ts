"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

type UserRole = "patient" | "doctor" | null

interface AuthUser {
  uid: string
  email: string | null
  role: UserRole
  status?: string
  data?: any
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
        // Check doctor collection
        const doctorDoc = await getDoc(doc(db, "doctors", currentUser.uid))
        if (doctorDoc.exists()) {
          const doctorData = doctorDoc.data()
          
          // If route requires specific role and user has different role
          if (requiredRole && requiredRole !== "doctor") {
            router.replace("/doctor-dashboard")
            return
          }

          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            role: "doctor",
            status: doctorData.status,
            data: doctorData
          })
          setLoading(false)
          return
        }

        // Check patient collection
        const patientDoc = await getDoc(doc(db, "patients", currentUser.uid))
        if (patientDoc.exists()) {
          const patientData = patientDoc.data()
          
          // If route requires specific role and user has different role
          if (requiredRole && requiredRole !== "patient") {
            router.replace("/patient-dashboard")
            return
          }

          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            role: "patient",
            data: patientData
          })
          setLoading(false)
          return
        }

        // User exists in auth but not in any collection - sign them out
        await signOut(auth)
        router.replace("/")
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
        // User is logged in - check their role and redirect to dashboard
        const doctorDoc = await getDoc(doc(db, "doctors", currentUser.uid))
        if (doctorDoc.exists()) {
          router.replace("/doctor-dashboard")
          return
        }

        const patientDoc = await getDoc(doc(db, "patients", currentUser.uid))
        if (patientDoc.exists()) {
          router.replace("/patient-dashboard")
          return
        }

        // User exists but no data - sign them out
        await signOut(auth)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  return { loading }
}

