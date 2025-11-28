'use client'

import { ReactNode } from 'react'
import React from 'react'

// ============================================================================
// ConfirmDialog - Simple confirmation dialog with two buttons
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  confirmLoading?: boolean
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
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
            disabled={confirmLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={confirmLoading}
          >
            {confirmLoading ? "Signing out..." : confirmText}
          </button>
        </div>
      </div>
    </div>
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
  onConfirm: () => void
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

export function DeleteModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  subtitle, 
  itemType, 
  itemDetails, 
  loading = false 
}: DeleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-xs sm:text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-4 sm:px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this {itemType}? This will permanently remove all {itemType} data.
          </p>
          
          {/* Item Info */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">{itemType} Details:</h4>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">Name:</span> {itemDetails.name}
              </p>
              {itemDetails.email && (
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">Email:</span> {itemDetails.email}
                </p>
              )}
              {itemDetails.phone && (
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">Phone:</span> {itemDetails.phone}
                </p>
              )}
              {itemDetails.specialization && (
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">Specialization:</span> {itemDetails.specialization}
                </p>
              )}
              {itemDetails.qualification && (
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium">Qualification:</span> {itemDetails.qualification}
                </p>
              )}
              <p className="text-xs sm:text-sm text-gray-600">
                <span className="font-medium">ID:</span> <span className="font-mono text-xs">{itemDetails.id}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {loading ? `Deleting ${itemType}...` : `Delete ${itemType}`}
          </button>
        </div>
      </div>
    </div>
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

export function ViewModal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  headerColor, 
  children 
}: ViewModalProps) {
  if (!isOpen) return null

  const headerClasses = {
    blue: 'bg-gradient-to-r from-blue-600 to-blue-700',
    green: 'bg-gradient-to-r from-green-600 to-green-700',
    purple: 'bg-gradient-to-r from-purple-600 to-purple-700',
    orange: 'bg-gradient-to-r from-orange-600 to-orange-700'
  }

  const textColorClasses = {
    blue: 'text-blue-100',
    green: 'text-green-100',
    purple: 'text-purple-100',
    orange: 'text-orange-100'
  }

  const hoverClasses = {
    blue: 'hover:text-blue-200 hover:bg-white hover:bg-opacity-20',
    green: 'hover:text-green-200 hover:bg-white hover:bg-opacity-20',
    purple: 'hover:text-purple-200 hover:bg-white hover:bg-opacity-20',
    orange: 'hover:text-orange-200 hover:bg-white hover:bg-opacity-20'
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden transform transition-all duration-300 ease-out">
        {/* Modal Header */}
        <div className={`px-4 sm:px-6 py-4 sm:py-5 ${headerClasses[headerColor]} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold">{title}</h3>
                <p className={`text-xs sm:text-sm ${textColorClasses[headerColor]}`}>{subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`text-white transition-colors duration-200 p-2 rounded-lg ${hoverClasses[headerColor]}`}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
          {children}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-8 py-4 bg-white border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

