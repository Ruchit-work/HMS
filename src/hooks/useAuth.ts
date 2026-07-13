"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/firebase/config"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import {
  AUTH_RESOLVE_TIMEOUT_MS,
  getDashboardPathForRole,
  getLoginPathForRole,
  getRoleCollection,
  logAuthDev,
  normalizeUserRole,
  type UserRole,
} from "@/utils/auth/roleRouting"

interface AuthUser {
  uid: string
  email: string | null
  role: UserRole
  status?: string
  data?: Record<string, unknown>
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "redirecting" | "error"

const userDataCache = new Map<string, { role: UserRole; data: Record<string, unknown>; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000

/** Seed cache after login so dashboards skip another sequential role scan. */
export function seedUserRoleCache(
  uid: string,
  role: UserRole,
  data: Record<string, unknown> = {}
) {
  if (!uid || !role) return
  userDataCache.set(uid, { role, data, timestamp: Date.now() })
}

export function clearUserRoleCache(uid?: string) {
  if (uid) userDataCache.delete(uid)
  else userDataCache.clear()
}

async function fetchRoleDocument(
  uid: string,
  role: Exclude<UserRole, null | "super_admin">
): Promise<{ role: UserRole; data: Record<string, unknown> } | null> {
  const collectionName = getRoleCollection(role)
  const roleDoc = await getDoc(doc(db, collectionName, uid))
  if (!roleDoc.exists()) return null

  const data = roleDoc.data() as Record<string, unknown>
  const resolvedRole = normalizeUserRole(data.role) ?? role
  return { role: resolvedRole, data }
}

async function getUserRole(
  uid: string,
  requiredRole?: UserRole
): Promise<{ role: UserRole; data: Record<string, unknown> } | null> {
  const cached = userDataCache.get(uid)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    if (!requiredRole || cached.role === requiredRole || cached.role === "super_admin") {
      return { role: cached.role, data: cached.data }
    }
  }

  try {
    if (requiredRole && requiredRole !== "super_admin") {
      const match = await fetchRoleDocument(uid, requiredRole)
      if (match) {
        userDataCache.set(uid, { ...match, timestamp: Date.now() })
        return match
      }
      return null
    }

    const roleOrder: Exclude<UserRole, null | "super_admin">[] = [
      "admin",
      "doctor",
      "patient",
      "receptionist",
      "pharmacy",
    ]

    // Parallel role lookups — same priority order when picking the winner
    const matches = await Promise.all(roleOrder.map((role) => fetchRoleDocument(uid, role)))
    for (let i = 0; i < roleOrder.length; i++) {
      const match = matches[i]
      if (match) {
        userDataCache.set(uid, { ...match, timestamp: Date.now() })
        return match
      }
    }

    return null
  } catch (error) {
    logAuthDev("getUserRole failed", {
      uid,
      requiredRole,
      error: error instanceof Error ? error.message : "unknown",
    })
    throw error
  }
}

function finishAuth(
  setLoading: (value: boolean) => void,
  setStatus: (value: AuthStatus) => void
) {
  setLoading(false)
  setStatus("authenticated")
}

export function useAuth(requiredRole?: UserRole, redirectPath?: string) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [status, setStatus] = useState<AuthStatus>("loading")
  const router = useRouter()

