import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

type DashboardRole = "patient" | "doctor" | "admin" | "receptionist"

const PHONE_FIELDS = ["phone", "phoneNumber", "contactNumber", "mobile", "contact", "mfaPhone"]

const COLLECTION_ROLE_MAP: Array<{ role: DashboardRole; collection: string }> = [
  { role: "patient", collection: "patients" },
  { role: "doctor", collection: "doctors" },
  { role: "receptionist", collection: "receptionists" },
  { role: "admin", collection: "admins" },
]

function normalizePhoneInput(value: string) {
  if (!value) return ""
  let trimmed = value.trim()
  if (!trimmed) return ""
  trimmed = trimmed.replace(/\s+/g, "")
  if (trimmed.startsWith("+") && trimmed.length > 1) {
    return trimmed
  }
  const digits = trimmed.replace(/[^\d]/g, "")
  if (!digits) return ""
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`
  }
  if (digits.length === 10) {
    return `+91${digits}`
  }
  return `+${digits}`
}

function buildPhoneCandidates(input: string) {
  const normalized = normalizePhoneInput(input)
  if (!normalized) return []
  const digitsOnly = normalized.replace(/[^\d]/g, "")
  const candidates = new Set<string>()
  candidates.add(normalized)
  candidates.add(normalized.replace(/^\+/, ""))
  candidates.add(digitsOnly)
  if (digitsOnly.startsWith("91") && digitsOnly.length > 2) {
    candidates.add(digitsOnly.slice(2))
    candidates.add(`+${digitsOnly.slice(2)}`)
  }
  return Array.from(candidates).filter(Boolean)
}

function getSearchTargets(roleHint?: DashboardRole | null) {
  if (roleHint) {
    return COLLECTION_ROLE_MAP.filter((entry) => entry.role === roleHint)
  }
  const precedence: DashboardRole[] = ["patient", "doctor", "receptionist", "admin"]
  return precedence
    .map((role) => COLLECTION_ROLE_MAP.find((entry) => entry.role === role))
    .filter((entry): entry is { role: DashboardRole; collection: string } => Boolean(entry))
}

export async function POST(request: Request) {
  try {
    const initResult = initFirebaseAdmin("lookup-identifier")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : ""
    const roleHint = body?.role ?? null

    if (!identifier) {
      return NextResponse.json({ error: "Identifier is required." }, { status: 400 })
    }

    if (identifier.includes("@")) {
      // Already an email
      return NextResponse.json({
        success: true,
        email: identifier.toLowerCase(),
      })
    }

    const phoneCandidates = buildPhoneCandidates(identifier)
    if (phoneCandidates.length === 0) {
      return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 })
    }

    const db = admin.firestore()
    const targets = getSearchTargets(roleHint)

    for (const candidatePhone of phoneCandidates) {
      if (!candidatePhone) continue
      for (const target of targets) {
        for (const field of PHONE_FIELDS) {
          const snapshot = await db
            .collection(target.collection)
            .where(field, "==", candidatePhone)
            .limit(1)
            .get()

          if (!snapshot.empty) {
            const record = snapshot.docs[0].data()
            const email = typeof record?.email === "string" ? record.email.trim().toLowerCase() : ""
            if (email) {
              return NextResponse.json({
                success: true,
                email,
                role: target.role,
              })
            }
          }
        }
      }
    }

    return NextResponse.json(
      { error: "We couldn't find an account with that phone number." },
      { status: 404 }
    )
  } catch (error) {
    console.error("[lookup-identifier] error", error)
    return NextResponse.json(
      { error: "Failed to look up account. Please try again later." },
      { status: 500 }
    )
  }
}

