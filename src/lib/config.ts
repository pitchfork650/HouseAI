/**
 * Practice details. Defaults are the client practice; each can be overridden by env.
 * Details we don't have yet (phone, email domain, prices) stay literal placeholders.
 */
export const PRACTICE = {
  doctorName: process.env.NEXT_PUBLIC_DOCTOR_NAME || "Dr. Leo C. Yang",
  doctorShort: process.env.NEXT_PUBLIC_DOCTOR_SHORT || "DR. YANG",
  practiceName: process.env.NEXT_PUBLIC_PRACTICE_NAME || "Leo C. Yang, DDS",
  specialty: process.env.NEXT_PUBLIC_PRACTICE_SPECIALTY || "Cosmetic & restorative dentistry",
  fromAddress: process.env.PRACTICE_EMAIL || "care@[practice].com",
  phone: process.env.PRACTICE_PHONE || "[PHONE]",
  signedInInitials: process.env.NEXT_PUBLIC_DOCTOR_INITIALS || "LY",
};

/** Default records each nav item opens. */
export const DEFAULT_ROUTES = {
  diagnostics: "/diagnostics/P-1042",
  insurance: "/insurance/P-1091",
  followUp: "/follow-ups/FU-1077",
};

export function isMockMode(): boolean {
  return !process.env.GEMINI_API_KEY;
}
