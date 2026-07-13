import { randomBytes, timingSafeEqual } from "crypto"

/** Opaque token for time-limited PDF download links (WhatsApp / public GET). */
export function createPdfAccessToken(): string {
  return randomBytes(32).toString("hex")
}

export function pdfAccessTokensMatch(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(String(provided))
  const b = Buffer.from(String(expected))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
