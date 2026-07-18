"use client"

import React, { useEffect, useMemo } from "react"

export type PaymentMethodOption = "card" | "upi" | "cash" | "bank_transfer" | "cheque"
type PaymentMethod = PaymentMethodOption | null

export interface PaymentData {
  cardNumber: string
  cardName: string
  expiryDate: string
  cvv: string
  upiId: string
  bankReference?: string
  chequeNumber?: string
}

interface PaymentMethodSectionProps {
  title?: string
  paymentMethod: PaymentMethod
  setPaymentMethod: (_method: Exclude<PaymentMethod, null>) => void
  paymentData: PaymentData
  setPaymentData: (_data: PaymentData) => void
  amountToPay: number
  showPartialNote?: boolean
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
  methods,
}: PaymentMethodSectionProps) {
  const preventEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
    }
  }

  const availableMethods = useMemo<PaymentMethodOption[]>(
    () => (methods && methods.length > 0 ? methods : ["card", "upi", "cash"]),
    [methods]
  )

  useEffect(() => {
    if (paymentMethod && !availableMethods.includes(paymentMethod)) {
      setPaymentMethod(availableMethods[0])
    }
  }, [paymentMethod, availableMethods, setPaymentMethod])

  const methodConfig: Record<PaymentMethodOption, { label: string; sub: string; icon: React.ReactNode }> = {
    card: {
      label: "Card",
      sub: "Debit / Credit",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    upi: {
      label: "UPI",
      sub: "QR / VPA",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    cash: {
      label: "Cash",
      sub: "Collect at desk",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    bank_transfer: {
      label: "Bank Transfer",
      sub: "NEFT / IMPS",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      ),
    },
    cheque: {
      label: "Cheque",
      sub: "Bank cheque",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  }

  const gridCols =
    availableMethods.length <= 1
      ? "grid-cols-1"
      : availableMethods.length === 2
        ? "grid-cols-2"
        : availableMethods.length === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-2 sm:grid-cols-3"

  return (
    <div className="mt-3 border-t border-slate-100 pt-4 space-y-3">
      <div className="rx-form-section-header !mb-3">
        <div className="rx-form-section-icon">
          <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <p className="rx-form-section-title">{title}</p>
          <p className="rx-form-section-desc">Select how the patient will pay for this appointment</p>
        </div>
      </div>

      <div className="rx-form-field">
        <label className="rx-form-label">Payment Method</label>
        <div className={`grid gap-2 ${gridCols}`}>
          {availableMethods.map((method) => {
            const cfg = methodConfig[method]
            const active = paymentMethod === method
            return (
              <button key={method} type="button" onClick={() => setPaymentMethod(method)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2.5 py-2.5 text-center transition-all sm:px-3 sm:py-3 ${
                  active
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-slate-50"
                }`}>
                <span className={active ? "text-cyan-600" : "text-slate-400"}>{cfg.icon}</span>
                <span className="text-xs font-semibold">{cfg.label}</span>
                <span className="text-[10px] text-slate-400">{cfg.sub}</span>
              </button>
            )
          })}
        </div>
      </div>

      {paymentMethod === "card" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5 sm:p-4 sm:space-y-3">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-xs font-semibold text-slate-700">Card Details</p>
          </div>
          <div className="rx-form-field">
            <label className="rx-form-label">Card Number</label>
            <input type="text" value={paymentData.cardNumber}
              onChange={(e) => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
              onKeyDown={preventEnter}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className="rx-form-input"
            />
          </div>
          <div className="rx-form-field">
            <label className="rx-form-label">Cardholder Name</label>
            <input type="text" value={paymentData.cardName}
              onChange={(e) => setPaymentData({ ...paymentData, cardName: e.target.value })}
              onKeyDown={preventEnter}
              placeholder="Name as on card"
              className="rx-form-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rx-form-field">
              <label className="rx-form-label">Expiry</label>
              <input type="text" value={paymentData.expiryDate}
                onChange={(e) => setPaymentData({ ...paymentData, expiryDate: e.target.value })}
                onKeyDown={preventEnter}
                placeholder="MM / YY"
                maxLength={5}
                className="rx-form-input"
              />
            </div>
            <div className="rx-form-field">
              <label className="rx-form-label">CVV</label>
              <input type="password" value={paymentData.cvv}
                onChange={(e) => setPaymentData({ ...paymentData, cvv: e.target.value })}
                onKeyDown={preventEnter}
                placeholder="•••"
                maxLength={3}
                className="rx-form-input"
              />
            </div>
          </div>
        </div>
      )}

      {paymentMethod === "upi" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5 sm:p-4 sm:space-y-3">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-xs font-semibold text-slate-700">UPI Details</p>
          </div>
          <div className="rx-form-field">
            <label className="rx-form-label">UPI ID / VPA</label>
            <input type="text" value={paymentData.upiId}
              onChange={(e) => setPaymentData({ ...paymentData, upiId: e.target.value })}
              onKeyDown={preventEnter}
              placeholder="yourname@upi"
              className="rx-form-input"
            />
            <p className="rx-form-helper">e.g. 9876543210@paytm or name@okaxis</p>
          </div>
        </div>
      )}

      {paymentMethod === "bank_transfer" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5 sm:p-4 sm:space-y-3">
          <div className="rx-form-field">
            <label className="rx-form-label">Transfer / UTR Reference</label>
            <input
              type="text"
              value={paymentData.bankReference || ""}
              onChange={(e) => setPaymentData({ ...paymentData, bankReference: e.target.value })}
              onKeyDown={preventEnter}
              placeholder="UTR / reference number"
              className="rx-form-input"
            />
          </div>
        </div>
      )}

      {paymentMethod === "cheque" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5 sm:p-4 sm:space-y-3">
          <div className="rx-form-field">
            <label className="rx-form-label">Cheque Number</label>
            <input
              type="text"
              value={paymentData.chequeNumber || ""}
              onChange={(e) => setPaymentData({ ...paymentData, chequeNumber: e.target.value })}
              onKeyDown={preventEnter}
              placeholder="Cheque number"
              className="rx-form-input"
            />
          </div>
        </div>
      )}

      {paymentMethod && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 sm:py-3">
          <div>
            <p className="text-xs font-semibold text-cyan-800">Total Amount Due</p>
            {showPartialNote && (
              <p className="mt-0.5 text-[11px] text-cyan-600">Remaining balance shown on confirmation slip</p>
            )}
          </div>
          <span className="text-lg font-bold tracking-tight text-cyan-800 sm:text-xl">
            ₹{Number(amountToPay || 0).toLocaleString("en-IN")}
          </span>
        </div>
      )}
    </div>
  )
}
