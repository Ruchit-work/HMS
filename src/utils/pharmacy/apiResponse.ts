import { NextResponse } from 'next/server'

export function pharmacyError(
  message: string,
  status: number,
  code = 'PHARMACY_ERROR',
  extras: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      errorDetail: {
        code,
        message,
      },
      ...extras,
    },
    { status }
  )
}
