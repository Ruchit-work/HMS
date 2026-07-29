"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useMemo,
} from "react"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { auth } from "@/firebase/config"
import { signOut } from "firebase/auth"
import { clearUserRoleCache, useAuth } from "@/shared/hooks/useAuth"

export interface SessionTimeoutConfig {
  enableAutoLogout: boolean
  sessionTimeoutMinutes: number
  warningTimeMinutes: number
  rememberMe?: boolean
}

export const DEFAULT_ROLE_SESSION_CONFIG: Record<string, SessionTimeoutConfig> = {
  admin: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
  super_admin: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
  doctor: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
  receptionist: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
  pharmacy: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
  patient: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
  default: { enableAutoLogout: true, sessionTimeoutMinutes: 45, warningTimeMinutes: 2 },
}

const LAST_ACTIVITY_KEY = "hms_last_activity_timestamp"

interface SessionContextType {
  lastActivity: number
  remainingSeconds: number
  isWarningVisible: boolean
  config: SessionTimeoutConfig
  resetTimer: () => void
  logoutNow: () => Promise<void>
  updateConfig: (customConfig: Partial<SessionTimeoutConfig>) => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function useSession(): SessionContextType {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return context
}

interface SessionProviderProps {
  children: ReactNode
  customConfig?: Partial<SessionTimeoutConfig>
}

export function SessionProvider({ children, customConfig }: SessionProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  // Determine configuration based on logged-in user role or defaults
  const userRole = user?.role || "default"
  const roleDefaultConfig = DEFAULT_ROLE_SESSION_CONFIG[userRole] || DEFAULT_ROLE_SESSION_CONFIG.default

  const [overrideConfig, setOverrideConfig] = useState<Partial<SessionTimeoutConfig> | null>(null)

  const config: SessionTimeoutConfig = useMemo(() => {
    return {
      ...roleDefaultConfig,
      ...customConfig,
      ...overrideConfig,
    }
  }, [roleDefaultConfig, customConfig, overrideConfig])

  const [lastActivity, setLastActivity] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now()
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return Date.now()
  })

  const [isWarningVisible, setIsWarningVisible] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(config.sessionTimeoutMinutes * 60)

  const lastActivityRef = useRef<number>(lastActivity)
  lastActivityRef.current = lastActivity

  const isLoggingOutRef = useRef(false)

  // Centralized reset timer method
  const resetTimer = useCallback(() => {
    if (!config.enableAutoLogout) return
    const now = Date.now()
    lastActivityRef.current = now
    setLastActivity(now)
    setIsWarningVisible(false)
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
    } catch {
      // Ignore storage errors in restricted iframe/incognito
    }
  }, [config.enableAutoLogout])

  // Centralized logout method
  const logoutNow = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    try {
      setIsWarningVisible(false)
      const currentUser = auth.currentUser
      if (currentUser) {
        clearUserRoleCache(currentUser.uid)
        await signOut(auth)
      }
    } catch (err) {
      console.error("Logout execution error:", err)
    } finally {
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY)
      } catch {}
      isLoggingOutRef.current = false
      router.replace("/auth/login")
    }
  }, [router])

  const updateConfig = useCallback((newConfig: Partial<SessionTimeoutConfig>) => {
    setOverrideConfig((prev) => ({ ...prev, ...newConfig }))
  }, [])

  // Listen to route changes as activity
  useEffect(() => {
    if (pathname && !pathname.startsWith("/auth")) {
      resetTimer()
    }
  }, [pathname, resetTimer])

  // Cross-tab synchronization via localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10)
        if (!isNaN(remoteTime) && remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime
          setLastActivity(remoteTime)
          setIsWarningVisible(false)
        }
      }
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  // Global user activity event listeners (clicks, keypresses, scrolls, touch)
  useEffect(() => {
    if (!user || !config.enableAutoLogout) return

    let lastMouseMoveTime = 0

    const handleUserActivity = (e: Event) => {
      if (e.type === "mousemove") {
        const now = Date.now()
        if (now - lastMouseMoveTime < 5000) return // Throttle mousemove resets to 5 seconds
        lastMouseMoveTime = now
      }
      resetTimer()
    }

    const events = ["mousedown", "pointerdown", "keydown", "scroll", "touchstart", "click", "mousemove"]
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }))

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity))
    }
  }, [user, config.enableAutoLogout, resetTimer])

  // Inactivity ticker (runs every second)
  useEffect(() => {
    if (!user || !config.enableAutoLogout) {
      setIsWarningVisible(false)
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - lastActivityRef.current) / 1000)
      const totalTimeoutSeconds = config.sessionTimeoutMinutes * 60
      const warningSecondsThreshold = Math.max(0, (config.sessionTimeoutMinutes - config.warningTimeMinutes) * 60)

      const remaining = Math.max(0, totalTimeoutSeconds - elapsedSeconds)
      setRemainingSeconds(remaining)

      if (elapsedSeconds >= totalTimeoutSeconds) {
        clearInterval(interval)
        void logoutNow()
      } else if (elapsedSeconds >= warningSecondsThreshold) {
        setIsWarningVisible(true)
      } else {
        if (isWarningVisible) setIsWarningVisible(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [user, config.enableAutoLogout, config.sessionTimeoutMinutes, config.warningTimeMinutes, isWarningVisible, logoutNow])

  const contextValue = useMemo<SessionContextType>(
    () => ({
      lastActivity,
      remainingSeconds,
      isWarningVisible,
      config,
      resetTimer,
      logoutNow,
      updateConfig,
    }),
    [lastActivity, remainingSeconds, isWarningVisible, config, resetTimer, logoutNow, updateConfig]
  )

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
      {user && isWarningVisible && (
        <SessionWarningModal
          remainingSeconds={remainingSeconds}
          onStayLoggedIn={resetTimer}
          onLogoutNow={() => void logoutNow()}
        />
      )}
    </SessionContext.Provider>
  )
}

interface SessionWarningModalProps {
  remainingSeconds: number
  onStayLoggedIn: () => void
  onLogoutNow: () => void
}

function SessionWarningModal({ remainingSeconds, onStayLoggedIn, onLogoutNow }: SessionWarningModalProps) {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Session Timeout Warning</h3>
            <p className="text-xs text-slate-500">You have been inactive for a while.</p>
          </div>
        </div>

        <div className="my-5 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-center">
          <p className="text-xs font-medium text-amber-900">Your session will automatically expire in</p>
          <div className="mt-1 font-mono text-3xl font-bold tracking-wider text-amber-600">{formattedTime}</div>
          <p className="mt-1 text-[11px] text-amber-700">Any unsaved work may be lost upon automatic logout.</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onLogoutNow}
            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 active:scale-95 transition"
          >
            Logout Now
          </button>
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-amber-700 active:scale-95 transition"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  )
}
