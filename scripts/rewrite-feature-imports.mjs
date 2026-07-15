/**
 * One-shot import path rewriter after enterprise folder moves.
 * Run: node scripts/rewrite-feature-imports.mjs
 */
import fs from "fs"
import path from "path"

const ROOT = path.resolve("src")

/** Longer prefixes first so nested paths rewrite correctly. */
const REPLACEMENTS = [
  ["@/app/admin-dashboard/Tabs/pharmacy", "@/features/pharmacy"],
  ["@/app/admin-dashboard/Tabs", "@/features/admin/tabs"],
  ["@/app/admin-dashboard/components", "@/features/admin/components"],
  ["@/app/receptionist-dashboard/Tabs", "@/features/receptionist/tabs"],
  ["@/app/receptionist-dashboard/components", "@/features/receptionist/components"],
  ["@/app/receptionist-dashboard/hooks", "@/features/receptionist/hooks"],
  ["@/app/pharmacy/pharmacyNavConfig", "@/features/pharmacy/pharmacyNavConfig"],
  ["@/app/pharmacy/PharmacyPortalShell", "@/features/pharmacy/PharmacyPortalShell"],
  ["@/components/pharmacy/ops", "@/features/pharmacy/ui/ops"],
  ["@/components/pharmacy", "@/features/pharmacy/ui"],
  ["@/components/doctor", "@/features/doctor"],
  ["@/components/patient", "@/features/patient"],
  ["@/components/documents", "@/features/documents"],
  ["@/components/forms", "@/features/forms"],
  ["@/components/consent", "@/features/consent"],
  ["@/components/prescription", "@/features/prescription"],
  ["@/components/billing", "@/features/billing"],
  ["@/components/payments", "@/features/payments"],
  ["@/components/hq", "@/features/admin/hq"],
  ["@/components/admin", "@/features/admin/chrome"],
  ["@/components/auth", "@/features/auth"],
  ["@/components/AdminProtected", "@/features/auth/AdminProtected"],
  ["@/components/PharmacyProtected", "@/features/auth/PharmacyProtected"],
  ["@/contexts/MultiHospitalContext", "@/providers/MultiHospitalProvider"],
  ["@/contexts/PharmacyPortalContext", "@/providers/PharmacyPortalProvider"],
]

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      walk(full, out)
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function rewriteContent(content, filePath) {
  let next = content
  let changed = false

  for (const [from, to] of REPLACEMENTS) {
    if (next.includes(from)) {
      next = next.split(from).join(to)
      changed = true
    }
  }

  // Admin page relative dynamic imports / local imports
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/")
  if (rel === "app/admin-dashboard/page.tsx") {
    const before = next
    next = next
      .replaceAll('import("./Tabs/', 'import("@/features/admin/tabs/')
      .replaceAll("import('./Tabs/", "import('@/features/admin/tabs/")
      .replaceAll('from "./Tabs/', 'from "@/features/admin/tabs/')
      .replaceAll("from './Tabs/", "from '@/features/admin/tabs/")
      .replaceAll('from "./components/', 'from "@/features/admin/components/')
      .replaceAll("from './components/", "from '@/features/admin/components/")
      .replaceAll('import("./components/', 'import("@/features/admin/components/')
      .replaceAll("import('./components/", "import('@/features/admin/components/")
    if (next !== before) changed = true
  }

  if (rel === "app/pharmacy/layout.tsx") {
    const before = next
    next = next
      .replaceAll("from './PharmacyPortalShell'", "from '@/features/pharmacy/PharmacyPortalShell'")
      .replaceAll('from "./PharmacyPortalShell"', 'from "@/features/pharmacy/PharmacyPortalShell"')
    if (next !== before) changed = true
  }

  // PharmacyManagement sibling imports: ./pharmacy/X → ./X
  if (rel === "features/pharmacy/PharmacyManagement.tsx") {
    const before = next
    next = next.replaceAll("'./pharmacy/", "'./").replaceAll('"./pharmacy/', '"./')
    if (next !== before) changed = true
  }

  return { next, changed }
}

const files = walk(ROOT)
let changedCount = 0
for (const file of files) {
  const original = fs.readFileSync(file, "utf8")
  const { next, changed } = rewriteContent(original, file)
  if (changed) {
    fs.writeFileSync(file, next, "utf8")
    changedCount++
    console.log("updated:", path.relative(process.cwd(), file))
  }
}

console.log(`\nDone. Updated ${changedCount} files.`)