  useEffect(() => {
    setTimedOut(false)
    setError(null)
    setStatus("loading")

    const timeoutId = window.setTimeout(() => {
      setTimedOut(true)
      setLoading(false)
      setStatus("error")
      setError("Authentication timed out. Please refresh or sign in again.")
      logAuthDev("useAuth timeout reached", { requiredRole })
    }, AUTH_RESOLVE_TIMEOUT_MS)

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      window.clearTimeout(timeoutId)

      if (!currentUser) {
        setUser(null)
        setLoading(false)
        setStatus("unauthenticated")
        if (requiredRole) {
          const loginPath = redirectPath || getLoginPathForRole(requiredRole)
          logAuthDev("No Firebase user, redirecting to login", { loginPath })
          router.replace(loginPath)
        }
        return
      }

      try {
        setLoading(true)
        setStatus("loading")

        const userRoleData = await getUserRole(currentUser.uid, requiredRole)

        if (!userRoleData && requiredRole) {
          const actualUserRoleData = await getUserRole(currentUser.uid)
          if (actualUserRoleData) {
            const dashboardPath = getDashboardPathForRole(actualUserRoleData.role)
            setUser(null)
            setLoading(false)
            setStatus("redirecting")
            logAuthDev("Wrong role for route, redirecting", {
              requiredRole,
              actualRole: actualUserRoleData.role,
              dashboardPath,
            })
            router.replace(dashboardPath)
            return
          }

          logAuthDev("Auth user missing Firestore profile, signing out", { uid: currentUser.uid })
          await signOut(auth)
          setUser(null)
          setLoading(false)
          setStatus("unauthenticated")
          router.replace("/auth/login")
          return
        }

        if (!userRoleData) {
          logAuthDev("Auth user missing any role document, signing out", { uid: currentUser.uid })
          await signOut(auth)
          setUser(null)
          setLoading(false)
          setStatus("unauthenticated")
          router.replace("/auth/login")
          return
        }

        if (requiredRole && !isRoleMatch(requiredRole, userRoleData.role)) {
          const dashboardPath = getDashboardPathForRole(userRoleData.role)
          setUser(null)
          setLoading(false)
          setStatus("redirecting")
          logAuthDev("Role mismatch after resolve, redirecting", {
            requiredRole,
            actualRole: userRoleData.role,
            dashboardPath,
          })
          router.replace(dashboardPath)
          return
        }

        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          role: userRoleData.role,
          status: typeof userRoleData.data?.status === "string" ? userRoleData.data.status : undefined,
          data: userRoleData.data,
        })
        setError(null)
        setTimedOut(false)
        finishAuth(setLoading, setStatus)
      } catch (authError) {
        const message =
          authError instanceof Error ? authError.message : "Failed to verify authentication"
        logAuthDev("useAuth error", { requiredRole, message })
        setUser(null)
        setError(message)
        setLoading(false)
        setStatus("error")
      }
    })

    return () => {
      window.clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [router, requiredRole, redirectPath])

  return { user, loading, error, timedOut, status }
}

function isRoleMatch(required: UserRole, actual: UserRole): boolean {
  if (!required || !actual) return false
  if (required === "admin" && actual === "super_admin") return true
  return required === actual
}

export function usePublicRoute() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkAndRedirect = useCallback(async () => {
    const currentUser = auth.currentUser
    if (!currentUser) return false

    try {
      const userRoleData = await getUserRole(currentUser.uid)
      if (userRoleData) {
        const dashboardPath = getDashboardPathForRole(userRoleData.role)
        logAuthDev("Public route: authenticated user redirecting", {
          role: userRoleData.role,
          dashboardPath,
        })
        router.replace(dashboardPath)
        return true
      }

      await signOut(auth)
      return false
    } catch (error) {
      logAuthDev("Public route auth check failed", {
        error: error instanceof Error ? error.message : "unknown",
      })
      return false
    }
  }, [router])

  useEffect(() => {
    let cancelled = false

    const resolve = async () => {
      const redirected = await checkAndRedirect()
      if (!cancelled) setLoading(false)
      if (redirected) {
        logAuthDev("Public route redirect complete")
      }
    }

    resolve()

    const unsubscribe = onAuthStateChanged(auth, async () => {
      const redirected = await checkAndRedirect()
      if (!cancelled) setLoading(false)
      if (redirected) return
    })

    const handlePageshow = async () => {
      if (!cancelled) setLoading(true)
      await checkAndRedirect()
      if (!cancelled) setLoading(false)
    }

    const handleFocus = async () => {
      await checkAndRedirect()
      if (!cancelled) setLoading(false)
    }

    window.addEventListener("pageshow", handlePageshow)
    window.addEventListener("focus", handleFocus)

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(false)
        logAuthDev("usePublicRoute timeout reached")
      }
    }, AUTH_RESOLVE_TIMEOUT_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      unsubscribe()
      window.removeEventListener("pageshow", handlePageshow)
      window.removeEventListener("focus", handleFocus)
    }
  }, [checkAndRedirect])

  return { loading }
}
