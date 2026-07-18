import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
  resolveAuthorizedHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { AUDIT_ACTIONS, AUDIT_MODULES } from "@/shared/types/audit"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"

const MAX_SCAN_BATCHES = 10
const SCAN_BATCH_SIZE = 100
const FALLBACK_SCAN_LIMIT = 1000

function includesText(value: unknown, search: string): boolean {
  return String(value || "").toLowerCase().includes(search)
}

function isMissingIndexError(error: unknown): boolean {
  const err = error as { code?: number; message?: string }
  return err?.code === 9 || /requires an index/i.test(err?.message || "")
}

export async function GET(request: Request) {
  const limitResult = await applyRateLimit(request, "ADMIN")
  if (limitResult instanceof Response) return limitResult

  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  try {
    const initResult = initFirebaseAdmin("audit logs API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const url = new URL(request.url)
    const requestedHospitalId = url.searchParams.get("hospitalId")?.trim() || null
    const superAdmin = await isPlatformSuperAdmin(auth.user.uid)
    const hospitalId = superAdmin
      ? requestedHospitalId
      : await resolveAuthorizedHospitalId(
          auth.user.uid,
          requestedHospitalId || (await getUserActiveHospitalId(auth.user.uid))
        )

    if (!hospitalId) {
      return NextResponse.json(
        { error: "Select an authorized hospital to view audit logs." },
        { status: 403 }
      )
    }

    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 25))
    const moduleFilter = url.searchParams.get("module")?.trim() || ""
    const actionFilter = url.searchParams.get("action")?.trim() || ""
    const userFilter = url.searchParams.get("user")?.trim().toLowerCase() || ""
    const search = url.searchParams.get("search")?.trim().toLowerCase() || ""
    const dateFrom = url.searchParams.get("dateFrom")?.trim() || ""
    const dateTo = url.searchParams.get("dateTo")?.trim() || ""
    const cursorId = url.searchParams.get("cursor")?.trim() || ""

    if (moduleFilter && !(AUDIT_MODULES as readonly string[]).includes(moduleFilter)) {
      return NextResponse.json({ error: "Invalid module filter." }, { status: 400 })
    }
    if (actionFilter && !Object.values(AUDIT_ACTIONS).includes(actionFilter as never)) {
      return NextResponse.json({ error: "Invalid action filter." }, { status: 400 })
    }

    const collection = admin.firestore().collection("audit_logs")
    let cursorSnapshot: FirebaseFirestore.DocumentSnapshot | null = null
    if (cursorId) {
      const snapshot = await collection.doc(cursorId).get()
      if (snapshot.exists && snapshot.data()?.hospitalId === hospitalId) cursorSnapshot = snapshot
    }

    const matchesFilters = (data: FirebaseFirestore.DocumentData): boolean => {
      const createdAt = String(data.createdAt || "")
      if (dateFrom && createdAt < `${dateFrom}T00:00:00.000Z`) return false
      if (dateTo && createdAt > `${dateTo}T23:59:59.999Z`) return false
      if (moduleFilter && data.module !== moduleFilter) return false
      if (actionFilter && data.action !== actionFilter) return false
      if (
        userFilter &&
        !includesText(data.performedByName, userFilter) &&
        !includesText(data.performedByUserId, userFilter)
      ) {
        return false
      }
      if (
        search &&
        ![
          data.summary,
          data.action,
          data.module,
          data.entityType,
          data.entityId,
          data.performedByName,
          data.source,
        ].some((value) => includesText(value, search))
      ) {
        return false
      }
      return true
    }

    const logs: Array<Record<string, unknown>> = []
    let lastScanned: FirebaseFirestore.QueryDocumentSnapshot | null = null
    let exhausted = false

    try {
      for (let batch = 0; batch < MAX_SCAN_BATCHES && logs.length < pageSize; batch += 1) {
        let query: FirebaseFirestore.Query = collection
          .where("hospitalId", "==", hospitalId)
          .orderBy("createdAt", "desc")
          .limit(SCAN_BATCH_SIZE)

        const startAfterSnapshot = lastScanned || cursorSnapshot
        if (startAfterSnapshot) query = query.startAfter(startAfterSnapshot)

        const snapshot = await query.get()
        if (snapshot.empty) {
          exhausted = true
          break
        }

        for (const doc of snapshot.docs) {
          lastScanned = doc
          const data = doc.data()
          if (!matchesFilters(data)) continue
          logs.push({ id: doc.id, ...data })
          if (logs.length >= pageSize) break
        }

        if (snapshot.size < SCAN_BATCH_SIZE) {
          exhausted = true
          break
        }
      }

      return NextResponse.json({
        hospitalId,
        logs,
        nextCursor: exhausted ? null : lastScanned?.id || null,
        pageSize,
      })
    } catch (queryError) {
      if (!isMissingIndexError(queryError)) throw queryError
      // Composite index (hospitalId + createdAt) not deployed yet — fall back to an
      // unordered tenant query, then sort/filter/paginate in memory.
      console.warn(
        "[audit] audit_logs composite index missing; using in-memory fallback. Deploy firestore.indexes.json."
      )
    }

    const fallbackSnapshot = await collection
      .where("hospitalId", "==", hospitalId)
      .limit(FALLBACK_SCAN_LIMIT)
      .get()

    const allDocs = fallbackSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown> & { id: string })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))

    const cursorIndex = cursorSnapshot
      ? allDocs.findIndex((doc) => doc.id === cursorSnapshot.id)
      : -1
    const filtered = allDocs
      .slice(cursorIndex + 1)
      .filter((doc) => matchesFilters(doc as FirebaseFirestore.DocumentData))
    const page = filtered.slice(0, pageSize)

    return NextResponse.json({
      hospitalId,
      logs: page,
      nextCursor: filtered.length > pageSize ? page[page.length - 1]?.id || null : null,
      pageSize,
    })
  } catch (error) {
    console.error("[audit] Failed to load audit logs", error)
    return NextResponse.json({ error: "Failed to load audit logs." }, { status: 500 })
  }
}
