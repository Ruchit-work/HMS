type QueryValue = string | number | boolean | null | undefined

type QueryParams = Record<string, QueryValue>

export type PharmacyApiResult<T = Record<string, unknown>> = {
  ok: boolean
  status: number
  data: T
}

function buildQuery(params: QueryParams): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    searchParams.set(key, String(value))
  })
  return searchParams.toString()
}

function withQuery(path: string, params: QueryParams): string {
  const query = buildQuery(params)
  return query ? `${path}?${query}` : path
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createPharmacyApiClient(token: string) {
  const headers = { Authorization: `Bearer ${token}` }

  const get = async <T extends Record<string, unknown> = Record<string, unknown>>(
    path: string,
    params: QueryParams = {}
  ): Promise<PharmacyApiResult<T>> => {
    const res = await fetch(withQuery(path, params), { headers })
    let parsed: unknown = {}
    try {
      parsed = await res.json()
    } catch {
      parsed = {}
    }
    return {
      ok: res.ok,
      status: res.status,
      data: (isObject(parsed) ? parsed : {}) as T,
    }
  }

  const send = async <T extends Record<string, unknown> = Record<string, unknown>>(
    path: string,
    options: { method: 'POST' | 'PATCH' | 'DELETE'; body?: Record<string, unknown> }
  ): Promise<PharmacyApiResult<T>> => {
    const requestHeaders: Record<string, string> = { ...headers }
    if (options.body) requestHeaders['Content-Type'] = 'application/json'
    const res = await fetch(path, {
      method: options.method,
      headers: requestHeaders,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })
    let parsed: unknown = {}
    try {
      parsed = await res.json()
    } catch {
      parsed = {}
    }
    return {
      ok: res.ok,
      status: res.status,
      data: (isObject(parsed) ? parsed : {}) as T,
    }
  }

  return {
    getMedicines: (params: { hospitalId: string }) => get('/api/pharmacy/medicines', params),
    getStock: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/stock', params),
    getSuppliers: (params: { hospitalId: string }) => get('/api/pharmacy/suppliers', params),
    getAlerts: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/alerts', params),
    getPrescriptionQueue: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/prescription-queue', params),
    getSales: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/sales', params),
    getAnalytics: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/analytics', params),
    getTransfers: (params: { hospitalId: string }) => get('/api/pharmacy/transfers', params),
    getPharmacists: () => get('/api/admin/pharmacists'),
    getPurchaseOrders: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/purchase-orders', params),
    getCashSessions: (params: { hospitalId?: string; branchId?: string }) => get('/api/pharmacy/cash-session', params),
    getExpenseCategories: (params: { hospitalId: string }) => get('/api/pharmacy/expenses/categories', params),
    getExpenses: (params: {
      hospitalId: string
      branchId?: string
      dateFrom?: string
      dateTo?: string
      categoryId?: string
      paymentMethod?: string
    }) => get('/api/pharmacy/expenses', params),
    getCashiers: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/cashiers', params),
    getCounters: (params: { hospitalId: string; branchId?: string }) => get('/api/pharmacy/counters', params),
    submitSaleReturn: (payload: {
      saleId: string
      lines: { medicineId: string; quantity: number }[]
      note?: string
      refundPaymentMode: 'cash' | 'upi' | 'card' | 'other'
      refundNotes?: Record<string, number>
    }) => send('/api/pharmacy/sales/return', { method: 'POST', body: payload }),
    deleteStock: (payload: { stockId: string }) => send('/api/pharmacy/stock', { method: 'DELETE', body: payload }),
    upsertCashSession: (payload: Record<string, unknown>) => send('/api/pharmacy/cash-session', { method: 'POST', body: payload }),
    createExpense: (payload: Record<string, unknown>) => send('/api/pharmacy/expenses', { method: 'POST', body: payload }),
    createCashier: (payload: { name: string; phone?: string; branchId?: string }) => send('/api/pharmacy/cashiers', { method: 'POST', body: payload }),
    updateCashier: (cashierId: string, payload: { name: string; phone?: string }) =>
      send(`/api/pharmacy/cashiers/${cashierId}`, { method: 'PATCH', body: payload }),
    deleteCashier: (cashierId: string) => send(`/api/pharmacy/cashiers/${cashierId}`, { method: 'DELETE' }),
    createCounter: (payload: { name: string; branchId?: string }) => send('/api/pharmacy/counters', { method: 'POST', body: payload }),
    updateCounter: (counterId: string, payload: { name: string }) =>
      send(`/api/pharmacy/counters/${counterId}`, { method: 'PATCH', body: payload }),
    deleteCounter: (counterId: string) => send(`/api/pharmacy/counters/${counterId}`, { method: 'DELETE' }),
    deleteSupplier: (supplierId: string) => send(`/api/pharmacy/suppliers/${supplierId}`, { method: 'DELETE' }),
    patchPurchaseOrder: (orderId: string, payload: Record<string, unknown>) =>
      send(`/api/pharmacy/purchase-orders?orderId=${encodeURIComponent(orderId)}`, { method: 'PATCH', body: payload }),
  }
}
