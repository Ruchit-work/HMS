import { isRecord, type UnknownRecord } from "@/utils/api/typeGuards"

export class ValidationError extends Error {
  status: number
  field?: string

  constructor(message: string, opts?: { status?: number; field?: string }) {
    super(message)
    this.name = "ValidationError"
    this.status = opts?.status ?? 400
    this.field = opts?.field
  }
}

export async function safeJson(request: Request): Promise<UnknownRecord> {
  const raw: unknown = await request.json().catch(() => ({}))
  return isRecord(raw) ? raw : {}
}

export function requireString(
  obj: UnknownRecord,
  key: string,
  opts?: { trim?: boolean; minLen?: number; maxLen?: number }
): string {
  const value = obj[key]
  if (typeof value !== "string") throw new ValidationError(`Missing or invalid "${key}"`, { field: key })
  const v = opts?.trim === false ? value : value.trim()
  if (opts?.minLen !== undefined && v.length < opts.minLen) {
    throw new ValidationError(`"${key}" must be at least ${opts.minLen} characters`, { field: key })
  }
  if (opts?.maxLen !== undefined && v.length > opts.maxLen) {
    throw new ValidationError(`"${key}" must be at most ${opts.maxLen} characters`, { field: key })
  }
  return v
}

export function optionalString(
  obj: UnknownRecord,
  key: string,
  opts?: { trim?: boolean; maxLen?: number }
): string | undefined {
  const value = obj[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") throw new ValidationError(`Invalid "${key}"`, { field: key })
  const v = opts?.trim === false ? value : value.trim()
  if (opts?.maxLen !== undefined && v.length > opts.maxLen) {
    throw new ValidationError(`"${key}" must be at most ${opts.maxLen} characters`, { field: key })
  }
  return v
}

export function optionalNumber(obj: UnknownRecord, key: string): number | undefined {
  const value = obj[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ValidationError(`Invalid "${key}"`, { field: key })
  return value
}


