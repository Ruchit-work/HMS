/* READ-ONLY diagnostic: find appointments that are paid in Firestore but
 * still classified as "pending" by the billing-records API logic.
 * Usage: node scripts/diagnose-stale-pending.js [hospitalId]
 */
const fs = require("fs")
const path = require("path")
const admin = require("firebase-admin")

const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
const env = {}
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const privateKey = (env.FIREBASE_PRIVATE_KEY || "").replace(/^"|"$/g, "").replace(/\\n/g, "\n")

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
})

const HOSPITAL_ID = process.argv[2] || "rff3NCIuBFL6prCZ6Z3E"

// Mirrors src/app/api/receptionist/billing-records/route.ts (appointment loop)
function receptionistStatus(data) {
  const paymentStatus = String(data.paymentStatus || "").toLowerCase()
  const hasPaidAt = Boolean(data.paidAt) && String(data.paidAt).trim() !== ""
  const isCancelled =
    data.status === "cancelled" || data.status === "doctor_cancelled" || paymentStatus === "refunded"
  const isPaid = !isCancelled && (paymentStatus === "paid" || hasPaidAt)
  return isCancelled ? "cancelled" : isPaid ? "paid" : "pending"
}

// Mirrors src/app/api/admin/billing-records/route.ts (appointment loop, FIXED logic)
function adminStatus(data) {
  const paymentStatus = String(data.paymentStatus || "").toLowerCase()
  const hasPaidAt = Boolean(data.paidAt) && String(data.paidAt).trim() !== ""
  if (
    data.status === "cancelled" ||
    data.status === "doctor_cancelled" ||
    paymentStatus === "refunded"
  ) {
    return "cancelled"
  }
  if (paymentStatus === "paid" || hasPaidAt) return "paid"
  return "pending"
}

function isDocPaid(data) {
  const paymentStatus = String(data.paymentStatus || "").toLowerCase()
  const hasPaidAt = Boolean(data.paidAt) && String(data.paidAt).trim() !== ""
  const remainingZero = Number(data.remainingAmount || 0) === 0
  return paymentStatus === "paid" && hasPaidAt && remainingZero
}

async function main() {
  const db = admin.firestore()
  const aptSnap = await db
    .collection(`hospitals/${HOSPITAL_ID}/appointments`)
    .orderBy("createdAt", "desc")
    .limit(150)
    .get()

  let staleReceptionist = 0
  let staleAdmin = 0
  console.log(`=== Hospital ${HOSPITAL_ID}: ${aptSnap.size} appointments scanned ===`)
  for (const doc of aptSnap.docs) {
    const data = doc.data() || {}
    const hasFee =
      Number(data.paymentAmount || 0) > 0 ||
      Number(data.totalConsultationFee || 0) > 0 ||
      Number(data.remainingAmount || 0) > 0
    if (!hasFee) continue
    if (!isDocPaid(data)) continue

    const r = receptionistStatus(data)
    const a = adminStatus(data)
    if (r === "pending" || a === "pending") {
      if (r === "pending") staleReceptionist++
      if (a === "pending") staleAdmin++
      console.log(
        JSON.stringify({
          id: doc.id,
          receptionistApi: r,
          adminApi: a,
          status: data.status,
          paymentStatus: data.paymentStatus,
          paymentAmount: data.paymentAmount,
          remainingAmount: data.remainingAmount,
          paidAt: data.paidAt,
          createdAt: data.createdAt,
        })
      )
    }
  }
  console.log(`Stale (paid doc classified pending) — receptionist API: ${staleReceptionist}, admin API: ${staleAdmin}`)

  // billing_records docs still pending but whose appointment is already paid
  console.log("=== billing_records pending vs paid appointment ===")
  const brSnap = await db.collection("billing_records").where("hospitalId", "==", HOSPITAL_ID).get()
  let staleBillingDocs = 0
  for (const doc of brSnap.docs) {
    const data = doc.data() || {}
    if (String(data.status || "pending") === "paid") continue
    if (!data.appointmentId) continue
    const apt = await db
      .doc(`hospitals/${HOSPITAL_ID}/appointments/${String(data.appointmentId)}`)
      .get()
    if (apt.exists && isDocPaid(apt.data() || {})) {
      staleBillingDocs++
      console.log(
        JSON.stringify({
          billingRecordId: doc.id,
          billingStatus: data.status,
          appointmentId: data.appointmentId,
          totalAmount: data.totalAmount,
        })
      )
    }
  }
  console.log(`Stale pending billing_records docs pointing at paid appointments: ${staleBillingDocs}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
