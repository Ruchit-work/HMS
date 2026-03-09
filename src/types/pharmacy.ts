/**
 * Pharmacy Management Module – types for multi-branch pharmacy
 * Integrates with existing hospital/branch and prescription (appointment.medicine) flow.
 */

import { Timestamp } from 'firebase/firestore'

// ----- Master medicine catalog (per hospital) -----
/** Rx = prescription required, OTC = over the counter */
export type MedicineSchedule = 'Rx' | 'OTC'

export interface PharmacyMedicine {
  id: string
  hospitalId: string
  medicineId: string // unique within hospital, e.g. MED001 or nanoid
  name: string
  genericName: string
  category: string
  manufacturer: string
  purchasePrice: number
  sellingPrice: number
  minStockLevel: number
  supplierId: string | null
  unit?: string // e.g. "tablets", "bottles"
  /** Strength e.g. "500mg", "10mg/ml" */
  strength?: string | null
  /** Pack size e.g. "10 tablets", "100ml" */
  packSize?: string | null
  /** Rx = prescription required, OTC = over the counter */
  schedule?: MedicineSchedule | null
  /** Barcode / EAN for scanning */
  barcode?: string | null
  /** HSN code for GST (India) */
  hsnCode?: string | null
  /** Default quantity to order when reordering */
  reorderQuantity?: number | null
  /** Typical lead time in days from primary supplier */
  leadTimeDays?: number | null
  /** Catalog-level manufacturing date (YYYY-MM-DD) */
  manufacturingDate?: string | null
  /** Catalog-level expiry date (YYYY-MM-DD) */
  expiryDate?: string | null
  createdAt: Timestamp | string
  updatedAt: Timestamp | string
}

// ----- Batch (expiry + quantity) -----
export interface MedicineBatch {
  id: string
  batchNumber: string
  expiryDate: string // ISO date YYYY-MM-DD
  quantity: number
  /** Manufacturing date (YYYY-MM-DD) for FEFO/compliance */
  manufacturingDate?: string | null
  receivedAt?: Timestamp | string
}

// ----- Stock per branch per medicine -----
export interface BranchMedicineStock {
  id: string // `${branchId}_${medicineId}`
  hospitalId: string
  branchId: string
  medicineId: string
  medicineName: string
  batches: MedicineBatch[]
  totalQuantity: number
  updatedAt: Timestamp | string
}

// ----- Dispensal / sale (prescription fulfillment) -----
export interface PharmacySaleLine {
  medicineId: string
  medicineName: string
  quantity: number
  unitPrice: number
  batchId?: string
  batchNumber?: string
  expiryDate?: string
  unit?: string // e.g. "tablets", "capsules"
}

export type PharmacySaleType = 'prescription' | 'walk_in'

/** Payment mode for sales */
export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit' | 'other'

export interface PharmacySale {
  id: string
  /** Human-readable invoice number e.g. INV-2024-001 */
  invoiceNumber?: string | null
  hospitalId: string
  branchId: string
  /** Set for prescription dispense; empty for walk-in */
  appointmentId?: string
  patientId?: string
  patientName?: string
  /** Walk-in customer phone (required for walk-in sales) */
  customerPhone?: string
  doctorId?: string
  doctorName?: string
  lines: PharmacySaleLine[]
  totalAmount: number
  /** cash | card | upi | credit | other */
  paymentMode?: PaymentMode | null
  dispensedAt: Timestamp | string
  dispensedBy: string // uid
  status: 'completed' | 'cancelled'
  /** prescription = from doctor; walk_in = direct customer */
  saleType?: PharmacySaleType
}

// ----- Supplier -----
export interface PharmacySupplier {
  id: string
  hospitalId: string
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  /** e.g. "Net 30", "Cash on delivery" */
  paymentTerms?: string | null
  /** Typical lead time in days */
  leadTimeDays?: number | null
  /** Minimum order value (optional) */
  minOrderValue?: number | null
  createdAt: Timestamp | string
  updatedAt: Timestamp | string
}

// ----- Purchase order -----
export interface PurchaseOrderLine {
  medicineId: string
  medicineName: string
  /** Manufacturer from medicine master (for display in PO) */
  manufacturer?: string
  quantity: number
  unitCost: number
  batchNumber: string
  expiryDate: string
}

export type PurchaseOrderStatus = 'draft' | 'pending' | 'partial' | 'received' | 'cancelled'

export interface PharmacyPurchaseOrder {
  id: string
  /** Human-readable PO number e.g. PO-2024-001 */
  orderNumber?: string | null
  hospitalId: string
  branchId: string
  supplierId: string
  status: PurchaseOrderStatus
  items: PurchaseOrderLine[]
  totalCost: number
  /** Expected delivery date (YYYY-MM-DD) */
  expectedDeliveryDate?: string | null
  /** Free-text notes */
  notes?: string | null
  /** Supplier invoice number (set on receive) */
  supplierInvoiceNumber?: string | null
  receivedAt?: Timestamp | string
  createdAt: Timestamp | string
  createdBy: string
  updatedAt: Timestamp | string
}

// ----- Stock transfer between branches -----
export interface StockTransfer {
  id: string
  hospitalId: string
  fromBranchId: string
  toBranchId: string
  medicineId: string
  medicineName: string
  quantity: number
  batchId?: string
  batchNumber?: string
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: Timestamp | string
  createdBy: string
  completedAt?: Timestamp | string
}

// ----- Stock log (audit trail) -----
export interface PharmacyStockLog {
  id: string
  hospitalId: string
  branchId: string
  medicineId: string
  type: 'in' | 'out' | 'transfer_in' | 'transfer_out' | 'adjust'
  quantity: number
  refId?: string // sale id, transfer id, purchase order id
  createdAt: Timestamp | string
  createdBy?: string
}

// ----- Prescription line (from appointment.medicine / completion form) -----
export interface PrescriptionLine {
  name: string
  dosage: string
  frequency: string
  duration: string
}

// ----- Alerts -----
export interface LowStockAlert {
  branchId: string
  branchName: string
  medicineId: string
  medicineName: string
  currentStock: number
  minStockLevel: number
}

export interface ExpiryAlert {
  branchId: string
  branchName: string
  medicineId: string
  medicineName: string
  batchNumber: string
  expiryDate: string
  quantity: number
  daysUntilExpiry: number
}
