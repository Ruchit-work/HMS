import type { PharmacyPortalTabId } from '@/contexts/PharmacyPortalContext'

export const PHARMACY_TAB_LABELS: Record<PharmacyPortalTabId, string> = {
  overview: 'Overview',
  inventory: 'Inventory',
  queue: 'Dispense & Billing',
  sales: 'Sales Records',
  cash_and_expenses: 'Cash & Expenses',
  returns: 'Sales Returns',
  orders: 'Orders',
  transfers: 'Transfers',
  reports: 'Reports',
  users: 'Pharmacy Users',
  suppliers: 'Suppliers',
  settings: 'Settings',
}

export const PHARMACY_TAB_SUBTITLES: Record<PharmacyPortalTabId, string> = {
  overview: 'Pharmacy sales results, charts and recent sales',
  inventory: 'Stock levels, barcode lookup and bulk import',
  queue: 'Dispense prescriptions and sell to walk-in customers',
  sales: 'View and track all pharmacy sales',
  cash_and_expenses: 'Daily income & expense, billing counter, shifts and expenses',
  returns: 'Process medicine sales returns and refunds',
  orders: 'Place and receive purchase orders',
  transfers: 'Transfer stock between branches',
  reports: 'Expiry, valuation, sales and reorder reports',
  users: 'Manage pharmacy login credentials',
  suppliers: 'Manage suppliers and contacts',
  settings: 'Cashiers, counters and pharmacy settings',
}

export type PharmacyNavSection = {
  title: string
  items: Array<{ id: PharmacyPortalTabId; label: string; badge?: number | string }>
}

export function buildPharmacyPortalNavSections(options: {
  isSuperAdmin: boolean
  isAdmin: boolean
  alertTotal?: number
}): PharmacyNavSection[] {
  const { isSuperAdmin, isAdmin, alertTotal = 0 } = options
  const sections: PharmacyNavSection[] = [
    {
      title: 'Operations',
      items: [
        { id: 'queue', label: PHARMACY_TAB_LABELS.queue },
        { id: 'returns', label: PHARMACY_TAB_LABELS.returns },
        { id: 'sales', label: PHARMACY_TAB_LABELS.sales },
        { id: 'cash_and_expenses', label: PHARMACY_TAB_LABELS.cash_and_expenses },
      ],
    },
    {
      title: 'Inventory & supply',
      items: [
        { id: 'inventory', label: PHARMACY_TAB_LABELS.inventory },
        { id: 'orders', label: PHARMACY_TAB_LABELS.orders },
        ...(isSuperAdmin ? [{ id: 'transfers' as PharmacyPortalTabId, label: PHARMACY_TAB_LABELS.transfers }] : []),
        { id: 'suppliers', label: PHARMACY_TAB_LABELS.suppliers },
      ],
    },
    {
      title: 'Insights',
      items: [
        { id: 'reports', label: PHARMACY_TAB_LABELS.reports },
        {
          id: 'overview',
          label: PHARMACY_TAB_LABELS.overview,
          badge: alertTotal > 0 ? (alertTotal > 99 ? '99+' : alertTotal) : undefined,
        },
      ],
    },
    {
      title: 'Administration',
      items: [
        ...(isAdmin ? [{ id: 'users' as PharmacyPortalTabId, label: PHARMACY_TAB_LABELS.users }] : []),
        { id: 'settings', label: PHARMACY_TAB_LABELS.settings },
      ],
    },
  ]
  return sections.filter((section) => section.items.length > 0)
}

export function buildPharmacyAdminNavSections(options: {
  isSuperAdmin: boolean
  isAdmin: boolean
}): PharmacyNavSection[] {
  const { isSuperAdmin, isAdmin } = options
  const sections: PharmacyNavSection[] = [
    {
      title: 'Operations',
      items: [
        { id: 'queue', label: PHARMACY_TAB_LABELS.queue },
        { id: 'returns', label: PHARMACY_TAB_LABELS.returns },
        { id: 'sales', label: PHARMACY_TAB_LABELS.sales },
      ],
    },
    {
      title: 'Inventory & supply',
      items: [
        { id: 'inventory', label: PHARMACY_TAB_LABELS.inventory },
        { id: 'orders', label: PHARMACY_TAB_LABELS.orders },
        ...(isSuperAdmin ? [{ id: 'transfers' as PharmacyPortalTabId, label: PHARMACY_TAB_LABELS.transfers }] : []),
        { id: 'suppliers', label: PHARMACY_TAB_LABELS.suppliers },
      ],
    },
    {
      title: 'Insights',
      items: [
        { id: 'reports', label: PHARMACY_TAB_LABELS.reports },
        { id: 'overview', label: PHARMACY_TAB_LABELS.overview },
      ],
    },
  ]
  if (isAdmin) {
    sections.push({
      title: 'Administration',
      items: [{ id: 'users', label: PHARMACY_TAB_LABELS.users }],
    })
  }
  return sections
}
