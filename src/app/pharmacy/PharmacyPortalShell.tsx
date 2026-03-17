'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { usePharmacyPortal } from '@/contexts/PharmacyPortalContext'
import type { PharmacyPortalTabId } from '@/contexts/PharmacyPortalContext'

const TAB_LABELS: Record<PharmacyPortalTabId, string> = {
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

const TAB_SUBTITLES: Record<PharmacyPortalTabId, string> = {
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

const navIcons: Record<PharmacyPortalTabId, React.ReactNode> = {
  overview: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
  ),
  inventory: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
  queue: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  ),
  sales: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  cash_and_expenses: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18v10H3V7zM7 7V5a2 2 0 012-2h6a2 2 0 012 2v2M8 13h3m2 0h3" />
    </svg>
  ),
  returns: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  ),
  orders: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
  ),
  transfers: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
  ),
  reports: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  users: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  ),
  suppliers: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  ),
  settings: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
}

const BRANCH_FILTER_STORAGE_KEY = 'pharmacy-branch-filter'
const ACTIVE_TAB_STORAGE_KEY = 'pharmacy-active-tab'

export default function PharmacyPortalShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isPharmacyUser = user?.role === 'pharmacy'
  const { activeHospitalId, userHospitals, setActiveHospital, isSuperAdmin } = useMultiHospital()
  const portal = usePharmacyPortal()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const displayName: string =
    (user?.data?.firstName != null && user?.data?.lastName != null
      ? `${String(user.data.firstName)} ${String(user.data.lastName)}`.trim()
      : (user?.data?.firstName != null ? String(user.data.firstName) : user?.data?.lastName != null ? String(user.data.lastName) : '')) ||
    (user?.email?.split('@')[0] ?? '') ||
    'Pharmacy'

  const alertTotal = portal ? portal.lowStockCount + portal.expiringCount : 0

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Restore last active tab from localStorage on load
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!portal) return
    try {
      const storedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) as string | null
      const tab: PharmacyPortalTabId | null =
        storedTab === 'billing_counter' || storedTab === 'expenses'
          ? 'cash_and_expenses'
          : (storedTab as PharmacyPortalTabId | null)
      if (!tab) return
      const validTabs: PharmacyPortalTabId[] = [
        'overview',
        'inventory',
        'queue',
        'sales',
        'cash_and_expenses',
        'orders',
        'transfers',
        'reports',
        'users',
        'suppliers',
        'settings',
      ]
      if (validTabs.includes(tab)) {
        if (tab !== portal.activeTab) {
          portal.setActiveTab(tab)
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [portal])

  // Restore last selected branch filter from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!portal || portal.branches.length === 0) return
    try {
      const stored = window.localStorage.getItem(BRANCH_FILTER_STORAGE_KEY)
      if (!stored) return
      if (stored === 'all' || portal.branches.some((b) => b.id === stored)) {
        if (stored !== portal.branchFilter) {
          portal.setBranchFilter(stored)
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [portal, portal?.branches.length])

  // For pharmacist users, lock portal to their assigned branch (no branch switching)
  useEffect(() => {
    if (!portal) return
    if (!isPharmacyUser) return
    const pharmacistData = user?.data as any | undefined
    const branchId = pharmacistData?.branchId as string | undefined
    const branchName = pharmacistData?.branchName as string | undefined
    if (!branchId) {
      // No specific branch assigned; keep current filter
      return
    }
    const alreadySingle =
      portal.branches.length === 1 && portal.branches[0]?.id === branchId
    if (!alreadySingle) {
      portal.setBranches([{ id: branchId, name: branchName || 'Main' }])
    }
    if (portal.branchFilter !== branchId) {
      portal.setBranchFilter(branchId)
    }
  }, [portal, isPharmacyUser, user?.data])

  const performLogout = async () => {
    await signOut(auth)
    window.location.href = '/auth/login?role=pharmacy'
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F0F4F8' }}>
        <p className="text-[#607D8B] text-sm font-medium">Loading...</p>
      </div>
    )
  }

  const primary = '#1565C0'
  const primaryLight = '#E3F2FD'
  const bgPage = '#F0F4F8'

  const tabList: { id: PharmacyPortalTabId; label: string }[] = [
    { id: 'queue', label: TAB_LABELS.queue },                // 1. Dispense & Billing
    { id: 'returns', label: TAB_LABELS.returns },            // 2. Sales Returns
    { id: 'sales', label: TAB_LABELS.sales },                // 3. Sales Records
    { id: 'cash_and_expenses', label: TAB_LABELS.cash_and_expenses }, // 4. Cash & Expenses
    { id: 'inventory', label: TAB_LABELS.inventory },        // 5. Inventory
    { id: 'orders', label: TAB_LABELS.orders },              // 6. Orders
    ...(isSuperAdmin ? [{ id: 'transfers' as const, label: TAB_LABELS.transfers }] : []),
    { id: 'reports', label: TAB_LABELS.reports },            // 7. Reports
    { id: 'suppliers', label: TAB_LABELS.suppliers },        // 8. Suppliers
    ...(isAdmin ? [{ id: 'users' as const, label: TAB_LABELS.users }] : []),
    { id: 'settings', label: TAB_LABELS.settings },         // Settings (cashiers, counters)
    { id: 'overview', label: TAB_LABELS.overview },          // Overview
  ]

  const currentBranchName =
    portal.branches.find((b) => b.id === portal.branchFilter)?.name ??
    (portal.branchFilter === 'all' ? (portal.branches.length > 0 ? 'All branches' : undefined) : undefined)

  const isReadOnlyAdminTab =
    isAdmin && (portal.activeTab === 'queue' || portal.activeTab === 'suppliers' || portal.activeTab === 'orders')

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgPage, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Mobile menu button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white p-2.5 rounded-lg shadow-sm border border-[#E0E0E0] hover:bg-[#F5F5F5] transition-colors duration-200"
          aria-label="Open menu"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5 gap-1">
            <span className="block w-5 h-0.5 bg-[#455A64] rounded-full" />
            <span className="block w-5 h-0.5 bg-[#455A64] rounded-full" />
            <span className="block w-5 h-0.5 bg-[#455A64] rounded-full" />
          </div>
        </button>
      )}

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Light sidebar - soft blue-grey tint + accent */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{ backgroundColor: '#EEF2F7', borderRight: '1px solid #CFD8DC' }}
      >
        {/* Same height as main header row (72px) + line (4px) = 76px so bottom lines align */}
        <div className="flex items-center justify-between h-[76px] px-5 shrink-0" style={{ borderBottom: '1px solid #CFD8DC', backgroundColor: '#E3F2FD' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: primaryLight }}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke={primary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h1 className="text-[#263238] text-sm font-semibold">HMS Pharmacy</h1>
              <p className="text-[#607D8B] text-xs">Inventory &amp; Dispensing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-[#607D8B] hover:text-[#263238] hover:bg-[#F5F5F5] rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 flex flex-col pt-4 px-3 overflow-y-auto">
          <div className="flex-1 space-y-0.5">
            {tabList.map((tab) => {
              const isActive = portal.activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    portal.setActiveTab(tab.id)
                    try {
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab.id)
                      }
                    } catch {
                      // ignore storage errors
                    }
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg py-2.5 px-3 transition-colors duration-200 ${
                    isActive ? 'text-[#1565C0]' : 'text-[#455A64] hover:bg-[#E3E8EF]'
                  }`}
                  style={isActive ? { backgroundColor: primaryLight } : undefined}
                >
                  <span style={{ color: isActive ? primary : undefined }}>{navIcons[tab.id]}</span>
                  <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`} style={{ color: isActive ? primary : undefined }}>
                    {tab.label}
                  </span>
                  {tab.id === 'overview' && alertTotal > 0 && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C62828] px-1.5 text-xs font-semibold text-white">
                      {alertTotal > 99 ? '99+' : alertTotal}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Branch selection moved to top header */}

          <div className="px-2 pb-4 pt-2" style={{ borderTop: '1px solid #CFD8DC' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: primaryLight }}>
                <span className="font-semibold text-sm" style={{ color: primary }}>{displayName.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111827] truncate">{displayName}</p>
                <p className="text-xs text-[#6B7280]">Pharmacy</p>
              </div>
            </div>
            {isAdmin && (
              <Link
                href="/admin-dashboard"
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#374151] hover:bg-[#F3F4F6] border border-[#E5E7EB] transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Admin Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#C62828] hover:bg-[#FFEBEE] border border-[#FFCDD2] transition-colors text-sm font-medium bg-white/60"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Logout
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content - no overflow on wrapper so sticky header can stick to viewport */}
      <div className="lg:ml-64 min-w-0 flex flex-col min-h-screen">
        {/* Top header: stays fixed at top when scrolling */}
        <header className="sticky top-0 z-30 shrink-0 shadow-sm" style={{ backgroundColor: '#F0F4F8' }}>
          {/* 72px row on desktop so with 4px blue line = 76px total, matching sidebar header; on mobile min-height allows wrap */}
          <div className={`flex flex-col sm:flex-row sm:items-center gap-4 min-h-[56px] sm:min-h-[72px] lg:h-[72px] px-4 sm:px-6 lg:px-8 ${!sidebarOpen ? 'pl-14 sm:pl-16 lg:pl-8' : ''}`}>
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3 mb-1 sm:mb-0">
                {isAdmin && (
                  <Link
                    href="/admin-dashboard"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#CFD8DC] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#E3F2FD] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7M3 12h18" />
                    </svg>
                    <span>Back to admin</span>
                  </Link>
                )}
                <div className="text-left">
                  <h1 className="text-2xl font-semibold text-[#263238] truncate capitalize">
                    {TAB_LABELS[portal.activeTab]}
                  </h1>
                  <p className="text-sm text-[#607D8B] mt-0.5 truncate">
                    {TAB_SUBTITLES[portal.activeTab]}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-lg text-[#607D8B] hover:bg-[#E3E8EF] hover:text-[#263238] transition-colors relative"
                  aria-label="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {alertTotal > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#C62828] text-white text-[10px] font-bold flex items-center justify-center">{alertTotal > 9 ? '9+' : alertTotal}</span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-[#E0E0E0] bg-white shadow-lg py-2 z-50">
                    <p className="px-4 py-2 text-sm font-medium text-[#263238]">Notifications</p>
                    {alertTotal > 0 ? (
                      <p className="px-4 py-2 text-sm text-[#607D8B]">You have {alertTotal} alert(s) (low stock / expiring).</p>
                    ) : (
                      <p className="px-4 py-2 text-sm text-[#607D8B]">No new notifications.</p>
                    )}
                  </div>
                )}
              </div>
              {/* Branch selector for admins; static label for pharmacists */}
              {isAdmin && portal.branches.length > 0 ? (
                <select
                  value={portal.branchFilter}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === portal.branchFilter) return
                    if (window.confirm('Change branch? Data will filter by the new branch.')) {
                      portal.setBranchFilter(v)
                      try {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(BRANCH_FILTER_STORAGE_KEY, v)
                        }
                      } catch {
                        // ignore storage errors
                      }
                    }
                  }}
                  className="hidden sm:inline-block rounded-lg border border-[#CFD8DC] bg-white px-2.5 py-2 text-xs sm:text-sm text-[#263238] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] max-w-[200px]"
                >
                  <option value="all">All branches</option>
                  {portal.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                currentBranchName && (
                  <div className="hidden sm:flex items-center rounded-lg border border-[#CFD8DC] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] max-w-[200px]">
                    <span className="mr-1 text-[#6B7280]">Branch:</span>
                    <span className="truncate">{currentBranchName}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          {isAdmin && (
            <div className="mb-3 flex justify-center">
              <div className="rounded-full bg-white/90 border border-[#CBD5E1] px-4 py-1 text-[11px] font-medium text-[#475569] shadow-sm">
                Logged in as Admin – some pharmacy actions may be view-only. Use a pharmacist login for full dispensing access.
              </div>
            </div>
          )}
          {isReadOnlyAdminTab ? (
            <div className="relative">
              <div className="pointer-events-none select-none opacity-70">
                {children}
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                <div className="rounded-full bg-white/95 border border-[#F97316] px-4 py-1 text-[11px] font-semibold text-[#EA580C] shadow-sm">
                  Admin can view but not change data on this tab. Switch to another tab or use a pharmacist login to perform actions.
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Logout from pharmacy portal?</h2>
            <p className="text-sm text-slate-600 mb-4">
              You will be signed out of the pharmacy portal. You can log in again anytime.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performLogout}
                className="px-4 py-2 rounded-lg bg-[#C62828] text-sm font-semibold text-white hover:bg-[#b71c1c]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
