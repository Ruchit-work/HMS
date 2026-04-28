import type { PharmacySale } from '@/types/pharmacy'

export const toDateOnly = (value: unknown): string => {
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    return value.slice(0, 10)
  }
  const parsed = (value as { toDate?: () => Date })?.toDate?.()
  return parsed ? parsed.toISOString().slice(0, 10) : ''
}

export const toTimestampMs = (value: unknown): number => {
  if (typeof value === 'string') return new Date(value).getTime()
  return (value as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
}

export const getSaleDateStr = (sale: Pick<PharmacySale, 'dispensedAt'>): string => toDateOnly(sale.dispensedAt)

export const getExpenseDateStr = (expense: { date?: unknown }): string => toDateOnly(expense.date)
