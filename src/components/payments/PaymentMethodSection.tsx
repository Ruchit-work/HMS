"use client"

import React, { useEffect, useMemo } from "react"

export type PaymentMethodOption = "card" | "upi" | "cash" | "wallet"
type PaymentMethod = PaymentMethodOption | null

export interface PaymentData {
  cardNumber: string
  cardName: string
  expiryDate: string
  cvv: string
  upiId: string
}

interface PaymentMethodSectionProps {
  title?: string
  paymentMethod: PaymentMethod
  setPaymentMethod: (m: Exclude<PaymentMethod, null>) => void
  paymentData: PaymentData
  setPaymentData: (d: PaymentData) => void
  amountToPay: number
  showPartialNote?: boolean
  walletBalance?: number
  methods?: PaymentMethodOption[]
}

export default function PaymentMethodSection({
  title = "Payment Mode",
  paymentMethod,
  setPaymentMethod,
  paymentData,
  setPaymentData,
  amountToPay,
  showPartialNote = false,
  walletBalance = 0,
  methods,
}: PaymentMethodSectionProps) {
  const preventEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  const availableMethods = useMemo<PaymentMethodOption[]>(
    () => (methods && methods.length > 0 ? methods : ["card", "upi", "cash", "wallet"]),
    [methods]
  )

  useEffect(() => {
    if (paymentMethod && !availableMethods.includes(paymentMethod)) {
      setPaymentMethod(availableMethods[0])
    }
  }, [paymentMethod, availableMethods, setPaymentMethod])

  return (
    <div className="mt-4 space-y-4">
      <div className="border-t border-gray-200 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">{title}</label>

        {/* Payment Method */}
        <div>
          <label className="block text-sm text-gray-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {availableMethods.includes("card") && (
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "card"
                    ? "border-green-600 bg-green-50 shadow-md"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <span className="text-2xl mb-1 block">💳</span>
                  <span className="text-sm font-semibold">Card</span>
                </div>
              </button>
            )}
            {availableMethods.includes("upi") && (
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "upi"
                    ? "border-green-600 bg-green-50 shadow-md"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <span className="text-2xl mb-1 block">📱</span>
                  <span className="text-sm font-semibold">UPI</span>
                </div>
              </button>
            )}
            {availableMethods.includes("cash") && (
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "cash"
                    ? "border-green-600 bg-green-50 shadow-md"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <span className="text-2xl mb-1 block">💵</span>
                  <span className="text-sm font-semibold">Cash</span>
                </div>
              </button>
            )}
            {availableMethods.includes("wallet") && (
              <button
                type="button"
                onClick={() => setPaymentMethod("wallet")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === "wallet"
                    ? "border-green-600 bg-green-50 shadow-md"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="text-center">
                  <span className="text-2xl mb-1 block">🪙</span>
                  <span className="text-sm font-semibold">Wallet</span>
                  <div className="text-[11px] text-gray-500 mt-1">₹{Number(walletBalance || 0).toLocaleString()}</div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Payment Details */}
        {paymentMethod === "card" && (
          <div className="mt-4 bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-200">
            <p className="text-sm font-semibold text-blue-800">💳 Card Details</p>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Card Number</label>
              <input
                type="text"
                value={paymentData.cardNumber}
                onChange={(e) => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
                onKeyDown={preventEnter}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Cardholder Name</label>
              <input
                type="text"
                value={paymentData.cardName}
                onChange={(e) => setPaymentData({ ...paymentData, cardName: e.target.value })}
                onKeyDown={preventEnter}
                placeholder="JOHN DOE"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Expiry (MM/YY)</label>
                <input
                  type="text"
                  value={paymentData.expiryDate}
                  onChange={(e) => setPaymentData({ ...paymentData, expiryDate: e.target.value })}
                  onKeyDown={preventEnter}
                  placeholder="12/25"
                  maxLength={5}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">CVV</label>
                <input
                  type="password"
                  value={paymentData.cvv}
                  onChange={(e) => setPaymentData({ ...paymentData, cvv: e.target.value })}
                  onKeyDown={preventEnter}
                  placeholder="123"
                  maxLength={3}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
          </div>
        )}

        {paymentMethod === "upi" && (
          <div className="mt-4 bg-purple-50 rounded-lg p-4 space-y-3 border border-purple-200">
            <p className="text-sm font-semibold text-purple-800">📱 UPI Details</p>
            <div>
              <label className="block text-sm text-gray-700 mb-1">UPI ID</label>
              <input
                type="text"
                value={paymentData.upiId}
                onChange={(e) => setPaymentData({ ...paymentData, upiId: e.target.value })}
                onKeyDown={preventEnter}
                placeholder="yourname@bank"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        )}

        {/* Amount Summary */}
        {paymentMethod && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Amount to Pay:</span>
              <span className="text-xl font-bold text-blue-700">₹{amountToPay}</span>
            </div>
            {paymentMethod === "wallet" && walletBalance !== undefined && amountToPay > (walletBalance || 0) && (
              <p className="text-xs text-red-600 mt-1">Insufficient wallet balance</p>
            )}
            {showPartialNote && (
              <p className="text-xs text-gray-500 mt-1">
                Online amount and remaining will be shown on the confirmation.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


