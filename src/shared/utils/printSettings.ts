import { HospitalPrintSettings } from "@/types/print"

export const DEFAULT_HOSPITAL_PRINT_SETTINGS: HospitalPrintSettings = {
  logoUrl: "",
  headerTitle: "HARMONY HEALTHCARE",
  headerSubtitle: "Multi-Specialty Hospital & Research Center",
  footerText: "Thank you for choosing Harmony Healthcare. Wishing you good health!",
  phone: "+91 98765 43210",
  email: "care@harmonyhealth.com",
  address: "123 Healthcare Boulevard, Medical District",
  paperSize: "A4",
  autoPrintBooking: false,
  autoPrintPayment: false,
  taxRatePercent: 0,
  taxRegistrationNo: "",
}

export function normalizeHospitalPrintSettings(rawSettings?: any): HospitalPrintSettings {
  if (!rawSettings || typeof rawSettings !== "object") {
    return { ...DEFAULT_HOSPITAL_PRINT_SETTINGS }
  }

  return {
    logoUrl: typeof rawSettings.logoUrl === "string" ? rawSettings.logoUrl.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.logoUrl,
    headerTitle: typeof rawSettings.headerTitle === "string" && rawSettings.headerTitle.trim() ? rawSettings.headerTitle.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.headerTitle,
    headerSubtitle: typeof rawSettings.headerSubtitle === "string" ? rawSettings.headerSubtitle.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.headerSubtitle,
    footerText: typeof rawSettings.footerText === "string" ? rawSettings.footerText.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.footerText,
    phone: typeof rawSettings.phone === "string" ? rawSettings.phone.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.phone,
    email: typeof rawSettings.email === "string" ? rawSettings.email.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.email,
    address: typeof rawSettings.address === "string" ? rawSettings.address.trim() : DEFAULT_HOSPITAL_PRINT_SETTINGS.address,
    paperSize: rawSettings.paperSize === "Thermal" ? "Thermal" : "A4",
    autoPrintBooking: Boolean(rawSettings.autoPrintBooking),
    autoPrintPayment: Boolean(rawSettings.autoPrintPayment),
    taxRatePercent: typeof rawSettings.taxRatePercent === "number" && rawSettings.taxRatePercent >= 0 ? rawSettings.taxRatePercent : 0,
    taxRegistrationNo: typeof rawSettings.taxRegistrationNo === "string" ? rawSettings.taxRegistrationNo.trim() : "",
  }
}
