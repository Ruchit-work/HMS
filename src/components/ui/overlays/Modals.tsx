'use client'

import { ReactNode, useState } from 'react'
import React from 'react'
import { RevealModal, useRevealModalClose } from './RevealModal'
import { Button } from '@/components/ui/Button'

// ============================================================================
// ConfirmDialog - Simple confirmation dialog with two buttons
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  confirmLoading?: boolean
  /** When false, dialog stays open after confirm (parent must close). Default: true */
  closeOnConfirm?: boolean
  loadingText?: string // Optional custom loading text
}

function ConfirmDialogContent({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmLoading,
  loadingText,
  closeOnConfirm = true,
}: Omit<ConfirmDialogProps, 'isOpen'>) {
  const requestClose = useRevealModalClose()
  const [internalLoading, setInternalLoading] = useState(false)
  const isBusy = Boolean(confirmLoading || internalLoading)

  const handleConfirm = async () => {
    if (isBusy) return
    setInternalLoading(true)
    try {
      await Promise.resolve(onConfirm())
      if (closeOnConfirm) {
        requestClose()
      }
    } catch {
      // Keep dialog open on failure; parent can show error via notification.
    } finally {
      setInternalLoading(false)
    }
  }
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onCancel()
            requestClose()
          }}
          disabled={isBusy}
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={handleConfirm}
          loading={isBusy}
          loadingText={
            loadingText ||
            (confirmText === "Delete" ? "Deleting..." :
              confirmText === "Remove" ? "Removing..." :
              confirmText === "Logout" ? "Signing out..." :
              `${confirmText}ing...` || "Processing...")
          }
        >
          {confirmText}
        </Button>
      </div>
    </>
  )
}

export function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  confirmLoading = false,
  loadingText,
  closeOnConfirm = true,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <RevealModal
      isOpen={isOpen}
      onClose={onCancel}
      zIndex={120}
      overlayClassName="bg-slate-900/40"
      contentClassName="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
    >
      <ConfirmDialogContent
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirmLoading={confirmLoading}
        loadingText={loadingText}
        closeOnConfirm={closeOnConfirm}
      />
    </RevealModal>
  )
}

// Default export for backward compatibility
export default ConfirmDialog

// ============================================================================
// DeleteModal - Detailed deletion confirmation with item details
// ============================================================================

interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  subtitle: string
  itemType: string
  itemDetails: {
    name: string
    email?: string
    phone?: string
    specialization?: string
    qualification?: string
    id: string
    [key: string]: any
  }
  loading?: boolean
}

function DeleteModalContent({
  onConfirm,
  title,
  subtitle,
  itemType,
  itemDetails,
  loading,
}: DeleteModalProps) {
  const requestClose = useRevealModalClose()
  const [internalLoading, setInternalLoading] = useState(false)
  const isBusy = Boolean(loading || internalLoading)

  const handleConfirm = async () => {
    if (isBusy) return
    setInternalLoading(true)
    try {
      await Promise.resolve(onConfirm())
      requestClose()
    } catch {
      // Parent handles error notification; keep modal open.
    } finally {
      setInternalLoading(false)
    }
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl max-w-md w-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {/* ── Body ── */}
      <div className="px-6 py-4">
        <p className="text-sm text-slate-600 mb-4">
          Are you sure you want to delete this {itemType}? This action cannot be undone and will permanently remove all {itemType} data.
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{itemType} details</p>
          <p className="text-sm text-slate-700"><span className="font-medium">Name:</span> {itemDetails.name}</p>
          {itemDetails.email && <p className="text-sm text-slate-700"><span className="font-medium">Email:</span> {itemDetails.email}</p>}
          {itemDetails.phone && <p className="text-sm text-slate-700"><span className="font-medium">Phone:</span> {itemDetails.phone}</p>}
          {itemDetails.specialization && <p className="text-sm text-slate-700"><span className="font-medium">Specialization:</span> {itemDetails.specialization}</p>}
          {itemDetails.qualification && <p className="text-sm text-slate-700"><span className="font-medium">Qualification:</span> {itemDetails.qualification}</p>}
          <p className="text-sm text-slate-700"><span className="font-medium">ID:</span> <span className="font-mono text-xs text-slate-500">{itemDetails.id}</span></p>
        </div>
      </div>
      {/* ── Footer ── */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
        <Button variant="outline" size="sm" onClick={requestClose}>Cancel</Button>
        <Button variant="danger" size="sm" onClick={handleConfirm} loading={isBusy} loadingText={`Deleting…`}>
          Delete {itemType}
        </Button>
      </div>
    </div>
  )
}

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  itemType,
  itemDetails,
  loading = false,
}: DeleteModalProps) {
  if (!isOpen) return null

  return (
    <RevealModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="p-0"
    >
      <DeleteModalContent
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        title={title}
        subtitle={subtitle}
        itemType={itemType}
        itemDetails={itemDetails}
        loading={loading}
      />
    </RevealModal>
  )
}

// ============================================================================
// ViewModal - View-only modal with colored header and custom content
// ============================================================================

interface ViewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  headerColor: 'blue' | 'green' | 'purple' | 'orange'
  children: ReactNode
}

const viewModalHeaderClasses = {
  blue: 'bg-gradient-to-r from-cyan-600 to-teal-700',
  green: 'bg-gradient-to-r from-green-600 to-green-700',
  purple: 'bg-gradient-to-r from-cyan-600 to-teal-700',
  orange: 'bg-gradient-to-r from-orange-600 to-orange-700',
}
const viewModalTextColorClasses = {
  blue: 'text-cyan-100',
  green: 'text-green-100',
  purple: 'text-cyan-100',
  orange: 'text-orange-100',
}
function ViewModalContent({
  title,
  subtitle,
  headerColor,
  children,
}: Pick<ViewModalProps, 'title' | 'subtitle' | 'headerColor' | 'children'>) {
  const requestClose = useRevealModalClose()
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
      <div className={`px-6 py-4 ${viewModalHeaderClasses[headerColor]} text-white shrink-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className={`text-xs ${viewModalTextColorClasses[headerColor]}`}>{subtitle}</p>
            </div>
          </div>
          <button onClick={requestClose} type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 bg-slate-50 flex-1">
        {children}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
        <Button variant="secondary" size="sm" onClick={requestClose}>Close</Button>
      </div>
    </div>
  )
}

export function ViewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  headerColor,
  children,
}: ViewModalProps) {
  if (!isOpen) return null

  return (
    <RevealModal isOpen={isOpen} onClose={onClose} contentClassName="p-0">
      <ViewModalContent title={title} subtitle={subtitle} headerColor={headerColor}>
        {children}
      </ViewModalContent>
    </RevealModal>
  )
}

